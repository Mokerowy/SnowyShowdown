// --- components/projectiles.js ---

import {
  // Stałe Bomb
  BOMB_LOB_VELOCITY_Z,
  BOMB_LOB_GRAVITY,
  BOMB_FRICTION,
  BASE_BOMB_WIDTH,
  BASE_BOMB_HEIGHT,
  BOMB_DELAYS,
  BASE_BOMB_EXPLOSION_RANGE,
  // Stałe Śnieżek
  SNOWBALL_SPEED,
  SNOWBALL_SIZE,
  FREEZE_EFFECTS,
  // Stałe Ścian
  BOX_SIZE,
  ICE_WALL_COOLDOWN_MS,
  ICE_WALL_DURATION_MS,
  ICE_WALL_FREEZE_POWER,
  STARTING_ICE_WALLS,
  // Stałe Gracza
  PLAYER_DRAW_WIDTH,
  PLAYER_DRAW_HEIGHT,
  // Stałe Świata
  WORLD_WIDTH_PX,
  WORLD_HEIGHT_PX,
  // Stałe Krio
  MAX_FREEZE_LEVEL,
  STUN_DURATION_MS,
} from "./config.js";

// --- Szablony (Prywatne) ---

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
  blocksDestroyed: false,
  isThrown: false,
  velocityX: 0,
  velocityY: 0,
  velocityZ: 0,
};

const projectileTemplate = {
  id: null,
  ownerId: null,
  active: false,
  type: "cannon",
  worldX: 0,
  worldY: 0,
  velocityX: 0,
  velocityY: 0,
  width: SNOWBALL_SIZE,
  height: SNOWBALL_SIZE,
  hits: 0, // Licznik odbić od ścian
};

// =====================================================================
// SEKCJA 1: TWORZENIE BRONI I POCISKÓW
// =====================================================================

/**
 * Tworzy i inicjuje nowy pocisk (śnieżkę).
 * (Prywatna funkcja pomocnicza)
 */
function createSnowball(player, startX, startY, velocityX, velocityY, nextProjectileId) {
  const newProjectile = { ...projectileTemplate };
  newProjectile.id = nextProjectileId;
  newProjectile.ownerId = player.id;
  newProjectile.active = true;
  newProjectile.worldX = startX;
  newProjectile.worldY = startY;
  newProjectile.velocityX = velocityX;
  newProjectile.velocityY = velocityY;
  return newProjectile; // Zwraca pocisk, aby main.js dodał go do listy
}

/**
 * Główna funkcja tworząca: Bomba (podłożenie/rzut) lub Pocisk (strzał).
 * @returns {Object | null} - Zwraca obiekt { type: "bomb"|"projectile", data: newBomb|newProjectile } lub null.
 */
