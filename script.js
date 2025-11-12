// --- KONFIGURACJA CANVAS ---
const canvas = document.getElementById("animationCanvas");
const ctx = canvas.getContext("2d");
const statusMessage = document.getElementById("statusMessage");
const currentStatusElement = document.getElementById("currentStatus");
const worldXStatusElement = document.getElementById("worldXStatus");
const worldYStatusElement = document.getElementById("worldYStatus");

// --- KONFIGURACJA STANU GRY ---
let gameState = "MENU"; // "MENU", "PLAYING", "ROUND_OVER"
let numPlayers = 1;
let isRoundActive = false;

// --- KONFIGURACJA GRACZY (1-4) ---
let players = [];
const PLAYER_DRAW_WIDTH = 30;
const PLAYER_DRAW_HEIGHT = 30;
const PLAYER_TINTS = [
  "hue-rotate(0deg) saturate(100%)", // P1 (Normalny)
  "hue-rotate(120deg) saturate(200%)", // P2 (Zielony)
  "hue-rotate(240deg) saturate(200%)", // P3 (Niebieski)
  "hue-rotate(60deg) saturate(200%)", // P4 (Żółty/Pomarańczowy)
];
// Mapowanie klawiszy dla 4 graczy
const playerKeyMaps = [
  {
    up: "w",
    down: "s",
    left: "a",
    right: "d",
    bomb: " ", // Spacja
  },
  {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    bomb: "Enter",
  },
  {
    up: "i",
    down: "k",
    left: "j",
    right: "l",
    bomb: "o",
  },
  {
    up: "Numpad8",
    down: "Numpad5",
    left: "Numpad4",
    right: "Numpad6",
    bomb: "Numpad0",
  },
];

// --- KONFIGURACJA RZUCANIA I FIZYKI BOMBY ---
const MAX_CHARGE_MS = 1000;
const MAX_THROW_SPEED = 15;
const BOMB_LOB_VELOCITY_Z = -12;
const BOMB_LOB_GRAVITY = 0.5;
const BOMB_FRICTION = 0.96;

// --- KONFIGURACJA ANIMACJI I RUCHU ---
const BASE_MOVE_SPEED = 4;
const frameDelayMs = 50;

// STAŁE DLA BLOKÓW
const BOX_SIZE = 40;
const BOX_SOURCES = [
  "./box-01.png",
  "./box-02.png",
  "./box-03.png",
  "./box-04.png",
];
const WORLD_WIDTH_PX = 1500;
const WORLD_HEIGHT_PX = 1500;

// KONFIGURACJA WYBUCHU (CZAS I ZASIĘG)
const BASE_BOMB_EXPLOSION_RANGE = 3;
const EXPLOSION_DURATION_MS = 400;
const BOMB_DELAYS = [1500, 100, 50, 50];
const BOMB_SIZES = [0.7, 0.8, 0.9, 1.2];
const BASE_BOMB_WIDTH = PLAYER_DRAW_WIDTH * 1.0;
const BASE_BOMB_HEIGHT = PLAYER_DRAW_HEIGHT * 1.0;

// --- KONFIGURACJA LODU ---
let icePatches = [];
const ICE_PATCH_DURATION_MS = 5000;
const ICE_PATCH_SIZE = BOX_SIZE * 3;

// --- KONFIGURACJA OGNIA ---
let firePatches = [];
const FIRE_PATCH_DURATION_MS = 3000;
const FIRE_PATCH_SIZE = BOX_SIZE * 3;
const FIRE_DAMAGE_INTERVAL_MS = 500;

// Definicja świata
const groundY = WORLD_HEIGHT_PX - BOX_SIZE;

/**
 * Generuje nową, uporządkowaną mapę świata (1500x1500).
 */
/**
/**
 * Generuje nową, RZADSZĄ mapę świata w stylu "Bomberman" (1500x1500).
 * Gwarantuje ścieżki łączące wszystkie 4 kwadranty.
 */
