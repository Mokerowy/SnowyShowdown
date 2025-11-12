// --- components/config.js ---

// =====================================================================
// SEKCJA 1: PODSTAWOWE STAŁE ŚWIATA I FIZYKI
// =====================================================================

// --- ŚWIAT I BLOKI ---
export const BOX_SIZE = 40;
export const WORLD_WIDTH_PX = 1500;
export const WORLD_HEIGHT_PX = 1500;
export const groundY = WORLD_HEIGHT_PX - BOX_SIZE;

// --- ANIMACJA I RUCH ---
export const frameDelayMs = 50;
export const BASE_MOVE_SPEED = 2;
export const SPEED_BOOST_AMOUNT = 0.5; // Mniejszy bonus (było 1.0)
export const MAX_MOVE_SPEED = BASE_MOVE_SPEED * 2;

// --- BONUSY ---
export const BONUS_SIZE = 20;
export const BONUS_PICKUP_RANGE = 30;

// =====================================================================
// SEKCJA 2: STAŁE JEDNOSTEK (GRACZ I BOT)
// =====================================================================

export const PLAYER_DRAW_WIDTH = 30;
export const PLAYER_DRAW_HEIGHT = 30;
export const PLAYER_TINTS = [
  "hue-rotate(0deg) saturate(100%)", // P1
  "hue-rotate(120deg) saturate(200%)", // P2
  "hue-rotate(240deg) saturate(200%)", // P3
  "hue-rotate(60deg) saturate(200%)", // P4
];

export const BOT_DRAW_WIDTH = 30;
export const BOT_DRAW_HEIGHT = 30;
export const BOT_MOVE_SPEED = 12;
export const BOT_AI_UPDATE_MS = 500;

// =====================================================================
// SEKCJA 3: SYSTEM BRONI
// =====================================================================

// --- WSPÓLNE DLA BRONI ---
export const MAX_CHARGE_MS = 1000; // Do rzutu bombą
export const MAX_THROW_SPEED = 20; // Do rzutu bombą

// --- BOMBY (LÓD I OGIEŃ) ---
export const BASE_BOMB_WIDTH = PLAYER_DRAW_WIDTH;
export const BASE_BOMB_HEIGHT = PLAYER_DRAW_HEIGHT;
export const BOMB_LOB_VELOCITY_Z = -12;
export const BOMB_LOB_GRAVITY = 0.5;
export const BOMB_FRICTION = 0.96;
export const BASE_BOMB_EXPLOSION_RANGE = 2;
export const EXPLOSION_DURATION_MS = 400;
export const BOMB_DELAYS = [150, 100, 50, 50];
export const BOMB_SIZES = [0.7, 0.8, 0.9, 1.2];
export const STARTING_FIRE_BOMBS = 3;

// --- ARMATKA ŚNIEŻNA (SNOWBALL CANNON) ---
export const SNOWBALL_SPEED = 14;
export const SNOWBALL_SIZE = 15;
export const CANNON_COOLDOWN_MS = 200;
export const STARTING_SNOWBALLS = Infinity;

// --- MIOTACZ ŚNIEGU (SNOWTHROWER) --- (NOWA SEKCJA)
export const STARTING_SNOWTHROWER_FUEL = 500;
export const SNOWTHROWER_FUEL_REGEN_RATE = 1.5; // Paliwo na klatkę
export const SNOWTHROWER_FUEL_COST = 1.5; // Paliwo zużywane na klatkę strzału
export const SNOWTHROWER_CHARGE_MS = 1000; // Czas ładowania przed strzałem
export const SNOWTHROWER_FIRE_DURATION_MS = 3000;
export const SNOWTHROWER_RANGE = 160; // Długość strumienia
export const SNOWTHROWER_WIDTH = 50; // Szerokość strumienia
export const SNOWTHROWER_FREEZE_PER_TICK = 5; // Zamrożenie na klatkę trafienia

// --- ŚCIANA LODU ---
export const STARTING_ICE_WALLS = 5;
export const ICE_WALL_COOLDOWN_MS = 1000;
export const ICE_WALL_DURATION_MS = 8000;
export const ICE_WALL_FREEZE_POWER = 60;
export const ICE_WALL_REGEN_MS = 10000;
export const TELEPORT_DISTANCE = 150; // Dystans w pikselach (ok. 3-4 bloki)
export const TELEPORT_COOLDOWN_MS = 3000;

// =====================================================================
// SEKCJA 4: SYSTEM EFEKTÓW (KRIO / ZAMRAŻANIE)
// =====================================================================