export function throwProjectileOrBomb(
  player,
  velocityX = 0,
  velocityY = 0,
  isThrown = false,
  nextId, // Będzie to nextBombId lub nextProjectileId
  statusMessage
) {
  if (player.bombType === "ice" || player.bombType === "fire") {
    // --- Logika dla Bomb (rzut / podłożenie) ---
    if (player.bombType === "fire" && player.currentFireBombs <= 0) {
      player.isChargingThrow = false;
      player.spacebarDownTime = null;
      statusMessage.textContent = `Gracz ${player.id} BRAK BOMB OGNISTYCH!`;
      return null;
    }
    if (player.currentActiveBombs >= player.maxBombs) {
      player.isChargingThrow = false;
      player.spacebarDownTime = null;
      return null;
    }
    player.currentActiveBombs++;

    const newBomb = { ...bombTemplate };
    newBomb.id = nextId;
    newBomb.ownerId = player.id;
    newBomb.active = true;
    newBomb.type = player.bombType;
    newBomb.worldX = player.worldX;
    newBomb.worldY = isThrown ? player.worldY : player.worldY + player.drawHeight / 10;
    newBomb.isThrown = isThrown;
    newBomb.velocityX = velocityX;
    newBomb.velocityY = velocityY;
    if (isThrown) {
      newBomb.velocityZ = BOMB_LOB_VELOCITY_Z;
    }
    newBomb.frameIndex = 0;
    newBomb.lastFrameTime = performance.now();

    if (newBomb.type === "fire") {
      player.currentFireBombs--;
      if (player.currentFireBombs <= 0) {
        player.bombType = "ice"; // Autoprzełączenie
        statusMessage.textContent = `Gracz ${player.id}: ostatnia bomba! Powrót do LODU.`;
      }
    }
    return { type: "bomb", data: newBomb };

  } else if (player.bombType === "cannon") {
    // --- Logika dla Pocisku (strzał z armaty) ---
    if (player.currentSnowballs <= 0) {
      player.isChargingThrow = false;
      player.spacebarDownTime = null;
      statusMessage.textContent = `Gracz ${player.id} BRAK ŚNIEŻEK!`;
      return null;
    }

    let vecX = 0, vecY = 0;
    let startX = player.worldX, startY = player.worldY;
    const offset = PLAYER_DRAW_WIDTH / 2; // Pozycja "wylotu" armaty

    if (player.currentStatus === "left") { vecX = -1; startX -= offset; }
    else if (player.currentStatus === "right") { vecX = 1; startX += offset; }
    else if (player.currentStatus === "back") { vecY = -1; startY -= offset; }
    else if (player.currentStatus === "front") { vecY = 1; startY += offset; }
    else { vecY = 1; startY += offset; } // Domyślnie w dół

    const newProjectile = createSnowball(
      player,
      startX,
      startY,
      vecX * SNOWBALL_SPEED,
      vecY * SNOWBALL_SPEED,
      nextId
    );
    
    // player.currentSnowballs--; // Amunicja jest nieskończona
    return { type: "projectile", data: newProjectile };
    
  } else if (player.bombType === "snowthrower") {
    // --- Logika dla Miotacza Śniegu ---
    // Ta funkcja nie jest już odpowiedzialna za tworzenie miotacza.
    // Logika ładowania i strzelania jest w player.js
    // Zwracamy null, aby nic się nie stało przy naciśnięciu.
    return null;
  }
  
  return null;
}

/**
 * Logika tworzenia ściany lodu.
 * @returns {Object | null} - Zwraca nową ścianę lodu lub null, jeśli nie można jej postawić.
 */
export function createIceWall(player, state, statusMessage) {
  const { worldBlocks, iceWalls, players, bots } = state;
  const now = performance.now();

  // --- 1. Sprawdzenie Amunicji i Cooldownu ---
  if (player.iceWallAmmo <= 0) {
    statusMessage.textContent = `Gracz ${player.id} nie ma już ścian lodu!`;
    return null;
  }
  if (now - player.lastIceWallTime < ICE_WALL_COOLDOWN_MS) {
    statusMessage.textContent = `Gracz ${player.id} - ściana lodu się ładuje!`;
    return null;
  }

  // --- 2. NOWA LOGIKA: Obliczanie pozycji na siatce ---
  const playerCellX = Math.floor(player.worldX / BOX_SIZE);
  const playerCellY = Math.floor(player.worldY / BOX_SIZE);
  let targetCellX = playerCellX;
  let targetCellY = playerCellY;

  if (player.currentStatus === "front") targetCellY++;
  else if (player.currentStatus === "back") targetCellY--;
  else if (player.currentStatus === "left") targetCellX--;
  else if (player.currentStatus === "right") targetCellX++;
  else targetCellY++; // Domyślnie w dół

  const wallTopLeftX = targetCellX * BOX_SIZE;
  const wallTopLeftY = targetCellY * BOX_SIZE;
  const wallRect = { x: wallTopLeftX, y: wallTopLeftY, width: BOX_SIZE, height: BOX_SIZE };

  // --- 3. POPRAWIONA LOGIKA: Sprawdzanie kolizji ---
  for (const block of worldBlocks) {
    if (block.worldX === wallTopLeftX && block.worldY === wallTopLeftY) {
      statusMessage.textContent = `Gracz ${player.id} nie może tutaj postawić ściany! (Blok)`;
      return null;
    }
  }
  for (const wall of iceWalls) {
    if (wall.x === wallTopLeftX && wall.y === wallTopLeftY) {
      statusMessage.textContent = `Gracz ${player.id} nie może tutaj postawić ściany! (Inna ściana)`;
      return null;
    }
  }
  for (const entity of [...players, ...bots]) {
    const eWidth = entity.drawWidth || entity.width;
    const eHeight = entity.drawHeight || entity.height;
    const entityRect = {
      x: entity.worldX - eWidth / 2,
      y: entity.worldY - eHeight / 2,
      width: eWidth,
      height: eHeight
    };
    if (
      wallRect.x < entityRect.x + entityRect.width &&
      wallRect.x + wallRect.width > entityRect.x &&
      wallRect.y < entityRect.y + entityRect.height &&
      wallRect.y + wallRect.height > entityRect.y
    ) {
      statusMessage.textContent = `Gracz ${player.id} nie może tutaj postawić ściany! (Byt)`;
      return null;
    }
  }

  // --- 4. Stworzenie ściany ---
  player.iceWallAmmo--;
  player.lastIceWallTime = now;
  statusMessage.textContent = `Gracz ${player.id} stworzył ścianę lodu! (${player.iceWallAmmo}/${STARTING_ICE_WALLS})`;

  return {
    id: `wall_${player.id}_${now}`,
    x: wallTopLeftX,
    y: wallTopLeftY,
    width: BOX_SIZE,
    height: BOX_SIZE,
    createdAt: Date.now(),
    duration: ICE_WALL_DURATION_MS,
    freezePower: ICE_WALL_FREEZE_POWER,
    isCollider: true,
    isDestructible: true,
  };
}