function getInitialWorldBlocks() {
  const blocks = [];
  const worldLength = Math.floor(WORLD_WIDTH_PX / BOX_SIZE);
  const worldHeightBlocks = Math.floor(WORLD_HEIGHT_PX / BOX_SIZE); // --- 1. Generowanie Granic Mapy (Niezniszczalne) --- // Typ 0 (box-01) - ZNISZCZALNY (zgodnie z poprzednią logiką)

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
          type: 0, // Typ 0 (box-01.png) = ZNISZCZALNA granica
        });
      }
    }
  } // --- 2. Generowanie Wewnętrznych Filarów (Niezniszczalne) --- // Typ 2 (box-03) - NIEZNISZCZALNY

  for (let y = 2; y < worldHeightBlocks - 2; y += 2) {
    for (let x = 2; x < worldLength - 2; x += 2) {
      blocks.push({
        worldX: x * BOX_SIZE,
        worldY: y * BOX_SIZE,
        type: 2, // Typ 2 (box-03.png) = Niezniszczalny filar
      });
    }
  } // --- 3. Generowanie Losowych Bloków (Zniszczalne i Niezniszczalne) ---

  const spawnAreas = [
    // Róg P1 (Góra-Lewo)
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 }, // Róg P2 (Góra-Prawo)
    { x: worldLength - 2, y: 1 },
    { x: worldLength - 3, y: 1 },
    { x: worldLength - 2, y: 2 }, // Róg P3 (Dół-Lewo)
    { x: 1, y: worldHeightBlocks - 2 },
    { x: 2, y: worldHeightBlocks - 2 },
    { x: 1, y: worldHeightBlocks - 3 }, // Róg P4 (Dół-Prawo)
    { x: worldLength - 2, y: worldHeightBlocks - 2 },
    { x: worldLength - 3, y: worldHeightBlocks - 2 },
    { x: worldLength - 2, y: worldHeightBlocks - 3 },
  ]; // --- NOWOŚĆ: Definicja centralnych ścieżek ---

  const midX = Math.floor(worldLength / 2);
  const midY = Math.floor(worldHeightBlocks / 2);

  for (let y = 1; y < worldHeightBlocks - 1; y++) {
    for (let x = 1; x < worldLength - 1; x++) {
      // Sprawdź, czy to nie jest stały filar
      const isPillar = x % 2 === 0 && y % 2 === 0;
      if (isPillar) continue; // Sprawdź, czy to nie jest strefa spawnu

      let isSpawnArea = false;
      for (const area of spawnAreas) {
        if (area.x === x && area.y === y) {
          isSpawnArea = true;
          break;
        }
      }
      if (isSpawnArea) continue; // --- NOWOŚĆ: Sprawdź, czy to centralna ścieżka --- // Nie generuj bloków na środkowej kolumnie ani środkowym wierszu

      const isCenterPath = x === midX || y === midY;
      if (isCenterPath) continue; // --- Koniec nowości --- // Jeśli to puste miejsce, rzuć kostką
      const roll = Math.random();
      let blockType = null; // --- NOWOŚĆ: Zmniejszona gęstość --- // 40% szans na ZNISZCZALNY blok (TYP 1 = box-02.png)

      if (roll < 0.4) {
        blockType = 1;
      } // 5% szans na NIEZNISZCZALNY "upiększacz" (TYP 3 = box-04.png) // Używamy tylko typu 3, aby typ 2 (box-03) był zarezerwowany dla filarów
      else if (roll < 0.45) {
        blockType = 3;
      } // 55% szans na puste pole // --- Koniec nowości ---
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
 * Generuje nową, RZADSZĄ mapę świata w stylu "Bomberman" (1500x1500).
 * Gwarantuje ścieżki łączące wszystkie 4 kwadranty.
 */
function getInitialWorldBlocks() {
  const blocks = [];
  const worldLength = Math.floor(WORLD_WIDTH_PX / BOX_SIZE);
  const worldHeightBlocks = Math.floor(WORLD_HEIGHT_PX / BOX_SIZE); // --- 1. Generowanie Granic Mapy (Niezniszczalne) --- // Typ 0 (box-01) - ZNISZCZALNY (zgodnie z poprzednią logiką)

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
          type: 0, // Typ 0 (box-01.png) = ZNISZCZALNA granica
        });
      }
    }
  } // --- 2. Generowanie Wewnętrznych Filarów (Niezniszczalne) --- // Typ 2 (box-03) - NIEZNISZCZALNY

  for (let y = 2; y < worldHeightBlocks - 2; y += 2) {
    for (let x = 2; x < worldLength - 2; x += 2) {
      blocks.push({
        worldX: x * BOX_SIZE,
        worldY: y * BOX_SIZE,
        type: 2, // Typ 2 (box-03.png) = Niezniszczalny filar
      });
    }
  } // --- 3. Generowanie Losowych Bloków (Zniszczalne i Niezniszczalne) ---

  const spawnAreas = [
    // Róg P1 (Góra-Lewo)
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 }, // Róg P2 (Góra-Prawo)
    { x: worldLength - 2, y: 1 },
    { x: worldLength - 3, y: 1 },
    { x: worldLength - 2, y: 2 }, // Róg P3 (Dół-Lewo)
    { x: 1, y: worldHeightBlocks - 2 },
    { x: 2, y: worldHeightBlocks - 2 },
    { x: 1, y: worldHeightBlocks - 3 }, // Róg P4 (Dół-Prawo)
    { x: worldLength - 2, y: worldHeightBlocks - 2 },
    { x: worldLength - 3, y: worldHeightBlocks - 2 },
    { x: worldLength - 2, y: worldHeightBlocks - 3 },
  ]; // --- NOWOŚĆ: Definicja centralnych ścieżek ---

  const midX = Math.floor(worldLength / 2);
  const midY = Math.floor(worldHeightBlocks / 2);

  for (let y = 1; y < worldHeightBlocks - 1; y++) {
    for (let x = 1; x < worldLength - 1; x++) {
      // Sprawdź, czy to nie jest stały filar
      const isPillar = x % 2 === 0 && y % 2 === 0;
      if (isPillar) continue; // Sprawdź, czy to nie jest strefa spawnu

      let isSpawnArea = false;
      for (const area of spawnAreas) {
        if (area.x === x && area.y === y) {
          isSpawnArea = true;
          break;
        }
      }
      if (isSpawnArea) continue; // --- NOWOŚĆ: Sprawdź, czy to centralna ścieżka --- // Nie generuj bloków na środkowej kolumnie ani środkowym wierszu

      const isCenterPath = x === midX || y === midY;
      if (isCenterPath) continue; // --- Koniec nowości --- // Jeśli to puste miejsce, rzuć kostką
      const roll = Math.random();
      let blockType = null; // --- NOWOŚĆ: Zmniejszona gęstość --- // 40% szans na ZNISZCZALNY blok (TYP 1 = box-02.png)

      if (roll < 0.4) {
        blockType = 1;
      } // 5% szans na NIEZNISZCZALNY "upiększacz" (TYP 3 = box-04.png) // Używamy tylko typu 3, aby typ 2 (box-03) był zarezerwowany dla filarów
      else if (roll < 0.45) {
        blockType = 3;
      } // 55% szans na puste pole // --- Koniec nowości ---
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

let worldBlocks = getInitialWorldBlocks();

// ZORGANIZOWANIE ŹRÓDEŁ KLATEK WEDŁUG KIERUNKU
const frameSourcesMap = {
  back: [
    "./duck-back-01.png",
    "./duck-back-02.png",
    "./duck-back-03.png",
    "./duck-back2-01.png",
    "./duck-back2-02.png",
    "./duck-back2-03.png",
  ],
  front: [
    "./duck-front-01.png",
    "./duck-front-02.png",
    "./duck-front-03.png",
    "./duck-front2-01.png",
    "./duck-front2-02.png",
    "./duck-front2-03.png",
  ],
  left: [
    "./duck-left-02.png",
    "./duck-left-03.png",
    "./duck-left-04.png",
    "./duck-left-05.png",
    "./duck-left-04.png",
    "./duck-left-03.png",
    "./duck-left-02.png",
  ],
  right: [
    "./duck-right-03.png",
    "./duck-right-02.png",
    "./duck-right-01.png",
    "./duck-right-02.png",
    "./duck-right-03.png",
    "./duck-right-04.png",
  ],
  bomb: ["./bomb-01.png", "./bomb-02.png", "./bomb-03.png", "./bomb-04.png"],
  bot: ["./duck-front-01.png", "./duck-front-02.png", "./duck-front-03.png"],
};

// Zmienne ładowania
let frames = {};
let boxFrames = [];
let bonusFrames = {};
let loadedCount = 0;
let totalFramesToLoad = 0;
let allKeysPressed = {};

// --- Szablon Gracza z WŁASNĄ kamerą i viewportem ---
const playerTemplate = {
  id: null,
  worldX: 100,
  worldY: 100, // Własna kamera gracza
  worldOffsetX: 0,
  worldOffsetY: 0, // --- NOWOŚĆ: Rozmiar okna gracza ---
  viewportWidth: 0,
  viewportHeight: 0, // ---
  isAlive: true,
  currentStatus: "front",
  currentFrameIndex: 0,
  lastFrameTime: 0,
  drawWidth: PLAYER_DRAW_WIDTH,
  drawHeight: PLAYER_DRAW_HEIGHT,
  keys: { up: false, down: false, left: false, right: false, bomb: false },
  keyMap: null,
  tint: "", // Statystyki
  moveSpeed: BASE_MOVE_SPEED,
  blastRange: BASE_BOMB_EXPLOSION_RANGE,
  maxBombs: 1,
  currentActiveBombs: 0,
  bombType: "normal", // Rzucanie
  isChargingThrow: false,
  spacebarDownTime: null, // Efekty
  isSliding: false,
  slideVector: { x: 0, y: 0 },
  lastFireDamageTime: 0,
};

// --- Funkcja tworząca gracza ---
// ZMODYFIKOWANA: Przyjmuje wymiary viewportu
function createPlayer(id, keyMap, startX, startY, tint, viewportW, viewportH) {
  const player = { ...playerTemplate };
  player.id = id;
  player.keyMap = keyMap;
  player.worldX = startX;
  player.worldY = startY;
  player.tint = tint;
  player.keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    bomb: false,
  };
  player.slideVector = { x: 0, y: 0 }; // Zapisz wymiary okna
  player.viewportWidth = viewportW;
  player.viewportHeight = viewportH; // Ustaw kamerę, by centrowała gracza W JEGO OKNIE
  player.worldOffsetX = startX - viewportW / 2;
  player.worldOffsetY = startY - viewportH / 2;
  return player;
}

// --- Konfiguracja Botów ---
let bots = [];
const BOT_DRAW_WIDTH = 30;
const BOT_DRAW_HEIGHT = 30;
const BOT_MOVE_SPEED = 3;
const BOT_AI_UPDATE_MS = 500;

// Zmienne dla bonusów
let bonuses = [];
const BONUS_SIZE = 20;
const BONUS_PICKUP_RANGE = 30;

const BONUS_SOURCES = {
  bombType_fire: "./buff-01.png",
  extraBomb: "./buff-02.png",
  bombType_square: "./buff-03.png",
  bombType_ice: "./buff-04.png",
  speedBoost: "./buff-05.png",
  blastRadius: "./buff-06.png",
};

// STAN BOMBY (jako tablica)
let bombs = [];
let nextBombId = 0;

// Szablon dla pojedynczej bomby
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
  blocksDestroyed: false,
  isThrown: false,
  velocityX: 0,
  velocityY: 0,
  velocityZ: 0,
};

// --- Szablon Bota ---
const botTemplate = {
  id: null,
  worldX: 0,
  worldY: 0,
  width: BOT_DRAW_WIDTH,
  height: BOT_DRAW_HEIGHT,
  isAlive: true,
  currentFrameIndex: 0,
  lastFrameTime: 0,
  state: "WANDERING",
  moveVector: { x: 0, y: 0 },
  lastAiUpdateTime: 0,
};

// ----------------------------------------------------------------------
// --- FUNKCJA WSPOMAGAJĄCA: Szukanie bezpiecznej pozycji startowej ---
// ----------------------------------------------------------------------
function findSafeStartingPosition(searchStartX = 100, searchStartY = 100) {
  let safeX = searchStartX;
  let safeY = searchStartY;
  let attempts = 0;
  const maxAttempts = WORLD_HEIGHT_PX / BASE_MOVE_SPEED;

  while (
    checkCollision(safeX, safeY, PLAYER_DRAW_WIDTH, PLAYER_DRAW_HEIGHT) &&
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

// ----------------------------------------------------------------------
// --- FUNKCJA ŁADUJĄCA OBRAZY ---
// ----------------------------------------------------------------------
function loadFrames() {
  for (const status in frameSourcesMap) {
    totalFramesToLoad += frameSourcesMap[status].length;
  }
  totalFramesToLoad += BOX_SOURCES.length;

  totalFramesToLoad += Object.keys(BONUS_SOURCES).length;
  if (totalFramesToLoad === 0) {
    statusMessage.textContent = "Błąd: Brak źródeł klatek do załadowania.";
    return;
  }
  let loadedPromises = [];
  for (const status in frameSourcesMap) {
    frames[status] = [];
    frameSourcesMap[status].forEach((src) => {
      const img = new Image();
      img.src = src;
      frames[status].push(img);
      const loadPromise = new Promise((resolve) => {
        img.onload = () => {
          loadedCount++;
          statusMessage.textContent = `Ładowanie klatek... (${loadedCount} z ${totalFramesToLoad})`;
          resolve();
        };
        img.onerror = () => {
          console.error(`Błąd ładowania: ${src}`);
          resolve();
        };
      });
      loadedPromises.push(loadPromise);
    });
  }
  BOX_SOURCES.forEach((src) => {
    const img = new Image();
    img.src = src;
    boxFrames.push(img);
    const loadPromise = new Promise((resolve) => {
      img.onload = () => {
        loadedCount++;
        statusMessage.textContent = `Ładowanie klatek... (${loadedCount} z ${totalFramesToLoad})`;
        resolve();
      };
      img.onerror = () => {
        console.error(`Błąd ładowania boxa: ${src}`);
        resolve();
      };
    });
    loadedPromises.push(loadPromise);
  });

  for (const bonusType in BONUS_SOURCES) {
    const src = BONUS_SOURCES[bonusType];
    const img = new Image();
    img.src = src;
    bonusFrames[bonusType] = img; // Zapisz obrazek w obiekcie
    const loadPromise = new Promise((resolve) => {
      img.onload = () => {
        loadedCount++;
        statusMessage.textContent = `Ładowanie klatek... (${loadedCount} z ${totalFramesToLoad})`;
        resolve();
      };
      img.onerror = () => {
        console.error(`Błąd ładowania bonusa: ${src}`);
        resolve(); // Rozwiąż, aby nie blokować gry
      };
    });
    loadedPromises.push(loadPromise);
  }

  Promise.all(loadedPromises).then(() => {
    if (!frames.bot || frames.bot.length === 0) {
      console.warn("Brak klatek bota, używam klatek 'front' jako zastępczych.");
      frames.bot = frames.front;
    }

    gameState = "MENU";
    statusMessage.textContent =
      "Wszystkie klatki załadowane. Wybierz tryb gry.";
    currentStatusElement.textContent = "MENU";
    worldXStatusElement.textContent = "";
    if (worldYStatusElement) worldYStatusElement.textContent = "";

    requestAnimationFrame(animationLoop);
  });
}

// ----------------------------------------------------------------------
// --- FUNKCJE DETEKCJI KOLIZJI (Bez zmian) ---
// ----------------------------------------------------------------------
function checkCollision(futureWorldX, futureWorldY, objectWidth, objectHeight) {
  const margin = 0;
  const objectRect = {
    x: futureWorldX - objectWidth / 2 + margin,
    y: futureWorldY - objectHeight / 2 + margin,
    width: objectWidth - 2 * margin,
    height: objectHeight - 2 * margin,
  };
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
      return true;
    }
  }
  return false;
}

