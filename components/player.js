// --- components/player.js ---

import {
  // Stałe Gracza
  PLAYER_DRAW_WIDTH,
  PLAYER_DRAW_HEIGHT,
  BASE_MOVE_SPEED,
  BASE_BOMB_EXPLOSION_RANGE,
  STARTING_FIRE_BOMBS,
  STARTING_SNOWBALLS,
  STARTING_ICE_WALLS,
  // Stałe Świata
  WORLD_WIDTH_PX,
  WORLD_HEIGHT_PX,
  // Stałe Krio
  MAX_FREEZE_LEVEL,
  STUN_DURATION_MS,
  PASSIVE_UNFREEZE_RATE,
  PATCH_EFFECT_INTERVAL_MS,
  FIRE_PATCH_UNFREEZE_PER_TICK,
  ICE_PATCH_FREEZE_PER_TICK,
  // Stałe Rzucania
  MAX_CHARGE_MS,
  // Stałe Animacji
  frameDelayMs,
  // Stałe Umiejętności
  ICE_WALL_REGEN_MS,
  TELEPORT_DISTANCE,
  TELEPORT_COOLDOWN_MS,
  // Stałe Miotacza Śniegu
  STARTING_SNOWTHROWER_FUEL,
  SNOWTHROWER_FUEL_REGEN_RATE,
  SNOWTHROWER_CHARGE_MS,
  SNOWTHROWER_FUEL_COST,
  SNOWTHROWER_FIRE_DURATION_MS, // <-- NOWY IMPORT
} from "./config.js";

// Funkcje z innych modułów
import { checkCollision } from "./world.js";
import {
  checkEntityOnIce,
  checkEntityOnFire,
  checkPlayerBotCollision,
  checkAndCollectBonuses,
  applySnowthrowerHit, // Importujemy funkcję obrażeń
} from "./interactions.js";

// --- Szablon Gracza (Zaktualizowany) ---
const playerTemplate = {
  id: null,
  worldX: 100,
  worldY: 100,
  worldOffsetX: 0,
  worldOffsetY: 0,
  viewportWidth: 0,
  viewportHeight: 0,
  isAlive: true,
  currentStatus: "front",
  currentFrameIndex: 0,
  lastFrameTime: 0,
  drawWidth: PLAYER_DRAW_WIDTH,
  drawHeight: PLAYER_DRAW_HEIGHT,
  keys: {
    up: false, down: false, left: false, right: false,
    bomb: false, switch: false, wall: false, teleport: false,
  },
  keyMap: null,
  tint: "",
  // Statystyki Podstawowe
  moveSpeed: BASE_MOVE_SPEED,
  blastRange: BASE_BOMB_EXPLOSION_RANGE,
  maxBombs: 1,
  currentActiveBombs: 0,
  // Bronie i Amunicja
  bombType: "ice",
  currentFireBombs: STARTING_FIRE_BOMBS,
  currentSnowballs: STARTING_SNOWBALLS,
  currentSnowthrowerFuel: STARTING_SNOWTHROWER_FUEL,
  iceWallAmmo: STARTING_ICE_WALLS,
  lastIceWallTime: 0,
  lastIceWallRegenTime: 0,
  // Rzucanie / Strzelanie
  isChargingThrow: false,
  spacebarDownTime: null,
  isFiring: false, // Używane przez miotacz
  fireEndTime: 0, // <-- NOWA ZMIENNA (dla czasu trwania miotacza)
  lastTeleportTime: 0,
  // System Krio
  lastPatchEffectTime: 0,
  freezeLevel: 0,
  isStunned: false,
  stunEndTime: 0,
  baseFreezeLevel: 0,
};

// =====================================================================
// SEKCJA 1: TWORZENIE GRACZA I LOGIKA UMIEJĘTNOŚCI
// =====================================================================

/**
 * Tworzy i zwraca nowy obiekt gracza.
 */
