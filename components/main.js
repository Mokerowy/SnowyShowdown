// --- components/main.js ---

// =====================================================================
// SEKCJA 1: IMPORTY MODUŁÓW
// =====================================================================

import * as Config from "./config.js";
import { loadGameAssets } from "./assets.js";
import { getInitialWorldBlocks, checkCollision, updateIceWalls } from "./world.js";
import { createPlayer, updatePlayer, drawPlayer, executeTeleport } from "./player.js";
import { createBot, updateBots, drawBots } from "./bot.js";
import * as Projectiles from "./projectiles.js";
import * as Interactions from "./interactions.js";
import * as Drawing from "./drawing.js";


// =====================================================================
// SEKCJA 2: REFERENCJE DOM
// =====================================================================

const canvas = document.getElementById("animationCanvas");
const ctx = canvas.getContext("2d");
const statusMessage = document.getElementById("statusMessage");

// =====================================================================
// SEKCJA 3: ZMIENNE STANU GLOBALNEGO
// =====================================================================

// --- Stan Gry ---
let gameState = "LOADING"; // "LOADING", "MENU", "PLAYING", "ROUND_OVER"
let numPlayers = 1;
let isRoundActive = false;
let allKeysPressed = {};

// --- NOWE ZMIENNE MOTYWU ---
const themes = ["normal", "ice", "fire", "dark"]; // Musi pasować do klas CSS
let currentThemeIndex = 0; // Zaczynamy od "normal"

// --- Zasoby (wypełniane przez assets.js) ---
let frames, boxFrames, bonusFrames;
let assets = {}; // Obiekt przechowujący zasoby

// --- Tablice Bytów i Obiektów Świata ---
let players = [];
let bots = [];
let bombs = [];
let projectiles = []; // Dla śnieżek
let iceWalls = []; // Dla ścian lodu
let worldBlocks = [];
let bonuses = [];
let icePatches = [];
let firePatches = [];

// Liczniki ID
let nextBombId = 0;
let nextProjectileId = 0;

// Obiekt stanu (przekazywany do modułów)
let gameStateObject = {
  players,
  bots,
  bombs,
  projectiles,
  iceWalls,
  worldBlocks,
  bonuses,
  icePatches,
  firePatches,
  frames,
  statusMessage,
};

// =====================================================================
// SEKCJA 4: GŁÓWNA PĘTLA I ZARZĄDZANIE STANEM
// =====================================================================

function updateGameStateObject() {
  // ... (Ta funkcja pozostaje bez zmian) ...
  gameStateObject.players = players;
  gameStateObject.bots = bots;
  gameStateObject.bombs = bombs;
  gameStateObject.projectiles = projectiles;
  gameStateObject.iceWalls = iceWalls;
  gameStateObject.worldBlocks = worldBlocks;
  gameStateObject.bonuses = bonuses;
  gameStateObject.icePatches = icePatches;
  gameStateObject.firePatches = firePatches;
  gameStateObject.frames = frames;
  gameStateObject.statusMessage = statusMessage;
}

function animationLoop(timestamp) {
  document.body.className = `state-${gameState.toLowerCase()}`;
  requestAnimationFrame(animationLoop);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateGameStateObject();

  switch (gameState) {
    case "MENU":
      // Rysujemy menu, ale bez przekazywania motywu (dla prostoty)
      Drawing.drawMenu(ctx);
      break;

    case "PLAYING":
      // ... (Reszta logiki gry, bez zmian) ...
      const livingPlayers = players.filter((p) => p.isAlive);
      const livingBots = bots.filter((b) => b.isAlive);
      let endCondition = false;
      if (numPlayers > 1) {
        endCondition = livingPlayers.length <= 1;
      } else {
        endCondition = livingPlayers.length === 0 || livingBots.length === 0;
      }
      if (isRoundActive && endCondition) {
        isRoundActive = false;
        gameState = "ROUND_OVER";
        renderGame();
        Drawing.drawGameOver(ctx, livingPlayers, livingBots, numPlayers);
      } else {
        updateWorld(timestamp);
        renderGame();
      }
      break;

    case "ROUND_OVER":
      // ... (Bez zmian) ...
      renderGame();
      Drawing.drawGameOver(
        ctx,
        players.filter((p) => p.isAlive),
        bots.filter((b) => b.isAlive),
        numPlayers
      );
      break;
    
    case "LOADING":
      break;
  }
}