function checkBombCollision(bombWorldX, bombWorldY) {
  const bombRect = {
    x: bombWorldX - BASE_BOMB_WIDTH / 2,
    y: bombWorldY - BASE_BOMB_HEIGHT / 2,
    width: BASE_BOMB_WIDTH,
    height: BASE_BOMB_HEIGHT,
  };
  for (const block of worldBlocks) {
    const boxRect = {
      x: block.worldX,
      y: block.worldY,
      width: BOX_SIZE,
      height: BOX_SIZE,
    };
    if (
      bombRect.x < boxRect.x + boxRect.width &&
      bombRect.x + bombRect.width > boxRect.x &&
      bombRect.y < boxRect.y + boxRect.height &&
      bombRect.y + bombRect.height > boxRect.y
    ) {
      return true;
    }
  }
  return false;
}

// ----------------------------------------------------------------------
// --- FIZYKA, EFEKTY I LOGIKA BOMBY (Bez zmian) ---
// ----------------------------------------------------------------------
function updateBombPhysics(bombObject) {
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
    bombObject.worldY > WORLD_HEIGHT_PX + 200 ||
    bombObject.worldY < -200 ||
    bombObject.worldX > WORLD_WIDTH_PX + 200 ||
    bombObject.worldX < -200
  ) {
    bombObject.active = false;
    const owner = players.find((p) => p.id === bombObject.ownerId);
    if (owner) {
      owner.currentActiveBombs--;
    }
  }
}

function generateExplosionLayout(centerX, centerY, blastRange) {
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
  const isCollidingWithBlock = (worldX, worldY) => {
    return checkBombCollision(worldX, worldY);
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
      if (isCollidingWithBlock(worldX, worldY)) {
        break;
      }
    }
  }
  return layout;
}

function generateSquareExplosionLayout(centerX, centerY, blastRange) {
  const layout = { parts: [] };
  const range = Math.floor(blastRange / 2);
  const startWorldX = Math.round(centerX / BOX_SIZE) * BOX_SIZE;
  const startWorldY = Math.round(centerY / BOX_SIZE) * BOX_SIZE;

  for (let r = -range; r <= range; r++) {
    for (let c = -range; c <= range; c++) {
      layout.parts.push({
        worldX: startWorldX + c * BOX_SIZE,
        worldY: startWorldY + r * BOX_SIZE,
        type: "center",
      });
    }
  }
  return layout;
}

// ----------------------------------------------------------------------
// --- FUNKCJA: NISZCZENIE BLOKÓW (ZMODYFIKOWANA) ---
// ----------------------------------------------------------------------
function destroyBlocksInExplosionRange(layout) {
  if (!layout || !layout.parts) return;
  const explosionParts = layout.parts;
  const blocksToKeep = [];

  for (const block of worldBlocks) {
    let wasHit = false;
    const blockRect = {
      x: block.worldX,
      y: block.worldY,
      width: BOX_SIZE,
      height: BOX_SIZE,
    };
    for (const part of explosionParts) {
      const partRect = {
        x: part.worldX - BOX_SIZE / 2,
        y: part.worldY - BOX_SIZE / 2,
        width: BOX_SIZE,
        height: BOX_SIZE,
      };
      if (
        partRect.x < blockRect.x + blockRect.width &&
        partRect.x + partRect.width > blockRect.x &&
        partRect.y < blockRect.y + blockRect.height &&
        partRect.y + partRect.height > blockRect.y
      ) {
        wasHit = true;
        break;
      }
    } // Sprawdź, co zrobić z blokiem

    if (wasHit) {
      // --- NOWA LOGIKA ---
      // Sprawdź, czy typ bloku jest ZNISZCZALNY.
      // Typy 2 (box-03) i 3 (box-04) są NIEZNISZCZALNE.
      // Typy 0 (box-01) i 1 (box-02) są ZNISZCZALNE.
      if (block.type === 0 || block.type === 1) {
        // Jest zniszczalny (typ 0 lub 1), więc go nie dodajemy do 'blocksToKeep'
        // Sprawdź, czy wypadnie bonus
        if (Math.random() < 0.3) {
          let bonusType = "extraBomb";
          const typeRoll = Math.random();
          if (typeRoll < 0.2) {
            bonusType = "extraBomb";
          } else if (typeRoll < 0.4) {
            bonusType = "speedBoost";
          } else if (typeRoll < 0.6) {
            bonusType = "blastRadius";
          } else {
            const bombTypeRoll = Math.random();
            if (bombTypeRoll < 0.33) {
              bonusType = "bombType_square";
            } else if (bombTypeRoll < 0.66) {
              bonusType = "bombType_ice";
            } else {
              bonusType = "bombType_fire";
            }
          }
          bonuses.push({
            worldX: block.worldX + BOX_SIZE / 2,
            worldY: block.worldY + BOX_SIZE / 2,
            type: bonusType,
          });
        }
      } else {
        // Blok był trafiony, ale jest niezniszczalny (typ 2 lub 3)
        blocksToKeep.push(block);
      } // --- KONIEC NOWEJ LOGIKI ---
    } else {
      // Blok nie był trafiony, więc go zachowaj
      blocksToKeep.push(block);
    }
  }
  worldBlocks = blocksToKeep;
}

function checkEntityCollisionWithExplosion(entity, layout) {
  if (!layout || !layout.parts || !entity.isAlive) return;
  const entityWidth = entity.drawWidth || entity.width;
  const entityHeight = entity.drawHeight || entity.height;

  const entityRect = {
    x: entity.worldX - entityWidth / 2,
    y: entity.worldY - entityHeight / 2,
    width: entityWidth,
    height: entityHeight,
  };
  for (const part of layout.parts) {
    const partRect = {
      x: part.worldX - BOX_SIZE / 2,
      y: part.worldY - BOX_SIZE / 2,
      width: BOX_SIZE,
      height: BOX_SIZE,
    };
    if (
      entityRect.x < partRect.x + partRect.width &&
      entityRect.x + entityRect.width > partRect.x &&
      entityRect.y < partRect.y + partRect.height &&
      entityRect.y + entityRect.height > partRect.y
    ) {
      entity.isAlive = false;
      console.log(`Byt (ID: ${entity.id}) trafiony!`);
      if (entity.keyMap) {
        statusMessage.textContent = `Gracz ${entity.id} został trafiony!`;
      }
      break;
    }
  }
}

function checkAndCollectBonuses(player) {
  const newBonuses = [];
  for (const bonus of bonuses) {
    const distance = Math.sqrt(
      (player.worldX - bonus.worldX) ** 2 + (player.worldY - bonus.worldY) ** 2
    );
    if (distance < BONUS_PICKUP_RANGE) {
      if (bonus.type === "speedBoost") {
        player.moveSpeed += 1;
      } else if (bonus.type === "blastRadius") {
        player.blastRange++;
      } else if (bonus.type === "bombType_square") {
        player.bombType = "square";
      } else if (bonus.type === "bombType_ice") {
        player.bombType = "ice";
      } else if (bonus.type === "bombType_fire") {
        player.bombType = "fire";
      } else if (bonus.type === "extraBomb") {
        player.maxBombs++;
      }
      statusMessage.textContent = `Gracz ${player.id} zebrał bonus!`;
    } else {
      newBonuses.push(bonus);
    }
  }
  bonuses = newBonuses;
}

