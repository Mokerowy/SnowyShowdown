// --- bomb.js ---

import {
  BOMB_LOB_GRAVITY,
  BOMB_LOB_VELOCITY_Z,
  BOMB_FRICTION,
  WORLD_WIDTH_PX,
  WORLD_HEIGHT_PX,
  BOMB_DELAYS,
  BASE_BOMB_EXPLOSION_RANGE,
  BOX_SIZE,
} from "./config.js";

// Importujemy funkcję kolizji ze światem
import { checkBombCollision } from "./world.js";

// --- Szablon Bomby (Prywatny dla modułu) ---
const bombTemplate = {
  id: null,
  ownerId: null,
  active: false,
  type: "normal",
  worldX: 0,
  worldY: 0,
  z: 0,
  frameIndex: 0,
  lastFrameTime: 0,
  isExploding: false,
  explosionTime: 0,
  explosionLayout: null,
  blocksDestroyed: false, // Ta flaga będzie używana przez logikę w main.js
  isThrown: false,
  velocityX: 0,
  velocityY: 0,
  velocityZ: 0,
};

// --- Funkcje pomocnicze generowania eksplozji (Prywatne) ---

/**
 * Generuje standardowy, krzyżowy układ eksplozji.
 * Wymaga 'worldBlocks' do sprawdzania kolizji.
 */
function generateExplosionLayout(centerX, centerY, blastRange, worldBlocks) {
  const layout = {
    parts: [],
  };
  const startWorldX = Math.round(centerX / BOX_SIZE) * BOX_SIZE;
  const startWorldY = Math.round(centerY / BOX_SIZE) * BOX_SIZE;

  layout.parts.push({
    worldX: startWorldX,
    worldY: startWorldY,
    type: "center",
  });

  const directions = [
    { deltaX: BOX_SIZE, deltaY: 0 },
    { deltaX: -BOX_SIZE, deltaY: 0 },
    { deltaX: 0, deltaY: BOX_SIZE },
    { deltaX: 0, deltaY: -BOX_SIZE },
  ];

  // Funkcja wewnętrzna, która ma dostęp do 'worldBlocks'
  const isCollidingWithBlock = (worldX, worldY) => {
    // Używamy importowanej funkcji, przekazując jej bloki
    return checkBombCollision(worldX, worldY, worldBlocks);
  };

  for (const dir of directions) {
    for (let i = 1; i <= blastRange; i++) {
      const worldX = startWorldX + dir.deltaX * i;
      const worldY = startWorldY + dir.deltaY * i;
      let type = dir.deltaX !== 0 ? "horizontal" : "vertical";
      if (i === blastRange) {
        type = "end";
      }
      layout.parts.push({
        worldX: worldX,
        worldY: worldY,
        type: type,
        direction:
          dir.deltaX > 0
            ? "right"
            : dir.deltaX < 0
            ? "left"
            : dir.deltaY > 0
            ? "down"
            : "up",
      });
      // Sprawdź kolizję i zatrzymaj promień
      if (isCollidingWithBlock(worldX, worldY)) {
        break;
      }
    }
  }
  return layout;
}

/**
 * Generuje kwadratowy układ eksplozji.
 */
function generateSquareExplosionLayout(centerX, centerY, blastRange) {
  const layout = { parts: [] };
  const range = Math.floor(blastRange / 2); // 'blastRange' działa jak średnica
  const startWorldX = Math.round(centerX / BOX_SIZE) * BOX_SIZE;
  const startWorldY = Math.round(centerY / BOX_SIZE) * BOX_SIZE;

  for (let r = -range; r <= range; r++) {
    for (let c = -range; c <= range; c++) {
      layout.parts.push({
        worldX: startWorldX + c * BOX_SIZE,
        worldY: startWorldY + r * BOX_SIZE,
        type: "center", // Wszystkie części są "środkiem"
      });
    }
  }
  return layout;
}

// --- EKSPORTOWANE FUNKCJE ---

/**
 * Tworzy nową instancję bomby na podstawie gracza.
 * @param {Object} player - Gracz rzucający bombę.
 * @param {number} velocityX - Prędkość rzutu X.
 * @param {number} velocityY - Prędkość rzutu Y.
 * @param {boolean} isThrown - Czy bomba jest rzucona (fizyka) czy położona.
 * @param {number} nextBombId - Aktualny ID do przypisania.
 * @returns {Object} - Zwraca nową instancję bomby.
 */