function updateWorld(timestamp) {
  // ... (Ta funkcja pozostaje bez zmian) ...
  icePatches = Interactions.updateIcePatches(icePatches, timestamp);
  firePatches = Interactions.updateFirePatches(firePatches, timestamp);
  iceWalls = updateIceWalls(iceWalls);
  players.forEach((p) => updatePlayer(p, timestamp, gameStateObject, statusMessage));
  updateBots(bots, timestamp, gameStateObject);
  bonuses = gameStateObject.bonuses;
  projectiles = Projectiles.updateProjectiles(projectiles, gameStateObject);
  worldBlocks = gameStateObject.worldBlocks;
  bonuses = gameStateObject.bonuses;
  const newBombs = [];
  for (const bomb of bombs) {
    Projectiles.updateBombPhysics(bomb, players);
    const effect = Projectiles.updateBomb(bomb, timestamp, frames);
    if (effect) {
      if (effect.type === "ice") Interactions.createIcePatch(icePatches, effect.x, effect.y);
      if (effect.type === "fire") Interactions.createFirePatch(firePatches, effect.x, effect.y);
    }
    if (bomb.isExploding && !bomb.blocksDestroyed) {
      const owner = players.find((p) => p.id === bomb.ownerId);
      const blastRange = owner ? owner.blastRange : Config.BASE_BOMB_EXPLOSION_RANGE;
      const maxRadius = blastRange * Config.BOX_SIZE + Config.BOX_SIZE / 2;
      const { newWorldBlocks, newBonuses } = Interactions.destroyBlocksInCircle(
        worldBlocks, bonuses, bomb.worldX, bomb.worldY, maxRadius
      );
      worldBlocks = newWorldBlocks;
      bonuses = newBonuses;
      gameStateObject.iceWalls = iceWalls = Interactions.checkEntitiesInCircle(
        gameStateObject, bomb.worldX, bomb.worldY, maxRadius, bomb.type, statusMessage
      );
      statusMessage.textContent = "BOOM!";
      bomb.blocksDestroyed = true;
    }
    if (bomb.isExploding && (performance.now() - bomb.explosionTime > Config.EXPLOSION_DURATION_MS)) {
      const owner = players.find((p) => p.id === bomb.ownerId);
      if (owner) owner.currentActiveBombs--;
    } else {
      newBombs.push(bomb);
    }
  }
  bombs = newBombs;
  gameStateObject.worldBlocks = worldBlocks;
  gameStateObject.bonuses = bonuses;
}