function createIcePatch(worldX, worldY) {
  const centerX = Math.round(worldX / BOX_SIZE) * BOX_SIZE;
  const centerY = Math.round(worldY / BOX_SIZE) * BOX_SIZE;
  icePatches.push({
    worldX: centerX,
    worldY: centerY,
    size: ICE_PATCH_SIZE,
    createdAt: performance.now(),
  });
}
function updateIcePatches(timestamp) {
  icePatches = icePatches.filter((patch) => {
    return timestamp - patch.createdAt < ICE_PATCH_DURATION_MS;
  });
}
function checkEntityOnIce(worldX, worldY, entityHeight) {
  for (const patch of icePatches) {
    const patchRect = {
      x: patch.worldX - patch.size / 2,
      y: patch.worldY - patch.size / 2,
      width: patch.size,
      height: patch.size,
    };
    const playerFeet = { x: worldX, y: worldY + entityHeight / 4 };
    if (
      playerFeet.x > patchRect.x &&
      playerFeet.x < patchRect.x + patchRect.width &&
      playerFeet.y > patchRect.y &&
      playerFeet.y < patchRect.y + patchRect.height
    ) {
      return true;
    }
  }
  return false;
}

function createFirePatch(worldX, worldY) {
  const centerX = Math.round(worldX / BOX_SIZE) * BOX_SIZE;
  const centerY = Math.round(worldY / BOX_SIZE) * BOX_SIZE;
  firePatches.push({
    worldX: centerX,
    worldY: centerY,
    size: FIRE_PATCH_SIZE,
    createdAt: performance.now(),
  });
}
function updateFirePatches(timestamp) {
  firePatches = firePatches.filter((patch) => {
    return timestamp - patch.createdAt < FIRE_PATCH_DURATION_MS;
  });
}
function checkEntityOnFire(worldX, worldY, objectWidth, objectHeight) {
  for (const patch of firePatches) {
    const patchRect = {
      x: patch.worldX - patch.size / 2,
      y: patch.worldY - patch.size / 2,
      width: patch.size,
      height: patch.size,
    };
    const objectFeet = { x: worldX, y: worldY + objectHeight / 4 };
    if (
      objectFeet.x > patchRect.x &&
      objectFeet.x < patchRect.x + patchRect.width &&
      objectFeet.y > patchRect.y &&
      objectFeet.y < patchRect.y + patchRect.height
    ) {
      return true;
    }
  }
  return false;
}

// ----------------------------------------------------------------------
// --- FUNKCJE RYSOWANIA (ZALEŻNE OD KAMERY) ---
// ----------------------------------------------------------------------
// Wszystkie te funkcje przyjmują 'worldOffsetX' i 'worldOffsetY'

function drawBlocks(worldOffsetX, worldOffsetY) {
  for (const block of worldBlocks) {
    const frame = boxFrames[block.type % boxFrames.length];
    const canvasX = block.worldX - worldOffsetX;
    const canvasY = block.worldY - worldOffsetY;
    if (
      canvasX + BOX_SIZE > 0 &&
      canvasX < canvas.width &&
      canvasY + BOX_SIZE > 0 &&
      canvasY < canvas.height
    ) {
      if (frame && frame.complete && frame.naturalWidth !== 0) {
        ctx.drawImage(frame, canvasX, canvasY, BOX_SIZE, BOX_SIZE);
      }
    }
  }
}

function drawBonuses(worldOffsetX, worldOffsetY) {
  for (const bonus of bonuses) {
    const canvasX = bonus.worldX - worldOffsetX;
    const canvasY = bonus.worldY - worldOffsetY;

    // Sprawdzenie, czy bonus jest na ekranie (bez zmian)
    if (
      canvasX + BONUS_SIZE < 0 ||
      canvasX - BONUS_SIZE > canvas.width ||
      canvasY + BONUS_SIZE < 0 ||
      canvasY - BONUS_SIZE > canvas.height
    ) {
      continue;
    }

    // --- NOWA LOGIKA RYSOWANIA (Obrazki) ---
    const frame = bonusFrames[bonus.type];

    if (frame && frame.complete && frame.naturalWidth !== 0) {
      // Mamy załadowany obrazek, rysujemy go
      ctx.drawImage(
        frame,
        canvasX - BONUS_SIZE / 2, // Centrowanie X
        canvasY - BONUS_SIZE / 2, // Centrowanie Y
        BONUS_SIZE, // Szerokość
        BONUS_SIZE // Wysokość
      );
    } else {
      // Zastępcze rysowanie (jakby obrazek się nie załadował)
      ctx.fillStyle = "magenta"; // Kolor błędu
      ctx.fillRect(
        canvasX - BONUS_SIZE / 2,
        canvasY - BONUS_SIZE / 2,
        BONUS_SIZE,
        BONUS_SIZE
      );
    }
    // --- KONIEC NOWEJ LOGIKI ---
  }
}

function drawIcePatches(worldOffsetX, worldOffsetY) {
  const timestamp = performance.now();
  for (const patch of icePatches) {
    const canvasX = patch.worldX - worldOffsetX;
    const canvasY = patch.worldY - worldOffsetY;
    const age = timestamp - patch.createdAt;
    const lifePercent = age / ICE_PATCH_DURATION_MS;
    const alpha = 1.0 - Math.pow(lifePercent, 2);
    if (
      canvasX + patch.size / 2 < 0 ||
      canvasX - patch.size / 2 > canvas.width ||
      canvasY + patch.size / 2 < 0 ||
      canvasY - patch.size / 2 > canvas.height
    ) {
      continue;
    }
    ctx.fillStyle = `rgba(173, 216, 230, ${alpha * 0.7})`;
    ctx.fillRect(
      canvasX - patch.size / 2,
      canvasY - patch.size / 2,
      patch.size,
      patch.size
    );
  }
}

function drawFirePatches(worldOffsetX, worldOffsetY) {
  const timestamp = performance.now();
  for (const patch of firePatches) {
    const canvasX = patch.worldX - worldOffsetX;
    const canvasY = patch.worldY - worldOffsetY;
    const age = timestamp - patch.createdAt;
    const lifePercent = age / FIRE_PATCH_DURATION_MS;
    const alpha = 1.0 - Math.pow(lifePercent, 3);
    if (
      canvasX + patch.size / 2 < 0 ||
      canvasX - patch.size / 2 > canvas.width ||
      canvasY + patch.size / 2 < 0 ||
      canvasY - patch.size / 2 > canvas.height
    ) {
      continue;
    }
    const phase = Math.floor(timestamp / 100) % 3;
    let color = `rgba(255, 69, 0, ${alpha * 0.7})`;
    if (phase === 1) {
      color = `rgba(255, 140, 0, ${alpha * 0.8})`;
    } else if (phase === 2) {
      color = `rgba(255, 215, 0, ${alpha * 0.7})`;
    }
    ctx.fillStyle = color;
    ctx.fillRect(
      canvasX - patch.size / 2,
      canvasY - patch.size / 2,
      patch.size,
      patch.size
    );
  }
}

function drawChargeBar(player, canvasX, canvasY) {
  if (!player.isChargingThrow || player.spacebarDownTime === null) return;
  const chargeTime = performance.now() - player.spacebarDownTime;
  const chargePercent = Math.min(chargeTime / MAX_CHARGE_MS, 1.0);
  const barWidth = 60;
  const barHeight = 8;
  const barX = canvasX - barWidth / 2;
  const barY = canvasY - player.drawHeight / 2 - 15;
  ctx.fillStyle = "#333";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  const chargeColor = chargePercent < 0.95 ? "white" : "#ef4444";
  ctx.fillStyle = chargeColor;
  ctx.fillRect(barX, barY, barWidth * chargePercent, barHeight);
}