export const PATCH_EFFECT_INTERVAL_MS = 250;
export const ICE_PATCH_DURATION_MS = 5000;
export const ICE_PATCH_RADIUS = BOX_SIZE * 1.5;
export const ICE_PATCH_FREEZE_PER_TICK = 2.5;
export const FIRE_PATCH_DURATION_MS = 3000;
export const FIRE_PATCH_RADIUS = BOX_SIZE * 1.5;
export const FIRE_PATCH_UNFREEZE_PER_TICK = 5;

export const MAX_FREEZE_LEVEL = 100;
export const STUN_DURATION_MS = 2500;
export const PASSIVE_UNFREEZE_RATE = 0.1;

export const FREEZE_EFFECTS = {
  normal: { player: 30, bot: 30 },
  ice: { player: 45, bot: 45 },
  fire: { player: -50, bot: -50 },
  cannon: { player: 40, bot: 40 },
  snowthrower: {
    player: SNOWTHROWER_FREEZE_PER_TICK,
    bot: SNOWTHROWER_FREEZE_PER_TICK,
  }, // NOWY
};

// =====================================================================
// SEKCJA 5: ZASOBY I MAPOWANIA
// =====================================================================

export const BOX_SOURCES = [
  "./assets/box-01.png",
  "./assets/snowBox-02.png",
  "./assets/snowBox-03.png",
  "./assets/box-04.png",
];

export const BONUS_SOURCES = {
  bombType_fire: "./assets/buff-01.png",
  extraBomb: "./assets/buff-02.png",
  speedBoost: "./assets/buff-05.png",
};

export const playerKeyMaps = [
  {
    up: "w",
    down: "s",
    left: "a",
    right: "d",
    bomb: " ",
    switch: "q",
    wall: "x",
    teleport: "c",
  },
  {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    bomb: "Enter",
    switch: ".",
    wall: "m",
    teleport: ",",
  },
  {
    up: "i",
    down: "k",
    left: "j",
    right: "l",
    bomb: "o",
    switch: "u",
    wall: "p",
    teleport: "b",
  },
  {
    up: "Numpad8",
    down: "Numpad5",
    left: "Numpad4",
    right: "Numpad6",
    bomb: "Numpad0",
    switch: "Numpad7",
    wall: "Numpad3",
    teleport: "Numpad9",
  },
];

export const frameSourcesMap = {
  // ... (front, back, left, right, bomb, bot bez zmian)
  back: [
    "./assets/duck-back-01.png",
    "./assets/duck-back-02.png",
    "./assets/duck-back-03.png",
    "./assets/duck-back2-01.png",
    "./assets/duck-back2-02.png",
    "./assets/duck-back2-03.png",
  ],
  front: [
    "./assets/duck-front-01.png",
    "./assets/duck-front-02.png",
    "./assets/duck-front-03.png",
    "./assets/duck-front2-01.png",
    "./assets/duck-front2-02.png",
    "./assets/duck-front2-03.png",
  ],
  left: [
    "./assets/duck-left-02.png",
    "./assets/duck-left-03.png",
    "./assets/duck-left-04.png",
    "./assets/duck-left-05.png",
    "./assets/duck-left-04.png",
    "./assets/duck-left-03.png",
    "./assets/duck-left-02.png",
  ],
  right: [
    "./assets/duck-right-03.png",
    "./assets/duck-right-02.png",
    "./assets/duck-right-01.png",
    "./assets/duck-right-02.png",
    "./assets/duck-right-03.png",
    "./assets/duck-right-04.png",
  ],
  bomb: [
    "./assets/bomb-01.png",
    "./assets/bomb-02.png",
    "./assets/bomb-03.png",
    "./assets/bomb-04.png",
  ],
  bot: [
    "./assets/duck-front-01.png",
    "./assets/duck-front-02.png",
    "./assets/duck-front-03.png",
  ],

  cannon: {
    back: "./assets/snowBallCannon-up.png",
    front: "./assets/snowBallCannon-down.png",
    left: "./assets/snowBallCannon-left.png",
    right: "./assets/snowBallCannon-right.png",
  },
  snowball: ["./assets/snowBall.png"],

  // --- NOWY ZASÓB: MIOTACZ ŚNIEGU ---
  // Zakładam, że masz 4 kierunki, tak jak dla armatki
  // Jeśli masz tylko jeden obrazek, zduplikuj go
  snowthrower: {
    back: "./assets/snowThrower-up.png",
    front: "./assets/snowThrower-down.png",
    left: "./assets/snowThrower-left.png",
    right: "./assets/snowThrower-right.png",
  },
};