export function createPlayer(id, keyMap, startX, startY, tint, viewportW, viewportH) {
  const player = { ...playerTemplate };
  player.id = id;
  player.keyMap = keyMap;
  player.worldX = startX;
  player.worldY = startY;
  player.tint = tint;
  player.keys = {
    up: false, down: false, left: false, right: false,
    bomb: false, switch: false, wall: false, teleport: false,
  };
  player.viewportWidth = viewportW;
  player.viewportHeight = viewportH;
  player.worldOffsetX = startX - viewportW / 2;
  player.worldOffsetY = startY - viewportH / 2;
  // Reset stanu Krio i Amunicji
  player.currentFireBombs = STARTING_FIRE_BOMBS;
  player.currentSnowballs = STARTING_SNOWBALLS;
  player.currentSnowthrowerFuel = STARTING_SNOWTHROWER_FUEL;
  player.iceWallAmmo = STARTING_ICE_WALLS;
  player.lastIceWallRegenTime = performance.now();
  player.lastTeleportTime = 0;
  player.freezeLevel = 0;
  player.isStunned = false;
  player.isFiring = false;
  player.fireEndTime = 0; // <-- NOWE
  return player;
}

/**
 * Wykonuje logikę teleportacji dla gracza.
 */
export function executeTeleport(player, state, statusMessage) {
  const now = performance.now();
  if (now - player.lastTeleportTime < TELEPORT_COOLDOWN_MS) {
    statusMessage.textContent = `Gracz ${player.id}: Teleportacja się ładuje!`;
    return;
  }
  let targetX = player.worldX, targetY = player.worldY;
  const distance = TELEPORT_DISTANCE;
  switch (player.currentStatus) {
    case "back":  targetY -= distance; break;
    case "front": targetY += distance; break;
    case "left":  targetX -= distance; break;
    case "right": targetX += distance; break;
    default:      targetY += distance;
  }
  if (
    targetX < player.drawWidth / 2 || targetX > WORLD_WIDTH_PX - player.drawWidth / 2 ||
    targetY < player.drawHeight / 2 || targetY > WORLD_HEIGHT_PX - player.drawHeight / 2
  ) {
    statusMessage.textContent = `Gracz ${player.id}: Nie można teleportować się poza mapę!`;
    return;
  }
  const { worldBlocks, iceWalls } = state;
  if (checkCollision(targetX, targetY, player.drawWidth, player.drawHeight, worldBlocks, iceWalls)) {
    statusMessage.textContent = `Gracz ${player.id}: Nie można teleportować się w ścianę!`;
    return;
  }
  player.worldX = targetX;
  player.worldY = targetY;
  player.lastTeleportTime = now;
  statusMessage.textContent = `Gracz ${player.id} teleportował się!`;
}

// =====================================================================
// SEKCJA 2: AKTUALIZACJA STANU GRACZA (LOGIKA)
// =====================================================================

/**
 * Aktualizuje logikę miotacza śniegu (ładowanie, strzelanie, paliwo).
 * (NOWA LOGIKA "NAŁADUJ I STRZEL")
 */
function updateSnowthrower(player, timestamp, state) {
  
  // 1. Faza Strzelania
  if (player.isFiring) {
    // Sprawdź warunki zatrzymania: brak paliwa LUB koniec czasu
    if (player.currentSnowthrowerFuel <= 0 || timestamp > player.fireEndTime) {
      player.isFiring = false;
      player.fireEndTime = 0;
      return; // Zatrzymaj strzelanie
    }
    
    // Zużyj paliwo i zastosuj obrażenia
    player.currentSnowthrowerFuel = Math.max(0, player.currentSnowthrowerFuel - SNOWTHROWER_FUEL_COST);
    applySnowthrowerHit(player, state); // Zastosuj obrażenia (z interactions.js)

  } 
  // 2. Faza Ładowania (tylko jeśli nie strzela)
  else if (player.isChargingThrow) {
    const chargeTime = timestamp - player.spacebarDownTime;
    if (chargeTime >= SNOWTHROWER_CHARGE_MS) {
      // Ładowanie zakończone, rozpocznij strzał!
      player.isFiring = true;
      player.isChargingThrow = false; // Zakończ ładowanie
      player.fireEndTime = timestamp + SNOWTHROWER_FIRE_DURATION_MS; // Ustaw czas końca strzału
      // Nie resetuj spacebarDownTime, handleKeyUp musi wiedzieć, że ładowanie się udało
    }
    // Jeśli gracz puści klawisz W TRAKCIE ładowania, handleKeyUp to anuluje.
    
  } 
  // 3. Faza Regeneracji (tylko jeśli nic nie robi)
  else if (!player.isChargingThrow && !player.isFiring) {
    if (player.currentSnowthrowerFuel < STARTING_SNOWTHROWER_FUEL) {
      player.currentSnowthrowerFuel = Math.min(
        STARTING_SNOWTHROWER_FUEL,
        player.currentSnowthrowerFuel + SNOWTHROWER_FUEL_REGEN_RATE
      );
    }
  }
}