function drawExplosion(layout, bombObject, worldOffsetX, worldOffsetY) {
  if (!layout || !bombObject) return;
  const timeElapsed = performance.now() - bombObject.explosionTime;
  const progress = timeElapsed / EXPLOSION_DURATION_MS;

  if (progress >= 1.0) {
    bombObject.isExploding = false;
    bombObject.explosionLayout = null;
    const owner = players.find((p) => p.id === bombObject.ownerId);
    if (owner) {
      owner.currentActiveBombs--;
    }
    return;
  }
  const colorPhase = Math.floor(timeElapsed / 50) % 2;

  // --- POCZĄTEK MODYFIKACJI ---
  let innerColor;
  let outerColor;

  // Ustaw kolory na podstawie typu bomby
  switch (bombObject.type) {
    case "ice":
      // Odcienie niebieskiego
      innerColor = colorPhase === 0 ? "#B0E0E6" : "#87CEFA"; // Jasny niebieski
      outerColor = colorPhase === 0 ? "#00BFFF" : "#1E90FF"; // Ciemny niebieski
      break;

    case "square":
      // Odcienie fioletu
      innerColor = colorPhase === 0 ? "#D8BFD8" : "#E6E6FA"; // Jasny fiolet (Lawenda)
      outerColor = colorPhase === 0 ? "#9370DB" : "#8A2BE2"; // Ciemny fiolet
      break;

    case "fire": // Bomba "fire" używa tych samych kolorów co domyślna
    case "normal":
    default:
      // Domyślne kolory (pomarańczowo-czerwone)
      innerColor = colorPhase === 0 ? "#FFD700" : "#FFA500";
      outerColor = colorPhase === 0 ? "#FF4500" : "#DC143C";
      break;
  }
  // --- KONIEC MODYFIKACJI ---


  if (!bombObject.blocksDestroyed) {
    destroyBlocksInExplosionRange(layout);
    for (const player of players) {
      checkEntityCollisionWithExplosion(player, layout);
    }
    for (const bot of bots) {
      checkEntityCollisionWithExplosion(bot, layout);
    }
    statusMessage.textContent = "BOOM! Zniszczono bloki.";
    bombObject.blocksDestroyed = true;
  }
  layout.parts.forEach((part) => {
    const canvasX = part.worldX - worldOffsetX - BOX_SIZE / 2;
    const canvasY = part.worldY - worldOffsetY - BOX_SIZE / 2;
    if (
      canvasX + BOX_SIZE < 0 ||
      canvasX - BOX_SIZE > canvas.width ||
      canvasY + BOX_SIZE < 0 ||
      canvasY - BOX_SIZE > canvas.height
    ) {
      return;
    }
    // Ta część rysuje, używając kolorów zdefiniowanych wyżej
    ctx.fillStyle = outerColor;
    ctx.fillRect(canvasX, canvasY, BOX_SIZE, BOX_SIZE);
    const innerMargin = BOX_SIZE * 0.1;
    ctx.fillStyle = innerColor;
    ctx.fillRect(
      canvasX + innerMargin,
      canvasY + innerMargin,
      BOX_SIZE - 2 * innerMargin,
      BOX_SIZE - 2 * innerMargin
    );
    if (part.type === "center") {
      const centerMargin = BOX_SIZE * 0.2;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(
        canvasX + centerMargin,
        canvasY + centerMargin,
        BOX_SIZE - 2 * centerMargin,
        BOX_SIZE - 2 * centerMargin
      );
    }
  });
}

// ----------------------------------------------------------------------
// --- FUNKCJE OBSŁUGI BOTA (Bez zmian) ---
// ----------------------------------------------------------------------
function drawBots(worldOffsetX, worldOffsetY) {
  for (const bot of bots) {
    if (!bot.isAlive) continue;
    const canvasX = bot.worldX - worldOffsetX;
    const canvasY = bot.worldY - worldOffsetY;
    const currentFrame = frames.bot[bot.currentFrameIndex];
    if (
      canvasX + bot.width > 0 &&
      canvasX < canvas.width &&
      canvasY + bot.height > 0 &&
      canvasY < canvas.height
    ) {
      if (
        currentFrame &&
        currentFrame.complete &&
        currentFrame.naturalWidth !== 0
      ) {
        ctx.save();
        ctx.filter = "grayscale(100%) brightness(1.2) contrast(1.2)";
        ctx.drawImage(
          currentFrame,
          canvasX - bot.width / 2,
          canvasY - bot.height / 2,
          bot.width,
          bot.height
        );
        ctx.restore();
      }
    }
  }
}

function updateBots(timestamp) {
  for (const bot of bots) {
    if (!bot.isAlive) continue; // --- 1. Logika AI ---
    if (timestamp - bot.lastAiUpdateTime > BOT_AI_UPDATE_MS) {
      bot.lastAiUpdateTime = timestamp;
      if (bot.state === "WANDERING") {
        const roll = Math.random();
        if (roll < 0.25) {
          bot.moveVector = { x: BOT_MOVE_SPEED, y: 0 };
        } else if (roll < 0.5) {
          bot.moveVector = { x: -BOT_MOVE_SPEED, y: 0 };
        } else if (roll < 0.75) {
          bot.moveVector = { x: 0, y: BOT_MOVE_SPEED };
        } else {
          bot.moveVector = { x: 0, y: -BOT_MOVE_SPEED };
        }
      }
    } // --- 2. Zastosowanie ruchu i kolizji ---
    if (bot.moveVector.x !== 0 || bot.moveVector.y !== 0) {
      let futureX = bot.worldX + bot.moveVector.x;
      let futureY = bot.worldY + bot.moveVector.y;
      if (checkCollision(futureX, futureY, bot.width, bot.height)) {
        bot.moveVector.x *= -1;
        bot.moveVector.y *= -1;
        bot.lastAiUpdateTime = 0;
      } else {
        const isInsideWorldX =
          futureX >= bot.width / 2 && futureX <= WORLD_WIDTH_PX - bot.width / 2;
        const isInsideWorldY =
          futureY >= bot.height / 2 &&
          futureY <= WORLD_HEIGHT_PX - bot.height / 2;
        if (isInsideWorldX && isInsideWorldY) {
          bot.worldX = futureX;
          bot.worldY = futureY;
          if (timestamp - bot.lastFrameTime > frameDelayMs * 2) {
            bot.lastFrameTime = timestamp;
            bot.currentFrameIndex =
              (bot.currentFrameIndex + 1) % frames.bot.length;
          }
        } else {
          bot.moveVector.x *= -1;
          bot.moveVector.y *= -1;
          bot.lastAiUpdateTime = 0;
        }
      }
    }
  }
}

function checkBotsOnFire() {
  for (const bot of bots) {
    if (!bot.isAlive) continue;
    if (checkEntityOnFire(bot.worldX, bot.worldY, bot.width, bot.height)) {
      bot.isAlive = false;
      console.log("Bot spalony!");
    }
  }
}

function checkPlayerBotCollision(player) {
  if (!player.isAlive) return;
  const duckRect = {
    x: player.worldX - player.drawWidth / 2,
    y: player.worldY - player.drawHeight / 2,
    width: player.drawWidth,
    height: player.drawHeight,
  };
  for (const bot of bots) {
    if (!bot.isAlive) continue;
    const botRect = {
      x: bot.worldX - bot.width / 2,
      y: bot.worldY - bot.height / 2,
      width: bot.width,
      height: bot.height,
    };
    if (
      duckRect.x < botRect.x + botRect.width &&
      duckRect.x + duckRect.width > botRect.x &&
      duckRect.y < botRect.y + botRect.height &&
      duckRect.y + duckRect.height > botRect.y
    ) {
      player.isAlive = false;
      statusMessage.textContent = `Gracz ${player.id} złapany przez bota!`;
      break;
    }
  }
}

// ----------------------------------------------------------------------
// --- LOGIKA AKTUALIZACJI I RYSOWANIA GRACZA ---
// ----------------------------------------------------------------------

/**
 * Aktualizuje stan gracza (ruch, kolizje, efekty ORAZ KAMERĘ).
 */