// =====================================================================
// SEKCJA 2: AKTUALIZACJA POCISKÓW
// =====================================================================

/**
 * Aktualizuje fizykę rzuconej bomby (grawitacja, tarcie).
 */
export function updateBombPhysics(bombObject, players) {
  if (!bombObject.isThrown || !bombObject.active) {
    return;
  }
  bombObject.velocityZ += BOMB_LOB_GRAVITY;
  bombObject.z += bombObject.velocityZ;
  bombObject.velocityX *= BOMB_FRICTION;
  bombObject.velocityY *= BOMB_FRICTION;
  bombObject.worldX += bombObject.velocityX;
  bombObject.worldY += bombObject.velocityY;

  if (bombObject.z >= 0 && bombObject.velocityZ > 0) {
    bombObject.z = 0;
    bombObject.isThrown = false;
    bombObject.velocityX = 0;
    bombObject.velocityY = 0;
    bombObject.velocityZ = 0;
  }

  if (
    bombObject.worldY > WORLD_HEIGHT_PX + 200 || bombObject.worldY < -200 ||
    bombObject.worldX > WORLD_WIDTH_PX + 200 || bombObject.worldX < -200
  ) {
    bombObject.active = false;
    const owner = players.find((p) => p.id === bombObject.ownerId);
    if (owner) {
      owner.currentActiveBombs--;
    }
  }
}

/**
 * Aktualizuje licznik czasu (tykanie) bomby, która leży na ziemi.
 * @returns {Object | null} - Zwraca obiekt info o efekcie (np. lód/ogień) lub null.
 */
export function updateBomb(bombObject, timestamp, frames) {
  if (bombObject.isThrown || bombObject.isExploding || !bombObject.active) {
    return null;
  }

  const currentDelay = BOMB_DELAYS[bombObject.frameIndex];
  if (timestamp - bombObject.lastFrameTime > currentDelay) {
    bombObject.lastFrameTime = timestamp;
    bombObject.frameIndex++;

    if (bombObject.frameIndex >= frames.bomb.length) {
      bombObject.active = false;
      bombObject.isExploding = true;
      bombObject.explosionTime = performance.now();
      bombObject.blocksDestroyed = false;

      if (bombObject.type === "ice") {
        return { type: "ice", x: bombObject.worldX, y: bombObject.worldY };
      }
      if (bombObject.type === "fire") {
        return { type: "fire", x: bombObject.worldX, y: bombObject.worldY };
      }
    }
  }
  return null;
}

/**
 * Aktualizuje ruch i kolizje pocisków (śnieżek).
 * @param {Array<Object>} projectiles - Obecna lista pocisków.
 *g* @param {Object} state - Stan gry (worldBlocks, players, bots, bonuses).
 * @returns {Array<Object>} - Zaktualizowana lista pocisków.
 */