/**
 * Aktualizuje stan gracza (ruch, krio, stun, animacja, kamera).
 */
export function updatePlayer(player, timestamp, state, statusMessage) {
  if (!player.isAlive) return;

  // --- 1. Logika Regeneracji Zasobów ---
  if (player.iceWallAmmo < STARTING_ICE_WALLS) {
    if (timestamp - player.lastIceWallRegenTime > ICE_WALL_REGEN_MS) {
      player.iceWallAmmo++;
      player.lastIceWallRegenTime = timestamp;
    }
  }

  // --- 2. Logika Stanu (Stun i Odmrażanie) ---
  if (player.isStunned) {
    if (timestamp > player.stunEndTime) {
      player.isStunned = false;
    }
    player.keys.up = player.keys.down = player.keys.left = player.keys.right = false;
    player.keys.bomb = false;
    player.isChargingThrow = false;
    player.isFiring = false; // Stun anuluje miotacz
    player.spacebarDownTime = null;
  }

  if (!player.isStunned && player.freezeLevel > 0) {
    player.freezeLevel = Math.max(0, player.freezeLevel - PASSIVE_UNFREEZE_RATE);
  }

  // --- 3. Logika Broni (Miotacz Śniegu) ---
  if (player.bombType === "snowthrower") {
    updateSnowthrower(player, timestamp, state);
  }

  // --- 4. Obliczenie Płynnego Spowolnienia ---
  const freezePercent = player.freezeLevel / MAX_FREEZE_LEVEL;
  let speedModifier = 1.0 - freezePercent;
  if (player.isFiring) { // Miotacz spowalnia
    speedModifier *= 0.5;
  }
  let currentMoveSpeed = player.moveSpeed * Math.max(0, speedModifier);

  // --- 5. Logika Efektów Strefowych (Lód/Ogień) ---
  const { worldBlocks, icePatches, firePatches, bots, iceWalls } = state;
  const isOnIce = checkEntityOnIce(player.worldX, player.worldY, player.drawHeight, icePatches);
  const isOnFire = checkEntityOnFire(player.worldX, player.worldY, player.drawWidth, player.drawHeight, firePatches);

  if (
    (isOnIce || isOnFire) &&
    timestamp - player.lastPatchEffectTime > PATCH_EFFECT_INTERVAL_MS
  ) {
    player.lastPatchEffectTime = timestamp;
    if (isOnFire) {
      player.freezeLevel = Math.max(0, player.freezeLevel - FIRE_PATCH_UNFREEZE_PER_TICK);
      if (player.isStunned) {
        player.isStunned = false;
        player.stunEndTime = 0;
      }
    } else if (isOnIce) {
      if (player.isStunned) {
        player.isAlive = false;
        statusMessage.textContent = `Gracz ${player.id} został wyeliminowany!`;
      } else {
        player.freezeLevel = Math.min(MAX_FREEZE_LEVEL, player.freezeLevel + ICE_PATCH_FREEZE_PER_TICK);
        if (player.freezeLevel >= MAX_FREEZE_LEVEL) {
          player.freezeLevel = 0;
          player.isStunned = true;
          player.stunEndTime = performance.now() + STUN_DURATION_MS;
        }
      }
    }
  }

  // --- 6. Kolizja z Botem ---
  checkPlayerBotCollision(player, bots, statusMessage);
  if (!player.isAlive) return;

  // --- 7. Logika Ruchu (jeśli nie jest Stunned) ---
  if (!player.isStunned) {
    let moveX = 0, moveY = 0, isMoving = false;
    if (player.keys.up) { moveY = -currentMoveSpeed; isMoving = true; }
    if (player.keys.down) { moveY = currentMoveSpeed; isMoving = true; }
    if (player.keys.left) { moveX = -currentMoveSpeed; isMoving = true; }
    if (player.keys.right) { moveX = currentMoveSpeed; isMoving = true; }

    updatePlayerStatus(player); // Aktualizuj kierunek animacji

    // Ruch Piksel po Pikselu
    const magnitude = Math.hypot(moveX, moveY);
    let velX = 0, velY = 0;
    if (magnitude > 0) {
      velX = moveX / magnitude;
      velY = moveY / magnitude;
    }
    for (let i = 0; i < Math.round(magnitude); i++) {
      let futureX = player.worldX + velX;
      if (
        futureX >= player.drawWidth / 2 && futureX <= WORLD_WIDTH_PX - player.drawWidth / 2 &&
        !checkCollision(futureX, player.worldY, player.drawWidth, player.drawHeight, worldBlocks, iceWalls)
      ) {
        player.worldX = futureX;
      }
      let futureY = player.worldY + velY;
      if (
        futureY >= player.drawHeight / 2 && futureY <= WORLD_HEIGHT_PX - player.drawHeight / 2 &&
        !checkCollision(player.worldX, futureY, player.drawWidth, player.drawHeight, worldBlocks, iceWalls)
      ) {
        player.worldY = futureY;
      }
    }

    // Zbieranie bonusów
    state.bonuses = checkAndCollectBonuses(player, state.bonuses, statusMessage);

    // Animacja
    if (isMoving && timestamp - player.lastFrameTime > frameDelayMs) {
      player.lastFrameTime = timestamp;
      const currentFrameSet = state.frames[player.currentStatus];
      if (currentFrameSet && currentFrameSet.length > 0) {
        player.currentFrameIndex = (player.currentFrameIndex + 1) % currentFrameSet.length;
      }
    } else if (!isMoving) {
      player.currentFrameIndex = 0;
    }
  } else {
    updatePlayerStatus(player);
  }

  // --- 8. Aktualizacja KAMERY GRACZA (zawsze) ---
  const viewportWidth = player.viewportWidth;
  const viewportHeight = player.viewportHeight;
  let targetOffsetX = player.worldX - viewportWidth / 2;
  let targetOffsetY = player.worldY - viewportHeight / 2;
  targetOffsetX = Math.max(0, Math.min(targetOffsetX, WORLD_WIDTH_PX - viewportWidth));
  targetOffsetY = Math.max(0, Math.min(targetOffsetY, WORLD_HEIGHT_PX - viewportHeight));
  const lerpFactor = 0.05;
  player.worldOffsetX += (targetOffsetX - player.worldOffsetX) * lerpFactor;
  player.worldOffsetY += (targetOffsetY - player.worldOffsetY) * lerpFactor;
}