function updatePlayer(player, timestamp) {
  if (!player.isAlive) return; // --- Logika kolizji i efektów ---

  const isOnIce = checkEntityOnIce(
    player.worldX,
    player.worldY,
    player.drawHeight
  );
  const isOnFire = checkEntityOnFire(
    player.worldX,
    player.worldY,
    player.drawWidth,
    player.drawHeight
  );
  checkPlayerBotCollision(player);

  if (!player.isAlive) return;

  if (
    isOnFire &&
    timestamp - player.lastFireDamageTime > FIRE_DAMAGE_INTERVAL_MS
  ) {
    player.lastFireDamageTime = timestamp;
    player.isAlive = false;
    statusMessage.textContent = `Gracz ${player.id} spłonął!`;
  }

  if (!player.isAlive) return; // --- LOGIKA RUCHU I ŚLIZGANIA ---

  let moveX = 0;
  let moveY = 0;
  let isMoving = false;

  if (player.isSliding) {
    moveX = player.slideVector.x;
    moveY = player.slideVector.y;
    isMoving = moveX !== 0 || moveY !== 0;
    if (!isOnIce || isOnFire) {
      player.isSliding = false;
      player.slideVector = { x: 0, y: 0 };
    }
  } else {
    if (player.keys.up) {
      moveY -= player.moveSpeed;
      isMoving = true;
    }
    if (player.keys.down) {
      moveY += player.moveSpeed;
      isMoving = true;
    }
    if (player.keys.left) {
      moveX -= player.moveSpeed;
      isMoving = true;
    }
    if (player.keys.right) {
      moveX += player.moveSpeed;
      isMoving = true;
    }

    updatePlayerStatus(player);

    if (isMoving && isOnIce && !isOnFire) {
      player.isSliding = true;
      if (moveX > 0) player.slideVector.x = player.moveSpeed;
      else if (moveX < 0) player.slideVector.x = -player.moveSpeed;
      else player.slideVector.x = 0;
      if (moveY > 0) player.slideVector.y = player.moveSpeed;
      else if (moveY < 0) player.slideVector.y = -player.moveSpeed;
      else player.slideVector.y = 0;

      if (player.slideVector.x !== 0 && player.slideVector.y !== 0) {
        const magnitude = Math.sqrt(
          player.slideVector.x ** 2 + player.slideVector.y ** 2
        );
        player.slideVector.x =
          (player.slideVector.x / magnitude) * player.moveSpeed;
        player.slideVector.y =
          (player.slideVector.y / magnitude) * player.moveSpeed;
      }
    }
  } // --- DETEKCJA KOLIZJI I GRANIC ---

  if (moveX !== 0) {
    const futurePlayerWorldX = player.worldX + moveX;
    const isInsideWorldX =
      futurePlayerWorldX >= player.drawWidth / 2 &&
      futurePlayerWorldX <= WORLD_WIDTH_PX - player.drawWidth / 2;
    if (!isInsideWorldX) {
      player.isSliding = false;
    } else if (
      checkCollision(
        futurePlayerWorldX,
        player.worldY,
        player.drawWidth,
        player.drawHeight
      )
    ) {
      player.isSliding = false;
    } else {
      player.worldX = futurePlayerWorldX;
    }
  }
  if (moveY !== 0) {
    const futurePlayerWorldY = player.worldY + moveY;
    const isInsideWorldY =
      futurePlayerWorldY >= player.drawHeight / 2 &&
      futurePlayerWorldY <= WORLD_HEIGHT_PX - player.drawHeight / 2;
    if (!isInsideWorldY) {
      player.isSliding = false;
    } else if (
      checkCollision(
        player.worldX,
        futurePlayerWorldY,
        player.drawWidth,
        player.drawHeight
      )
    ) {
      player.isSliding = false;
    } else {
      player.worldY = futurePlayerWorldY;
    }
  }

  checkAndCollectBonuses(player); // --- Aktualizacja animacji KACZKI ---

  if (isMoving && timestamp - player.lastFrameTime > frameDelayMs) {
    player.lastFrameTime = timestamp;
    const currentFrameSet = frames[player.currentStatus];
    if (currentFrameSet && currentFrameSet.length > 0) {
      player.currentFrameIndex =
        (player.currentFrameIndex + 1) % currentFrameSet.length;
    }
  } else if (!isMoving) {
    player.currentFrameIndex = 0;
  } // --- ZMODYFIKOWANA: Aktualizacja KAMERY GRACZA --- // Pobierz wymiary viewportu ZAPISANE W GRACZU

  const viewportWidth = player.viewportWidth;
  const viewportHeight = player.viewportHeight; // Ustaw docelowy offset, aby wycentrować gracza

  let targetOffsetX = player.worldX - viewportWidth / 2;
  let targetOffsetY = player.worldY - viewportHeight / 2; // Ogranicz kamerę do granic świata

  targetOffsetX = Math.max(
    0,
    Math.min(targetOffsetX, WORLD_WIDTH_PX - viewportWidth)
  );
  targetOffsetY = Math.max(
    0,
    Math.min(targetOffsetY, WORLD_HEIGHT_PX - viewportHeight)
  ); // Płynne przejście kamery (lerp)

  const lerpFactor = 0.05;
  player.worldOffsetX += (targetOffsetX - player.worldOffsetX) * lerpFactor;
  player.worldOffsetY += (targetOffsetY - player.worldOffsetY) * lerpFactor;
}

/**
 * Rysuje gracza na canvasie.
 */
function drawPlayer(player, worldOffsetX, worldOffsetY) {
  const canvasX = player.worldX - worldOffsetX;
  const canvasY = player.worldY - worldOffsetY;

  if (
    canvasX + player.drawWidth < 0 ||
    canvasX - player.drawWidth > canvas.width ||
    canvasY + player.drawHeight < 0 ||
    canvasY - player.drawHeight > canvas.height
  ) {
    return;
  }

  drawChargeBar(player, canvasX, canvasY);

  const currentFrame = frames[player.currentStatus]
    ? frames[player.currentStatus][player.currentFrameIndex]
    : null;

  if (
    currentFrame &&
    currentFrame.complete &&
    currentFrame.naturalWidth !== 0
  ) {
    ctx.save();
    if (!player.isAlive) {
      ctx.globalAlpha = 0.5;
      ctx.filter =
        "grayscale(100%) brightness(1.5) sepia(100%) hue-rotate(-50deg) saturate(600%) contrast(1)";
    } else {
      ctx.filter = player.tint;
    }
    ctx.drawImage(
      currentFrame,
      canvasX - player.drawWidth / 2,
      canvasY - player.drawHeight / 2,
      player.drawWidth,
      player.drawHeight
    );
    ctx.restore();
  } else {
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(
      canvasX - player.drawWidth / 2,
      canvasY - player.drawHeight / 2,
      player.drawWidth,
      player.drawHeight
    );
  }
}

/**
 * Aktualizuje status (kierunek) animacji kaczki.
 */
function updatePlayerStatus(player) {
  let newStatus = player.currentStatus;
  if (player.keys.up) {
    newStatus = "back";
  } else if (player.keys.down) {
    newStatus = "front";
  } else if (player.keys.left) {
    newStatus = "left";
  } else if (player.keys.right) {
    newStatus = "right";
  }
  if (newStatus && newStatus !== player.currentStatus) {
    player.currentStatus = newStatus;
    player.currentFrameIndex = 0;
  }
}

// ----------------------------------------------------------------------
// --- GŁÓWNA PĘTLA ANIMACJI (Zarządza stanami gry) ---
// ----------------------------------------------------------------------

function animationLoop(timestamp) {
  requestAnimationFrame(animationLoop);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  switch (gameState) {
    case "MENU":
      drawMenu();
      break;
    case "PLAYING":
      const livingPlayers = players.filter((p) => p.isAlive); // Warunek końca: (tryb >1 gracza I zostało <= 1) LUB (tryb 1 gracz I zostało 0)
      const endCondition =
        (numPlayers > 1 && livingPlayers.length <= 1) ||
        (numPlayers === 1 && livingPlayers.length === 0);

      if (isRoundActive && endCondition) {
        isRoundActive = false;
        gameState = "ROUND_OVER";
        drawGameOver(livingPlayers); // Rysuj ostatni raz, potem wpadnie w case ROUND_OVER
      } else {
        updateWorld(timestamp);
        players.forEach((p) => updatePlayer(p, timestamp));
        renderGame();
      }
      break;
    case "ROUND_OVER":
      renderGame(); // Rysuj zamrożony świat
      drawGameOver(players.filter((p) => p.isAlive)); // Rysuj UI na wierzchu
      break;
  }
}

// ----------------------------------------------------------------------
// --- FUNKCJE POMOCNICZE (Menu, Aktualizacja, Renderowanie) ---
// ----------------------------------------------------------------------

/**
 * Rysuje ekran Menu.
 */
function drawMenu() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.font = "bold 36px Inter";
  ctx.textAlign = "center";
  ctx.fillText("WYBIERZ TRYB GRY", canvas.width / 2, canvas.height / 2 - 150);

  ctx.font = "24px Inter";
  ctx.fillText(
    "Naciśnij [ 1 ] - 1 Gracz (przeciwko botu)",
    canvas.width / 2,
    canvas.height / 2 - 50
  );
  ctx.fillText(
    "Naciśnij [ 2 ] - 2 Graczy (Split-Screen)",
    canvas.width / 2,
    canvas.height / 2
  );
  ctx.fillText(
    "Naciśnij [ 3 ] - 3 Graczy (Split-Screen)",
    canvas.width / 2,
    canvas.height / 2 + 50
  );
  ctx.fillText(
    "Naciśnij [ 4 ] - 4 Graczy (Split-Screen)",
    canvas.width / 2,
    canvas.height / 2 + 100
  );
}

/**
 * Rysuje ekran końca rundy.
 */
function drawGameOver(livingPlayers) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  let winnerText = "REMIS!";

  if (livingPlayers.length === 1) {
    // Jeśli został 1 gracz, on wygrywa
    winnerText = `WYGRYWA GRACZ ${livingPlayers[0].id}!`;
  } else if (numPlayers === 1 && livingPlayers.length === 0) {
    // Jeśli tryb 1-osobowy i gracz 1 nie żyje
    winnerText = "BOT WYGRYWA!";
  }

  ctx.fillStyle = "gold";
  ctx.font = "bold 48px Inter";
  ctx.fillText(winnerText, canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = "white";
  ctx.font = "20px Inter";
  ctx.fillText(
    "Naciśnij R, aby wrócić do Menu",
    canvas.width / 2,
    canvas.height / 2 + 30
  );
}

/**
 * Aktualizuje wszystkie elementy świata (boty, bomby, efekty).
 */
function updateWorld(timestamp) {
  updateIcePatches(timestamp);
  updateFirePatches(timestamp);
  updateBots(timestamp);
  checkBotsOnFire();

  for (const b of bombs) {
    if (b.active) {
      updateBombPhysics(b);
      updateBomb(b, timestamp);
    }
  }
  bombs = bombs.filter((b) => b.active || b.isExploding);
}