export function updateProjectiles(projectiles, state) {
  const { worldBlocks, players, bots, bonuses } = state;
  const activeProjectiles = [];
  const blocksToRemove = new Set(); // Przechowuje bloki do zniszczenia

  for (const p of projectiles) {
    if (!p.active) continue;

    let futureX = p.worldX + p.velocityX;
    let futureY = p.worldY + p.velocityY;

    let hitObstacle = false;

    // 1. Sprawdzenie kolizji z blokami
    for (const block of worldBlocks) {
      const boxRect = { x: block.worldX, y: block.worldY, width: BOX_SIZE, height: BOX_SIZE };
      const projectileRect = { x: futureX - p.width / 2, y: futureY - p.height / 2, width: p.width, height: p.height };

      if (
        projectileRect.x < boxRect.x + boxRect.width &&
        projectileRect.x + projectileRect.width > boxRect.x &&
        projectileRect.y < boxRect.y + boxRect.height &&
        projectileRect.y + projectileRect.height > boxRect.y
      ) {
        if (block.type === 0 || block.type === 1 || block.type === 3) { // Zniszczalny (0, 1, 3)
          blocksToRemove.add(block); // Zaznacz do usunięcia
          p.active = false;
        } else { // Niezniszczalny (typ 2)
          // Odbicie
          const hitFromX = p.worldX <= boxRect.x || p.worldX >= boxRect.x + boxRect.width;
          const hitFromY = p.worldY <= boxRect.y || p.worldY >= boxRect.y + boxRect.height;
          if (hitFromX) p.velocityX *= -1;
          if (hitFromY) p.velocityY *= -1;
          p.hits++;
          if (p.hits > 3) p.active = false; // Limit odbić
        }
        hitObstacle = true;
        break; 
      }
    }
    
    if (!p.active) continue;

    // 2. Aktualizacja pozycji
    if (!hitObstacle) {
        p.worldX = futureX;
        p.worldY = futureY;
    } else {
        p.worldX += p.velocityX;
        p.worldY += p.velocityY;
    }

    // 3. Sprawdzenie kolizji z jednostkami
    const allEntities = [...players, ...bots];
    for (const entity of allEntities) {
      if (!entity.isAlive) continue;
      
      if (entity.id === p.ownerId) {
        const distToOwner = Math.hypot(p.worldX - entity.worldX, p.worldY - entity.worldY);
        if (distToOwner < PLAYER_DRAW_WIDTH) continue;
      }

      const entityWidth = entity.drawWidth || entity.width;
      const dist = Math.hypot(p.worldX - entity.worldX, p.worldY - entity.worldY);

      if (dist < p.width / 2 + entityWidth / 2) {
        // Trafienie!
        p.active = false;
        const freezePower = FREEZE_EFFECTS.cannon.player;

        if (entity.isStunned) {
          entity.isAlive = false;
          console.log(`Jednostka ${entity.id} ROZTRZASKANA przez Snowball!`);
        } else {
          entity.freezeLevel = Math.min(MAX_FREEZE_LEVEL, entity.freezeLevel + freezePower);
          if (entity.freezeLevel >= MAX_FREEZE_LEVEL) {
            entity.freezeLevel = 0;
            entity.isStunned = true;
            entity.stunEndTime = performance.now() + STUN_DURATION_MS;
            console.log(`Jednostka ${entity.id} ZAMROŻONA przez Snowball! (STUN)`);
          }
        }
        break; 
      }
    }
    if (!p.active) continue;

    // 4. Usuwanie, jeśli wyleciał poza świat
    if (
      p.worldY > WORLD_HEIGHT_PX + 50 || p.worldY < -50 ||
      p.worldX > WORLD_WIDTH_PX + 50 || p.worldX < -50
    ) {
      p.active = false;
    }

    if (p.active) {
      activeProjectiles.push(p);
    }
  } // Koniec pętli pocisków

  // Usuwamy bloki i tworzymy bonusy
  if (blocksToRemove.size > 0) {
    state.worldBlocks = worldBlocks.filter(block => !blocksToRemove.has(block));
    
    blocksToRemove.forEach(block => {
      if (Math.random() < 0.3) { // 30% szansy
        let bonusType = "extraBomb";
        const typeRoll = Math.random();
        if (typeRoll < 0.33) bonusType = "extraBomb";
        else if (typeRoll < 0.66) bonusType = "speedBoost";
        else bonusType = "bombType_fire";
        
        bonuses.push({ 
          worldX: block.worldX + BOX_SIZE / 2,
          worldY: block.worldY + BOX_SIZE / 2,
          type: bonusType,
        });
      }
    });
  }

  return activeProjectiles; 
}