/**
 * Aktualizuje status (kierunek) gracza na podstawie wciśniętych klawiszy.
 */
function updatePlayerStatus(player) {
  let newStatus = player.currentStatus;
  if (player.keys.up) newStatus = "back";
  else if (player.keys.down) newStatus = "front";
  else if (player.keys.left) newStatus = "left";
  else if (player.keys.right) newStatus = "right";
  
  if (newStatus && newStatus !== player.currentStatus) {
    player.currentStatus = newStatus;
    player.currentFrameIndex = 0;
  }
}

// =====================================================================
// SEKCJA 3: RYSOWANIE GRACZA I JEGO KOMPONENTÓW
// =====================================================================

/**
 * Rysuje działo śnieżne (Snowball Cannon).
 */
function drawCannon(ctx, player, frames, canvasX, canvasY) {
  const cannonImage = frames.cannon[player.currentStatus];
  if (cannonImage && cannonImage.complete) {
    const drawW = player.drawWidth * 0.5, drawH = player.drawHeight * 0.5;
    let offsetX = 0, offsetY = 0;
    const vOffset = player.drawHeight * 0.2, hOffset = player.drawWidth * 0.5;
    switch (player.currentStatus) {
      case "back": offsetX = 10; offsetY = -5; break;
      case "front": offsetX = 10; offsetY = 10; break;
      case "left": offsetX = -hOffset; offsetY = 0; break;
      case "right": offsetX = hOffset; offsetY = 0; break;
      default: offsetY = vOffset; break;
    }
    ctx.save();
    ctx.filter = player.tint;
    ctx.drawImage(cannonImage, canvasX - drawW / 2 + offsetX, canvasY - drawH / 2 + offsetY, drawW, drawH);
    ctx.restore();
  }
}