/**
 * Główna funkcja renderująca, obsługuje split-screen 1, 2 i 2x2.
 */
function renderGame() {
  if (numPlayers === 1) {
    // --- TRYB 1 GRACZA (Pełny ekran) ---
    const p1 = players[0];
    const camX = p1.worldOffsetX;
    const camY = p1.worldOffsetY;
    drawWorld(camX, camY);
    drawEntities(camX, camY);
    drawEffects(camX, camY);
  } else if (numPlayers === 2) {
    // --- TRYB 2 GRACZY (Podział pionowy) ---
    const p1 = players[0];
    const p2 = players[1];
    const midX = canvas.width / 2; // --- Viewport 1 (Gracz 1 - Lewa strona) ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, midX, canvas.height);
    ctx.clip();
    drawWorld(p1.worldOffsetX, p1.worldOffsetY);
    drawEntities(p1.worldOffsetX, p1.worldOffsetY);
    drawEffects(p1.worldOffsetX, p1.worldOffsetY);
    ctx.restore(); // --- Viewport 2 (Gracz 2 - Prawa strona) ---

    ctx.save();
    ctx.translate(midX, 0);
    ctx.beginPath();
    ctx.rect(0, 0, midX, canvas.height);
    ctx.clip();
    drawWorld(p2.worldOffsetX, p2.worldOffsetY);
    drawEntities(p2.worldOffsetX, p2.worldOffsetY);
    drawEffects(p2.worldOffsetX, p2.worldOffsetY);
    ctx.restore(); // --- Linia podziału ---

    ctx.fillStyle = "black";
    ctx.fillRect(midX - 2, 0, 4, canvas.height);
  } else if (numPlayers >= 3) {
    // --- TRYB 3 LUB 4 GRACZY (Siatka 2x2) ---
    const midX = canvas.width / 2;
    const midY = canvas.height / 2;
    const quadWidth = midX;
    const quadHeight = midY; // --- P1 (Góra-Lewo) ---

    const p1 = players[0];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, quadWidth, quadHeight);
    ctx.clip();
    drawWorld(p1.worldOffsetX, p1.worldOffsetY);
    drawEntities(p1.worldOffsetX, p1.worldOffsetY);
    drawEffects(p1.worldOffsetX, p1.worldOffsetY);
    ctx.restore(); // --- P2 (Góra-Prawo) ---

    const p2 = players[1];
    ctx.save();
    ctx.translate(midX, 0);
    ctx.beginPath();
    ctx.rect(0, 0, quadWidth, quadHeight);
    ctx.clip();
    drawWorld(p2.worldOffsetX, p2.worldOffsetY);
    drawEntities(p2.worldOffsetX, p2.worldOffsetY);
    drawEffects(p2.worldOffsetX, p2.worldOffsetY);
    ctx.restore(); // --- P3 (Dół-Lewo) ---

    const p3 = players[2];
    ctx.save();
    ctx.translate(0, midY);
    ctx.beginPath();
    ctx.rect(0, 0, quadWidth, quadHeight);
    ctx.clip();
    drawWorld(p3.worldOffsetX, p3.worldOffsetY);
    drawEntities(p3.worldOffsetX, p3.worldOffsetY);
    drawEffects(p3.worldOffsetX, p3.worldOffsetY);
    ctx.restore(); // --- P4 (Dół-Prawo) ---

    if (numPlayers === 4) {
      const p4 = players[3];
      ctx.save();
      ctx.translate(midX, midY);
      ctx.beginPath();
      ctx.rect(0, 0, quadWidth, quadHeight);
      ctx.clip();
      drawWorld(p4.worldOffsetX, p4.worldOffsetY);
      drawEntities(p4.worldOffsetX, p4.worldOffsetY);
      drawEffects(p4.worldOffsetX, p4.worldOffsetY);
      ctx.restore();
    } else {
      // Pusty kwadrant dla 3 graczy
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(midX, midY, quadWidth, quadHeight);
    } // --- Linie podziału ---

    ctx.fillStyle = "black";
    ctx.fillRect(midX - 2, 0, 4, canvas.height); // Linia pionowa
    ctx.fillRect(0, midY - 2, canvas.width, 4); // Linia pozioma
  }
}

/**
 * Funkcja pomocnicza do rysowania statycznego tła i bonusów
 */
function drawWorld(worldOffsetX, worldOffsetY) {
  drawIcePatches(worldOffsetX, worldOffsetY);
  drawBlocks(worldOffsetX, worldOffsetY);
  drawFirePatches(worldOffsetX, worldOffsetY);
  drawBonuses(worldOffsetX, worldOffsetY);
}
/**
 * Funkcja pomocnicza do rysowania wszystkich bytów (graczy, botów)
 */
function drawEntities(worldOffsetX, worldOffsetY) {
  drawBots(worldOffsetX, worldOffsetY);
  for (const player of players) {
    drawPlayer(player, worldOffsetX, worldOffsetY);
  }
}
/**
 * Funkcja pomocnicza do rysowania efektów (bomby, wybuchy)
 */
function drawEffects(worldOffsetX, worldOffsetY) {
  for (const b of bombs) {
    if (b.active && !b.isExploding) {
      drawBomb(b, worldOffsetX, worldOffsetY);
    }
  }
  for (const b of bombs) {
    if (b.isExploding) {
      drawExplosion(b.explosionLayout, b, worldOffsetX, worldOffsetY);
    }
  }
}

// ----------------------------------------------------------------------
// --- FUNKCJA: RESTART GRY ---
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// --- FUNKCJA: RESTART GRY ---
// ----------------------------------------------------------------------
function restartGame() {
  gameState = "PLAYING";
  isRoundActive = true;

  allKeysPressed = {};
  bombs = [];
  nextBombId = 0;
  bonuses = [];
  icePatches = [];
  firePatches = [];
  worldBlocks = getInitialWorldBlocks(); // --- RESET I STWORZENIE GRACZY ---

  players = []; // Obliczanie stałych, bezpiecznych pozycji startowych w rogach // (Blok (1,1), (Świat-2, 1), (1, Świat-2), (Świat-2, Świat-2))

  const worldLengthBlocks = Math.floor(WORLD_WIDTH_PX / BOX_SIZE);
  const worldHeightBlocks = Math.floor(WORLD_HEIGHT_PX / BOX_SIZE);
  const padding = BOX_SIZE / 2; // (dla centrowania na bloku)

  const startPositions = [
    // P1: Lewy-górny (Blok 1,1)
    { x: BOX_SIZE * 1 + padding, y: BOX_SIZE * 1 + padding }, // P2: Prawy-górny (Blok Świat-2, 1)
    {
      x: BOX_SIZE * (worldLengthBlocks - 2) + padding,
      y: BOX_SIZE * 1 + padding,
    }, // P3: Lewy-dolny (Blok 1, Świat-2)
    {
      x: BOX_SIZE * 1 + padding,
      y: BOX_SIZE * (worldHeightBlocks - 2) + padding,
    }, // P4: Prawy-dolny (Blok Świat-2, Świat-2)
    {
      x: BOX_SIZE * (worldLengthBlocks - 2) + padding,
      y: BOX_SIZE * (worldHeightBlocks - 2) + padding,
    },
  ]; // --- Ustalanie wymiarów Viewportu ---

  let viewportWidth = canvas.width;
  let viewportHeight = canvas.height;

  if (numPlayers === 2) {
    viewportWidth = canvas.width / 2;
    viewportHeight = canvas.height;
  } else if (numPlayers >= 3) {
    viewportWidth = canvas.width / 2;
    viewportHeight = canvas.height / 2;
  }

  for (let i = 0; i < numPlayers; i++) {
    const pos = startPositions[i];
    const player = createPlayer(
      i + 1,
      playerKeyMaps[i],
      pos.x,
      pos.y,
      PLAYER_TINTS[i],
      viewportWidth,
      viewportHeight
    );
    players.push(player);
  } // --- RESET I STWORZENIE BOTA --- // Bot startuje na środku (co jest bezpieczne)

  bots = [];
  const botStartPos = {
    x: BOX_SIZE * Math.floor(worldLengthBlocks / 2) + padding,
    y: BOX_SIZE * Math.floor(worldHeightBlocks / 2) + padding,
  };
  const newBot = { ...botTemplate };
  newBot.id = 101;
  newBot.worldX = botStartPos.x;
  newBot.worldY = botStartPos.y;
  newBot.isAlive = true;
  newBot.lastAiUpdateTime = performance.now();
  bots.push(newBot);

  statusMessage.textContent = `Gra rozpoczęta dla ${numPlayers} graczy. Walka!`;
  currentStatusElement.textContent = ` Graczy: ${numPlayers}`;
  worldXStatusElement.textContent = "";
  if (worldYStatusElement) worldYStatusElement.textContent = "";
}

// ----------------------------------------------------------------------
// --- OBSŁUGA KLAWIATURY ---
// ----------------------------------------------------------------------