function renderGame() {
  // ... (Ta funkcja pozostaje bez zmian) ...
  const drawState = { players, bots, bombs, projectiles, iceWalls, worldBlocks, bonuses, icePatches, firePatches };
  const drawAssets = { frames, boxFrames, bonusFrames };
  if (numPlayers === 1) {
    const p1 = players[0];
    const camX = p1.worldOffsetX;
    const camY = p1.worldOffsetY;
    Drawing.drawWorld(ctx, drawState, drawAssets, camX, camY);
    Drawing.drawEntities(ctx, drawState, drawAssets, camX, camY);
    Drawing.drawEffects(ctx, drawState, drawAssets, camX, camY);
  } else if (numPlayers === 2) {
    const p1 = players[0];
    const p2 = players[1];
    const midX = canvas.width / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, midX, canvas.height); ctx.clip();
    Drawing.drawWorld(ctx, drawState, drawAssets, p1.worldOffsetX, p1.worldOffsetY);
    Drawing.drawEntities(ctx, drawState, drawAssets, p1.worldOffsetX, p1.worldOffsetY);
    Drawing.drawEffects(ctx, drawState, drawAssets, p1.worldOffsetX, p1.worldOffsetY);
    ctx.restore();
    ctx.save();
    ctx.translate(midX, 0);
    ctx.beginPath(); ctx.rect(0, 0, midX, canvas.height); ctx.clip();
    Drawing.drawWorld(ctx, drawState, drawAssets, p2.worldOffsetX, p2.worldOffsetY);
    Drawing.drawEntities(ctx, drawState, drawAssets, p2.worldOffsetX, p2.worldOffsetY);
    Drawing.drawEffects(ctx, drawState, drawAssets, p2.worldOffsetX, p2.worldOffsetY);
    ctx.restore();
    ctx.fillStyle = "black";
    ctx.fillRect(midX - 2, 0, 4, canvas.height);
  } else if (numPlayers >= 3) {
    const midX = canvas.width / 2;
    const midY = canvas.height / 2;
    const p1 = players[0];
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, midX, midY); ctx.clip();
    Drawing.drawWorld(ctx, drawState, drawAssets, p1.worldOffsetX, p1.worldOffsetY);
    Drawing.drawEntities(ctx, drawState, drawAssets, p1.worldOffsetX, p1.worldOffsetY);
    Drawing.drawEffects(ctx, drawState, drawAssets, p1.worldOffsetX, p1.worldOffsetY);
    ctx.restore();
    const p2 = players[1];
    ctx.save();
    ctx.translate(midX, 0);
    ctx.beginPath(); ctx.rect(0, 0, midX, midY); ctx.clip();
    Drawing.drawWorld(ctx, drawState, drawAssets, p2.worldOffsetX, p2.worldOffsetY);
    Drawing.drawEntities(ctx, drawState, drawAssets, p2.worldOffsetX, p2.worldOffsetY);
    Drawing.drawEffects(ctx, drawState, drawAssets, p2.worldOffsetX, p2.worldOffsetY);
    ctx.restore();
    const p3 = players[2];
    ctx.save();
    ctx.translate(0, midY);
    ctx.beginPath(); ctx.rect(0, 0, midX, midY); ctx.clip();
    Drawing.drawWorld(ctx, drawState, drawAssets, p3.worldOffsetX, p3.worldOffsetY);
    Drawing.drawEntities(ctx, drawState, drawAssets, p3.worldOffsetX, p3.worldOffsetY);
    Drawing.drawEffects(ctx, drawState, drawAssets, p3.worldOffsetX, p3.worldOffsetY);
    ctx.restore();
    if (numPlayers === 4) {
      const p4 = players[3];
      ctx.save();
      ctx.translate(midX, midY);
      ctx.beginPath(); ctx.rect(0, 0, midX, midY); ctx.clip();
      Drawing.drawWorld(ctx, drawState, drawAssets, p4.worldOffsetX, p4.worldOffsetY);
      Drawing.drawEntities(ctx, drawState, drawAssets, p4.worldOffsetX, p4.worldOffsetY);
      Drawing.drawEffects(ctx, drawState, drawAssets, p4.worldOffsetX, p4.worldOffsetY);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(midX, midY, midX, midY);
    }
    ctx.fillStyle = "black";
    ctx.fillRect(midX - 2, 0, 4, canvas.height);
    ctx.fillRect(0, midY - 2, canvas.width, 4);
  }
}

// =====================================================================
// SEKCJA 5: RESTART GRY
// =====================================================================

function restartGame() {
  // ... (Ta funkcja pozostaje bez zmian) ...
  gameState = "PLAYING";
  isRoundActive = true;
  allKeysPressed = {};
  bombs = []; projectiles = []; iceWalls = []; bonuses = [];
  icePatches = []; firePatches = []; players = []; bots = [];
  nextBombId = 0; nextProjectileId = 0;
  worldBlocks = getInitialWorldBlocks();
  const worldLengthBlocks = Math.floor(Config.WORLD_WIDTH_PX / Config.BOX_SIZE);
  const worldHeightBlocks = Math.floor(Config.WORLD_HEIGHT_PX / Config.BOX_SIZE);
  const padding = Config.BOX_SIZE / 2;
  const startPositions = [
    { x: Config.BOX_SIZE * 1 + padding, y: Config.BOX_SIZE * 1 + padding },
    { x: Config.BOX_SIZE * (worldLengthBlocks - 2) + padding, y: Config.BOX_SIZE * 1 + padding },
    { x: Config.BOX_SIZE * 1 + padding, y: Config.BOX_SIZE * (worldHeightBlocks - 2) + padding },
    { x: Config.BOX_SIZE * (worldLengthBlocks - 2) + padding, y: Config.BOX_SIZE * (worldHeightBlocks - 2) + padding },
  ];
  let viewportWidth = canvas.width, viewportHeight = canvas.height;
  if (numPlayers === 2) viewportWidth = canvas.width / 2;
  else if (numPlayers >= 3) {
    viewportWidth = canvas.width / 2;
    viewportHeight = canvas.height / 2;
  }
  for (let i = 0; i < numPlayers; i++) {
    const pos = startPositions[i];
    players.push(createPlayer(
      i + 1,
      Config.playerKeyMaps[i],
      pos.x,
      pos.y,
      Config.PLAYER_TINTS[i],
      viewportWidth,
      viewportHeight
    ));
  }
  const botStartPos = {
    x: Config.BOX_SIZE * Math.floor(worldLengthBlocks / 2) + padding,
    y: Config.BOX_SIZE * Math.floor(worldHeightBlocks / 2) + padding,
  };
  bots.push(createBot(101, botStartPos.x, botStartPos.y));
  statusMessage.textContent = `Gra rozpoczęta dla ${numPlayers} graczy. Walka!`;
}

