// --- ZASTĄP TĘ FUNKCJĘ w /components/world.js ---

import {
  WORLD_WIDTH_PX,
  WORLD_HEIGHT_PX,
  BOX_SIZE,
  BASE_MOVE_SPEED,
  PLAYER_DRAW_WIDTH,
  PLAYER_DRAW_HEIGHT,
  ICE_WALL_DURATION_MS,
} from "./config.js";

/**
 * Generuje nową, RZADSZĄ mapę świata (1500x1500).
 * (Wersja z czarną, litą granicą)
 */
export function getInitialWorldBlocks() {
  const blocks = [];
  const worldLength = Math.floor(WORLD_WIDTH_PX / BOX_SIZE);
  const worldHeightBlocks = Math.floor(WORLD_HEIGHT_PX / BOX_SIZE);

  // --- 1. Generowanie Granic Mapy (Niezniszczalne) ---
  for (let y = 0; y < worldHeightBlocks; y++) {
    for (let x = 0; x < worldLength; x++) {
      const isBorder =
        y === 0 ||
        y === worldHeightBlocks - 1 ||
        x === 0 ||
        x === worldLength - 1;
      if (isBorder) {
        blocks.push({
          worldX: x * BOX_SIZE,
          worldY: y * BOX_SIZE,
          // --- POPRAWKA: Nadajemy nowy typ '4' dla czarnej granicy ---
          type: 4, 
        });
      }
    }
  }

  // --- 2. Generowanie Wewnętrznych Filarów (Niezniszczalne, Typ 2) ---
  for (let y = 4; y < worldHeightBlocks - 4; y += 4) {
    for (let x = 4; x < worldLength - 4; x += 4) {
      // Upewnijmy się, że nie generujemy na środku
      const midX = Math.floor(worldLength / 2);
      const midY = Math.floor(worldHeightBlocks / 2);
      if (x === midX || y === midY) continue;

      blocks.push({
        worldX: x * BOX_SIZE,
        worldY: y * BOX_SIZE,
        type: 2, // Niezniszczalny filar
      });
    }
  }

  // --- 3. Generowanie Losowych Bloków (Zniszczalne) ---
  const spawnAreas = [
    { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 },
    { x: worldLength - 2, y: 1 }, { x: worldLength - 3, y: 1 }, { x: worldLength - 2, y: 2 },
    { x: 1, y: worldHeightBlocks - 2 }, { x: 2, y: worldHeightBlocks - 2 }, { x: 1, y: worldHeightBlocks - 3 },
    { x: worldLength - 2, y: worldHeightBlocks - 2 }, { x: worldLength - 3, y: worldHeightBlocks - 2 }, { x: worldLength - 2, y: worldHeightBlocks - 3 },
  ];
  const midX = Math.floor(worldLength / 2);
  const midY = Math.floor(worldHeightBlocks / 2);

  for (let y = 1; y < worldHeightBlocks - 1; y++) {
    for (let x = 1; x < worldLength - 1; x++) {
      
      const isPillar = x % 4 === 0 && y % 4 === 0 && x >= 4 && y >= 4;
      if (isPillar) continue; 

      let isSpawnArea = false;
      for (const area of spawnAreas) {
        if (area.x === x && area.y === y) {
          isSpawnArea = true;
          break;
        }
      }
      if (isSpawnArea) continue;

      const isCenterPath = x === midX || y === midY;
      if (isCenterPath) continue;

      const roll = Math.random();
      let blockType = null;

      if (roll < 0.4) {
        blockType = 1; // Zniszczalny (TYP 1)
      } else if (roll < 0.45) {
        blockType = 3; // Zniszczalny (TYP 3) - przywrócono!
      }

      if (blockType !== null) {
        blocks.push({
          worldX: x * BOX_SIZE,
          worldY: y * BOX_SIZE,
          type: blockType,
        });
      }
    }
  }
  return blocks;
}