/**
 * Obsługuje wciśnięcia klawiszy w MENU
 */
function handleMenuInput(key) {
  if (key === "1") {
    numPlayers = 1;
    restartGame();
  } else if (key === "2") {
    numPlayers = 2;
    restartGame();
  } else if (key === "3") {
    numPlayers = 3;
    restartGame();
  } else if (key === "4") {
    numPlayers = 4;
    restartGame();
  }
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  const code = event.code; // 1. Kieruj input do odpowiedniego handlera

  if (gameState === "MENU") {
    handleMenuInput(key);
    return;
  }

  if (gameState === "ROUND_OVER" && (key === "r" || code === "KeyR")) {
    gameState = "MENU";
    return;
  }

  if (gameState !== "PLAYING" || !isRoundActive) return; // 2. Logika gry

  allKeysPressed[code] = true;

  for (const player of players) {
    if (!player.isAlive) continue;

    const map = player.keyMap;
    let keyFound = false; // Używamy 'code' dla klawiszy specjalnych i Numpad, 'key' dla liter

    const compareKey = key.length > 1 || key.startsWith("numpad") ? code : key; // Sprawdź ruch

    if (compareKey === map.up) {
      player.keys.up = true;
      keyFound = true;
    }
    if (compareKey === map.down) {
      player.keys.down = true;
      keyFound = true;
    }
    if (compareKey === map.left) {
      player.keys.left = true;
      keyFound = true;
    }
    if (compareKey === map.right) {
      player.keys.right = true;
      keyFound = true;
    } // Sprawdź bombę (zawsze używaj 'code' dla klawiszy akcji)

    const mapBombKey =
      map.bomb === " "
        ? "Space"
        : map.bomb.startsWith("Numpad")
        ? map.bomb
        : map.bomb === "Enter"
        ? "Enter"
        : code; // Domyślnie 'code'

    let isBombKey = false;
    if (map.bomb === " ") {
      isBombKey = code === "Space";
    } else if (map.bomb === "Enter") {
      isBombKey = code === "Enter";
    } else if (map.bomb.startsWith("Numpad")) {
      isBombKey = code === map.bomb;
    } else {
      // Dla liter (np. 'o')
      isBombKey = key === map.bomb;
    }

    if (isBombKey) {
      player.keys.bomb = true;
      keyFound = true;
      if (
        player.currentActiveBombs < player.maxBombs &&
        !player.isChargingThrow
      ) {
        event.preventDefault();
        player.isChargingThrow = true;
        player.spacebarDownTime = performance.now();
      }
    }

    if (player.isSliding && !keyFound) {
      player.keys.up = false;
      player.keys.down = false;
      player.keys.left = false;
      player.keys.right = false;
    }
  }
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();
  const code = event.code;
  allKeysPressed[code] = false;

  if (gameState !== "PLAYING") return;

  for (const player of players) {
    const map = player.keyMap;
    const compareKey = key.length > 1 || key.startsWith("numpad") ? code : key;

    if (compareKey === map.up) player.keys.up = false;
    if (compareKey === map.down) player.keys.down = false;
    if (compareKey === map.left) player.keys.left = false;
    if (compareKey === map.right) player.keys.right = false;

    let isBombKey = false;
    if (map.bomb === " ") {
      isBombKey = code === "Space";
    } else if (map.bomb === "Enter") {
      isBombKey = code === "Enter";
    } else if (map.bomb.startsWith("Numpad")) {
      isBombKey = code === map.bomb;
    } else {
      isBombKey = key === map.bomb;
    }

    if (isBombKey) {
      player.keys.bomb = false;
      if (player.isChargingThrow) {
        event.preventDefault();
        const chargeTime = performance.now() - player.spacebarDownTime;
        const chargePercent = Math.min(chargeTime / MAX_CHARGE_MS, 1.0);
        const throwSpeed = chargePercent * MAX_THROW_SPEED;
        let throwVecX = 0;
        let throwVecY = 0;

        if (player.currentStatus === "left") {
          throwVecX = -1;
        } else if (player.currentStatus === "right") {
          throwVecX = 1;
        } else if (player.currentStatus === "back") {
          throwVecY = -1;
        } else if (player.currentStatus === "front") {
          throwVecY = 1;
        }
        let finalVelX = 0;
        let finalVelY = 0;
        let isThrown = false;

        if (chargePercent < 0.1) {
          isThrown = false;
        } else {
          isThrown = true;
          finalVelX = throwVecX * throwSpeed;
          finalVelY = throwVecY * throwSpeed;
        }
        startBombAnimation(player, finalVelX, finalVelY, isThrown);
        player.isChargingThrow = false;
        player.spacebarDownTime = null;
      }
    }
  }
}

/**
 * Tworzy nową bombę (Bez zmian).
 */
function startBombAnimation(
  player,
  velocityX = 0,
  velocityY = 0,
  isThrown = false
) {
  if (player.currentActiveBombs >= player.maxBombs) {
    player.isChargingThrow = false;
    player.spacebarDownTime = null;
    return;
  }
  player.currentActiveBombs++;
  const newBomb = { ...bombTemplate };
  newBomb.id = nextBombId++;
  newBomb.ownerId = player.id;
  newBomb.active = true;
  newBomb.type = player.bombType;
  newBomb.worldX = player.worldX;
  let startY;
  if (isThrown) {
    startY = player.worldY;
  } else {
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
  bombs.push(newBomb);
}

/**
 * Aktualizuje stan tykania bomby (Bez zmian).
 */
function updateBomb(bombObject, timestamp) {
  if (bombObject.isThrown) return;
  if (bombObject.isExploding) return;
  if (!bombObject.active) return;

  const currentDelay = BOMB_DELAYS[bombObject.frameIndex];
  if (timestamp - bombObject.lastFrameTime > currentDelay) {
    bombObject.lastFrameTime = timestamp;
    bombObject.frameIndex++;

    if (bombObject.frameIndex >= frames.bomb.length) {
      bombObject.active = false;
      if (bombObject.type === "ice") {
        createIcePatch(bombObject.worldX, bombObject.worldY);
      } else if (bombObject.type === "fire") {
        createFirePatch(bombObject.worldX, bombObject.worldY);
      }
      bombObject.isExploding = true;
      bombObject.explosionTime = performance.now();
      bombObject.blocksDestroyed = false;

      const owner = players.find((p) => p.id === bombObject.ownerId);
      const blastRange = owner ? owner.blastRange : BASE_BOMB_EXPLOSION_RANGE;

      if (bombObject.type === "square") {
        bombObject.explosionLayout = generateSquareExplosionLayout(
          bombObject.worldX,
          bombObject.worldY,
          blastRange
        );
      } else {
        bombObject.explosionLayout = generateExplosionLayout(
          bombObject.worldX,
          bombObject.worldY,
          blastRange
        );
      }
    }
  }
}

/**
 * Rysuje bombę (z cieniem i kolorem).
 */
function drawBomb(bombObject, worldOffsetX, worldOffsetY) {
  if (!bombObject.active) return;
  const canvasX = bombObject.worldX - worldOffsetX;
  const canvasY = bombObject.worldY - worldOffsetY;
  const canvasZ = bombObject.z;

  if (
    canvasX + BASE_BOMB_WIDTH < 0 ||
    canvasX - BASE_BOMB_WIDTH > canvas.width ||
    canvasY + BASE_BOMB_HEIGHT < 0 ||
    canvasY - BASE_BOMB_HEIGHT > canvas.height
  ) {
    return;
  }

  const currentFrame = frames.bomb[bombObject.frameIndex];
  const currentSizeFactor = BOMB_SIZES[bombObject.frameIndex];
  const drawW = BASE_BOMB_WIDTH * currentSizeFactor;
  const drawH = BASE_BOMB_HEIGHT * currentSizeFactor;

  const shadowSizeX = BASE_BOMB_WIDTH * 0.6;
  const shadowSizeY = BASE_BOMB_HEIGHT * 0.2;
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(canvasX, canvasY, shadowSizeX, shadowSizeY, 0, 0, Math.PI * 2);
  ctx.fill();

  if (
    currentFrame &&
    currentFrame.complete &&
    currentFrame.naturalWidth !== 0
  ) {
    ctx.save();
    if (bombObject.type === "ice") {
      ctx.filter =
        "sepia(100%) hue-rotate(180deg) saturate(200%) brightness(1.2)";
    } else if (bombObject.type === "fire") {
      ctx.filter =
        "sepia(100%) hue-rotate(-30deg) saturate(500%) brightness(1.1)";
    } else if (bombObject.type === "square") {
      ctx.filter =
        "sepia(100%) hue-rotate(250deg) saturate(300%) brightness(1.1)";
    }
    ctx.drawImage(
      currentFrame,
      canvasX - drawW / 2,
      canvasY + canvasZ - drawH / 1,
      drawW,
      drawH
    );
    ctx.restore();
  }
}

// ----------------------------------------------------------------------
// --- INICJALIZACJA ---
// ----------------------------------------------------------------------
document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);
window.onload = loadFrames;