/**
 * Rysuje Miotacz Śniegu (Snowthrower).
 */
function drawSnowthrower(ctx, player, frames, canvasX, canvasY) {
  const throwerImage = frames.snowthrower[player.currentStatus];
  if (throwerImage && throwerImage.complete) {
    const drawW = player.drawWidth * 0.8, drawH = player.drawHeight * 0.8;
    let offsetX = 0, offsetY = 0;
    const vOffset = player.drawHeight * 0.2, hOffset = player.drawWidth * 0.5;
    switch (player.currentStatus) {
      case "back": offsetX = 10; offsetY = -5; break;
      case "front": offsetX = 10; offsetY = 10; break;
      case "left": offsetX = -hOffset; offsetY = 0; break;
      case "right": offsetX = hOffset; offsetY = 0; break;
      default: offsetY = vOffset; break;
    }
    ctx.save();
    ctx.filter = player.tint;
    ctx.drawImage(throwerImage, canvasX - drawW / 2 + offsetX, canvasY - drawH / 2 + offsetY, drawW, drawH);
    ctx.restore();
  }
}

/**
 * Rysuje pasek ładowania rzutu (dla bomb i miotacza).
 */
function drawChargeBar(ctx, player, canvasX, canvasY) {
  if (!player.isChargingThrow || player.spacebarDownTime === null) return;
  
  let chargeTime = performance.now() - player.spacebarDownTime;
  let maxCharge = MAX_CHARGE_MS;
  let chargeColor = "white";

  if (player.bombType === "snowthrower") {
    if (player.isFiring) return; // Nie rysuj paska gdy już strzela
    maxCharge = SNOWTHROWER_CHARGE_MS;
    chargeColor = "cyan";
  } else if (player.bombType === "cannon") {
    return; // Armatka nie ma paska
  } else if (player.bombType === "fire" && player.currentFireBombs <= 0) {
    return; // Brak amunicji
  }

  const chargePercent = Math.min(chargeTime / maxCharge, 1.0);
  if (chargePercent < 1.0 && player.bombType !== "snowthrower") {
    chargeColor = "white";
  } else if (chargePercent >= 1.0 && player.bombType !== "snowthrower") {
    chargeColor = "#ef4444"; // Max dla bomby
  }

  const barWidth = 60;
  const barHeight = 8;
  const barX = canvasX - barWidth / 2;
  const barY = canvasY - player.drawHeight / 2 - 15;
  
  ctx.fillStyle = "#333";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = chargeColor;
  ctx.fillRect(barX, barY, barWidth * chargePercent, barHeight);
}

/**
 * Rysuje UI paliwa dla miotacza śniegu.
 */
function drawSnowthrowerUI(ctx, player, canvasX, ammoY) {
  const fuelPercent = player.currentSnowthrowerFuel / STARTING_SNOWTHROWER_FUEL;
  
  // Tekst
  ctx.fillStyle = "white";
  ctx.fillText(`❄️ ${Math.floor(fuelPercent * 100)}%`, canvasX, ammoY);

  // Mały pasek paliwa tuż pod tekstem
  const barWidth = 40;
  const barHeight = 4;
  const barX = canvasX - barWidth / 2;
  const barY = ammoY + 4;
  
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = "cyan";
  ctx.fillRect(barX, barY, barWidth * fuelPercent, barHeight);
}