// =====================================================================
// SEKCJA 6: OBSŁUGA WEJŚCIA (KLAWIATURA)
// =====================================================================

function handleMenuInput(key) {
  if (key === "1") numPlayers = 1;
  else if (key === "2") numPlayers = 2;
  else if (key === "3") numPlayers = 3;
  else if (key === "4") numPlayers = 4;
  else return;
  restartGame();
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  const code = event.code;

  if (gameState === "MENU") { 
    handleMenuInput(key); // Obsługa 1-4

    // --- NOWA LOGIKA MOTYWU (Klawisz "T") ---
    if (key === "t" || code === "KeyT") {
      // Przełącz na następny motyw w tablicy
      currentThemeIndex = (currentThemeIndex + 1) % themes.length;
      const newTheme = themes[currentThemeIndex];
      
      // Bezpośrednio zmień klasę CSS na elemencie canvas
      canvas.className = `theme-${newTheme}`;
    }
    // --- KONIEC NOWEJ LOGIKI ---

    return; // Ważne, aby nie kontynuować
  }
  if (gameState === "ROUND_OVER" && (key === "r" || code === "KeyR")) { gameState = "MENU"; return; }
  if (gameState !== "PLAYING" || !isRoundActive) return;

  allKeysPressed[code] = true;

  for (const player of players) {
    // ... (Reszta logiki sterowania graczem, bez zmian) ...
    if (!player.isAlive || player.isStunned) continue;
    const map = player.keyMap;
    const compareKey = key.length > 1 || key.startsWith("numpad") ? code : key;
    if (compareKey === map.up) player.keys.up = true;
    if (compareKey === map.down) player.keys.down = true;
    if (compareKey === map.left) player.keys.left = true;
    if (compareKey === map.right) player.keys.right = true;
    if (compareKey === map.switch && !player.keys.switch) {
      player.keys.switch = true;
      switch (player.bombType) {
        case "ice":
          if (player.currentFireBombs > 0) {
            player.bombType = "fire";
            statusMessage.textContent = `Gracz ${player.id}: BOMBY OGNISTE (${player.currentFireBombs})`;
          } else {
            player.bombType = "cannon";
            statusMessage.textContent = `Gracz ${player.id}: ARMATA ŚNIEŻNA (${Config.STARTING_SNOWBALLS === Infinity ? '∞' : player.currentSnowballs})`;
          }
          break;
        case "fire":
          player.bombType = "cannon";
          statusMessage.textContent = `Gracz ${player.id}: ARMATA ŚNIEŻNA (${Config.STARTING_SNOWBALLS === Infinity ? '∞' : player.currentSnowballs})`;
          break;
        case "cannon":
          player.bombType = "snowthrower";
          statusMessage.textContent = `Gracz ${player.id}: MIOTACZ ŚNIEGU (${Math.floor(player.currentSnowthrowerFuel)}%)`;
          break;
        case "snowthrower":
          player.bombType = "ice";
          statusMessage.textContent = `Gracz ${player.id}: BOMBY LODOWE (∞)`;
          break;
      }
    }
    let isBombKey = (map.bomb === " " && code === "Space") ||
                    (map.bomb === "Enter" && code === "Enter") ||
                    (map.bomb.startsWith("Numpad") && code === map.bomb) ||
                    (key === map.bomb);
    if (isBombKey) {
      player.keys.bomb = true;
      if (player.bombType === "cannon") {
        if (player.currentSnowballs > 0 && !player.isChargingThrow) {
          event.preventDefault();
          player.isChargingThrow = true;
          player.spacebarDownTime = performance.now();
          const newProjectile = Projectiles.throwProjectileOrBomb(player, 0, 0, false, nextProjectileId++, statusMessage);
          if (newProjectile) projectiles.push(newProjectile.data);
        }
      } else if (player.bombType === "snowthrower") {
        if (player.currentSnowthrowerFuel > 0 && !player.isChargingThrow && !player.isFiring) {
          event.preventDefault();
          player.isChargingThrow = true;
          player.spacebarDownTime = performance.now();
        }
      } else {
        const hasAmmo = (player.bombType === "fire" && player.currentFireBombs > 0) || player.bombType === "ice";
        if (hasAmmo && player.currentActiveBombs < player.maxBombs && !player.isChargingThrow) {
          event.preventDefault();
            player.isChargingThrow = true;
          player.spacebarDownTime = performance.now();
        }
      }
    }
    if (compareKey === map.wall) {
      const newWall = Projectiles.createIceWall(player, gameStateObject, statusMessage);
      if (newWall) {
        iceWalls.push(newWall);
      }
    }
    if (compareKey === map.teleport) {
      event.preventDefault();
      executeTeleport(player, gameStateObject, statusMessage);
    }
  }
}