export function startBombAnimation(
  player,
  velocityX = 0,
  velocityY = 0,
  isThrown = false,
  nextBombId
) {
  // Sprawdzenie limitu bomb jest teraz w 'handleKeyUp', ale powtórzymy je
  if (player.currentActiveBombs >= player.maxBombs) {
    return null; // Nie twórz bomby
  }
  player.currentActiveBombs++;

  const newBomb = { ...bombTemplate };
  newBomb.id = nextBombId;
  newBomb.ownerId = player.id;
  newBomb.active = true;
  newBomb.type = player.bombType;
  newBomb.worldX = player.worldX;
  
  // Mała korekta pozycji Y przy kładzeniu
  let startY;
  if (isThrown) {
    startY = player.worldY;
  } else {
    // Kładź bombę lekko "za" graczem (jeśli idzie w dół)
    startY = player.worldY + player.drawHeight / 10;
  }
  newBomb.worldY = startY;
  
  newBomb.isThrown = isThrown;
  newBomb.velocityX = velocityX;
  newBomb.velocityY = velocityY;
  
  if (isThrown) {
    newBomb.velocityZ = BOMB_LOB_VELOCITY_Z;
  }
  
  newBomb.frameIndex = 0;
  newBomb.lastFrameTime = performance.now();
  
  return newBomb;
}

/**
 * Aktualizuje fizykę rzuconej bomby (grawitacja, tarcie).
 * @param {Object} bombObject - Bomba do aktualizacji.
 * @param {Array<Object>} players - Tablica graczy (do zaktualizowania licznika bomb).
 */
export function updateBombPhysics(bombObject, players) {
  if (!bombObject.isThrown || !bombObject.active) {
    return;
  }

  // Fizyka (grawitacja, ruch)
  bombObject.velocityZ += BOMB_LOB_GRAVITY;
  bombObject.z += bombObject.velocityZ;
  bombObject.velocityX *= BOMB_FRICTION;
  bombObject.velocityY *= BOMB_FRICTION;
  bombObject.worldX += bombObject.velocityX;
  bombObject.worldY += bombObject.velocityY;

  // Lądowanie
  if (bombObject.z >= 0 && bombObject.velocityZ > 0) {
    bombObject.z = 0;
    bombObject.isThrown = false;
    bombObject.velocityX = 0;
    bombObject.velocityY = 0;
    bombObject.velocityZ = 0;
  }

  // Sprawdzenie, czy bomba wyleciała poza świat
  if (
    bombObject.worldY > WORLD_HEIGHT_PX + 200 ||
    bombObject.worldY < -200 ||
    bombObject.worldX > WORLD_WIDTH_PX + 200 ||
    bombObject.worldX < -200
  ) {
    bombObject.active = false;
    // Zwróć bombę właścicielowi
    const owner = players.find((p) => p.id === bombObject.ownerId);
    if (owner) {
      owner.currentActiveBombs--;
    }
  }
}

/**
 * Aktualizuje licznik czasu (tykanie) bomby, która leży na ziemi.
 * @param {Object} bombObject - Bomba do aktualizacji.
 * @param {number} timestamp - Aktualny czas.
 * @param {Array<Object>} players - Tablica graczy (do znalezienia zasięgu).
 * @param {Array<Object>} worldBlocks - Bloki świata (dla generatora eksplozji).
 * @param {Object} frames - Obiekt klatek (dla frames.bomb.length).
 * @returns {Object | null} - Zwraca obiekt info o efekcie (np. lód/ogień) lub null.
 */
export function updateBomb(bombObject, timestamp, players, worldBlocks, frames) {
  if (bombObject.isThrown) return null;
  if (bombObject.isExploding) return null;
  if (!bombObject.active) return null;

  const currentDelay = BOMB_DELAYS[bombObject.frameIndex];
  if (timestamp - bombObject.lastFrameTime > currentDelay) {
    bombObject.lastFrameTime = timestamp;
    bombObject.frameIndex++;

    // Czas na wybuch
    if (bombObject.frameIndex >= frames.bomb.length) {
      bombObject.active = false; // Przestaje tykać
      bombObject.isExploding = true;
      bombObject.explosionTime = performance.now();
      bombObject.blocksDestroyed = false; // Reset flagi

      // Znajdź właściciela, aby ustalić zasięg
      const owner = players.find((p) => p.id === bombObject.ownerId);
      const blastRange = owner ? owner.blastRange : BASE_BOMB_EXPLOSION_RANGE;

      // Wygeneruj odpowiedni układ eksplozji
      if (bombObject.type === "square") {
        bombObject.explosionLayout = generateSquareExplosionLayout(
          bombObject.worldX,
          bombObject.worldY,
          blastRange
        );
      } else {
        // 'normal', 'ice', 'fire' używają tego samego kształtu
        bombObject.explosionLayout = generateExplosionLayout(
          bombObject.worldX,
          bombObject.worldY,
          blastRange,
          worldBlocks // Przekaż bloki!
        );
      }
      
      // Zwróć informację o efekcie ubocznym (jeśli jest)
      if (bombObject.type === "ice") {
        return { type: "ice", x: bombObject.worldX, y: bombObject.worldY };
      }
      if (bombObject.type === "fire") {
        return { type: "fire", x: bombObject.worldX, y: bombObject.worldY };
      }
      
      return null; // Brak specjalnego efektu
    }
  }
  
  return null; // Jeszcze nie wybuchła
}