/**
 * Rysuje gracza (główna funkcja).
 */
export function drawPlayer(ctx, player, frames, worldOffsetX, worldOffsetY) {
  const canvasX = player.worldX - worldOffsetX;
  const canvasY = player.worldY - worldOffsetY;

  if (
    canvasX + player.drawWidth < 0 || canvasX - player.drawWidth > ctx.canvas.width ||
    canvasY + player.drawHeight < 0 || canvasY - player.drawHeight > ctx.canvas.height
  ) {
    return;
  }

  // --- 1. Rysowanie UI nad graczem ---
  if (player.isAlive) {
    const barWidth = 60, barHeight = 8;
    const barY = canvasY - player.drawHeight / 2 - 20; // Pasek Krio
    const barX = canvasX - barWidth / 2;
    const ammoY = barY - 5; // Tekst amunicji

    // Pasek Zamrożenia
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = "deepskyblue";
    ctx.fillRect(barX, barY, barWidth * (player.freezeLevel / MAX_FREEZE_LEVEL), barHeight);

    // Tekst Amunicji
    ctx.font = "bold 14px Inter";
    ctx.textAlign = "center";
    if (player.bombType === "fire") {
      ctx.fillStyle = "orange";
      ctx.fillText(`🔥 ${player.currentFireBombs}`, canvasX, ammoY);
    } else if (player.bombType === "ice") {
      ctx.fillStyle = "cyan";
      ctx.fillText(`❄️ ∞`, canvasX, ammoY);
    } else if (player.bombType === "cannon") {
      const ammoText = STARTING_SNOWBALLS === Infinity ? '∞' : player.currentSnowballs;
      ctx.fillStyle = "white";
      ctx.fillText(`☃️ ${ammoText}`, canvasX, ammoY);
    } else if (player.bombType === "snowthrower") {
      drawSnowthrowerUI(ctx, player, canvasX, ammoY);
    }
  }

  // Pasek ładowania rzutu (dla bomb LUB miotacza)
  drawChargeBar(ctx, player, canvasX, canvasY);

  // --- 2. Rysowanie postaci (kaczki) ---
  const currentFrameSet = frames[player.currentStatus];
  const currentFrame = currentFrameSet ? currentFrameSet[player.currentFrameIndex] : null;

  if (currentFrame && currentFrame.complete && currentFrame.naturalWidth !== 0) {
    ctx.save();
    let filterString = player.tint, finalAlpha = 1.0;

    if (player.isStunned) {
      filterString = "brightness(2) contrast(1.5) sepia(100%) hue-rotate(180deg) saturate(200%)";
      finalAlpha = 0.8;
    } else if (player.freezeLevel > 0) {
      const freezeIntensity = player.freezeLevel / MAX_FREEZE_LEVEL;
      filterString = `brightness(${1.0 + freezeIntensity * 0.5}) sepia(${freezeIntensity}) hue-rotate(${freezeIntensity * 150}deg) saturate(${1.0 - freezeIntensity * 0.5})`;
    } else if (!player.isAlive) {
      filterString = "grayscale(100%) brightness(1.5) sepia(100%) hue-rotate(-50deg) saturate(600%) contrast(1)";
      finalAlpha = 0.5;
    }
    ctx.globalAlpha = finalAlpha;
    ctx.filter = filterString;

    ctx.drawImage(currentFrame, canvasX - player.drawWidth / 2, canvasY - player.drawHeight / 2, player.drawWidth, player.drawHeight);
    ctx.restore();

    // --- 3. Rysowanie Broni (NA wierzchu) ---
    if (player.isAlive && !player.isStunned) {
      if (player.bombType === "cannon") {
        drawCannon(ctx, player, frames, canvasX, canvasY);
      } else if (player.bombType === "snowthrower") {
        drawSnowthrower(ctx, player, frames, canvasX, canvasY);
      }
    }
  } else {
    // Fallback
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(canvasX - player.drawWidth / 2, canvasY - player.drawHeight / 2, player.drawWidth, player.drawHeight);
  }
}