function handleKeyUp(event) {
  // ... (Ta funkcja pozostaje bez zmian) ...
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
    if (compareKey === map.switch) player.keys.switch = false;
    let isBombKey = (map.bomb === " " && code === "Space") ||
                    (map.bomb === "Enter" && code === "Enter") ||
                    (map.bomb.startsWith("Numpad") && code === map.bomb) ||
                    (key === map.bomb);
    if (isBombKey) {
      player.keys.bomb = false;
      if (player.bombType === "cannon") {
        if (player.isChargingThrow) {
          const timeHeld = performance.now() - player.spacebarDownTime;
          const minDelay = Config.CANNON_COOLDOWN_MS;
          if (timeHeld < minDelay) {
            setTimeout(() => { player.isChargingThrow = false; }, minDelay - timeHeld);
          } else {
            player.isChargingThrow = false;
          }
        }
      } else if (player.bombType === "snowthrower") {
        if (player.isChargingThrow && !player.isFiring) {
            player.isChargingThrow = false;
            player.spacebarDownTime = null;
        }
      } else if (player.isChargingThrow) {
        event.preventDefault();
        const chargeTime = performance.now() - player.spacebarDownTime;
        const chargePercent = Math.min(chargeTime / Config.MAX_CHARGE_MS, 1.0);
        const throwSpeed = chargePercent * Config.MAX_THROW_SPEED;
        let throwVecX = 0, throwVecY = 0;
        if (player.currentStatus === "left") throwVecX = -1;
        else if (player.currentStatus === "right") throwVecX = 1;
        else if (player.currentStatus === "back") throwVecY = -1;
        else if (player.currentStatus === "front") throwVecY = 1;
        let finalVelX = 0, finalVelY = 0, isThrown = false;
        if (chargePercent > 0.1) {
          isThrown = true;
          finalVelX = throwVecX * throwSpeed;
          finalVelY = throwVecY * throwSpeed;
        }
        const newBomb = Projectiles.throwProjectileOrBomb(player, finalVelX, finalVelY, isThrown, nextBombId++, statusMessage);
        if (newBomb) {
          bombs.push(newBomb.data);
        } else if (player.currentActiveBombs >= player.maxBombs) {
        } else {
        }
        player.isChargingThrow = false;
        player.spacebarDownTime = null;
      }
    }
  }
}

// =====================================================================
// SEKCJA 7: PUNKT STARTOWY I OBSŁUGA OKNA
// =====================================================================

function resizeCanvas() {
  // ... (Ta funkcja pozostaje bez zmian) ...
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (gameState === "PLAYING") {
    let viewportWidth = canvas.width;
    let viewportHeight = canvas.height;
    if (numPlayers === 2) viewportWidth = canvas.width / 2;
    else if (numPlayers >= 3) {
      viewportWidth = canvas.width / 2;
      viewportHeight = canvas.height / 2;
    }
    for (const player of players) {
      player.viewportWidth = viewportWidth;
      player.viewportHeight = viewportHeight;
    }
  }
}

// Usunąłem funkcję updateThemeClass, bo jest teraz wewnątrz handleKeyDown

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);

window.onload = async () => {
  try {
    gameState = "LOADING";
    statusMessage.textContent = "Ładowanie klatek...";
    
    resizeCanvas();
    
    const loadedAssets = await loadGameAssets(statusMessage);
    frames = loadedAssets.frames;
    boxFrames = loadedAssets.boxFrames;
    bonusFrames = loadedAssets.bonusFrames;
    assets = { frames, boxFrames, bonusFrames };

    worldBlocks = getInitialWorldBlocks();
    
    gameState = "MENU";
    statusMessage.textContent = "Wszystkie klatki załadowane. Wybierz tryb gry.";
    
    // --- NOWE: Ustaw domyślny motyw przy starcie ---
    canvas.className = `theme-${themes[currentThemeIndex]}`; // Ustawi .theme-normal

    requestAnimationFrame(animationLoop);

  } catch (error) {
    console.error("Nie udało się załadować zasobów gry:", error);
    statusMessage.textContent = "Błąd krytyczny podczas ładowania zasobów.";
    gameState = "ERROR";
  }
};

window.addEventListener('resize', resizeCanvas);