/**
 * Ogólne sprawdzenie kolizji AABB (obiekt vs bloki świata ORAZ ściany lodu).
 * @param {number} futureWorldX - Docelowa pozycja X obiektu.
 * @param {number} futureWorldY - Docelowa pozycja Y obiektu.
 * @param {number} objectWidth - Szerokość obiektu.
 * @param {number} objectHeight - Wysokość obiektu.
 * @param {Array<Object>} worldBlocks - Tablica bloków świata.
 * @param {Array<Object>} iceWalls - Tablica aktywnych ścian lodu.
 * @returns {boolean} - True, jeśli jest kolizja.
 */
export function checkCollision(
  futureWorldX,
  futureWorldY,
  objectWidth,
  objectHeight,
  worldBlocks, // <-- Argument
  iceWalls    // <-- NOWY Argument
) {
  const margin = 0; // Margines kolizji
  const objectRect = {
    x: futureWorldX - objectWidth / 2 + margin,
    y: futureWorldY - objectHeight / 2 + margin,
    width: objectWidth - 2 * margin,
    height: objectHeight - 2 * margin,
  };

  // 1. Sprawdź kolizje z blokami świata
  for (const block of worldBlocks) {
    const boxRect = {
      x: block.worldX,
      y: block.worldY,
      width: BOX_SIZE,
      height: BOX_SIZE,
    };
    if (
      objectRect.x < boxRect.x + boxRect.width &&
      objectRect.x + objectRect.width > boxRect.x &&
      objectRect.y < boxRect.y + boxRect.height &&
      objectRect.y + objectRect.height > boxRect.y
    ) {
      return true; // Kolizja
    }
  }
  
  // 2. Sprawdź kolizje ze ścianami lodu (NOWOŚĆ)
  if (iceWalls) { // Dodatkowe zabezpieczenie, jeśli iceWalls jest undefined
    for (const wall of iceWalls) {
      const wallRect = {
        x: wall.x,
        y: wall.y,
        width: wall.width,
        height: wall.height,
      };
      if (
        objectRect.x < wallRect.x + wallRect.width &&
        objectRect.x + objectRect.width > wallRect.x &&
        objectRect.y < wallRect.y + wallRect.height &&
        objectRect.y + objectRect.height > wallRect.y
      ) {
        return true; // Kolizja ze ścianą lodu
      }
    }
  }
  
  return false; // Brak kolizji
}

/**
 * Aktualizacja ścian lodu - usuwa wygasłe.
 * @param {Array<Object>} iceWalls - Obecna tablica ścian lodu.
 * @returns {Array<Object>} - Nowa, przefiltrowana tablica.
 */
export function updateIceWalls(iceWalls) {
  const now = Date.now();
  // Używamy filter, aby zwrócić nową tablicę (zamiast modyfikować starą)
  return iceWalls.filter((wall) => {
    return now - wall.createdAt < (wall.duration || ICE_WALL_DURATION_MS);
  });
}


/**
 * Funkcja pomocnicza: Szukanie bezpiecznej pozycji startowej.
 * @param {Array<Object>} worldBlocks - Tablica bloków świata.
 * @param {Array<Object>} iceWalls - Tablica aktywnych ścian lodu.
 */
export function findSafeStartingPosition(
  worldBlocks, // <-- Argument
  iceWalls,    // <-- NOWY Argument
  searchStartX = 100,
  searchStartY = 100
) {
  let safeX = searchStartX;
  let safeY = searchStartY;
  let attempts = 0;
  const maxAttempts = WORLD_HEIGHT_PX / BASE_MOVE_SPEED;

  while (
    checkCollision( // Zaktualizowane wywołanie
      safeX,
      safeY,
      PLAYER_DRAW_WIDTH,
      PLAYER_DRAW_HEIGHT,
      worldBlocks,
      iceWalls // Przekaż iceWalls
    ) &&
    attempts < maxAttempts
  ) {
    safeY += BASE_MOVE_SPEED;
    if (safeY > WORLD_HEIGHT_PX - 100) {
      safeY = searchStartY;
      safeX += BOX_SIZE;
    }
    attempts++;
  }
  if (attempts >= maxAttempts) {
    console.warn("Nie udało się znaleźć idealnej bezpiecznej pozycji!");
    return { x: searchStartX, y: searchStartY };
  }
  return { x: safeX, y: safeY };
}