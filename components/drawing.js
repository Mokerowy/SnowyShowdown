// --- components/drawing.js ---

import { drawBots } from "./bot.js";
import { drawPlayer } from "./player.js";

import {
  // Stałe Świata
  BOX_SIZE,
  // Stałe Bonusów
  BONUS_SIZE,
  // Stałe Bomb
  BASE_BOMB_WIDTH,
  BASE_BOMB_HEIGHT,
  BOMB_SIZES,
  EXPLOSION_DURATION_MS,
  BASE_BOMB_EXPLOSION_RANGE,
  // Stałe Śnieżek
  SNOWBALL_SIZE,
  // Stałe Stref
  ICE_PATCH_DURATION_MS,
  FIRE_PATCH_DURATION_MS,
  // Stałe Miotacza
  SNOWTHROWER_RANGE,
  SNOWTHROWER_WIDTH,
  SNOWTHROWER_CHARGE_MS,
  // Stałe Krio
  MAX_FREEZE_LEVEL,
  // Stałe Amunicji
  STARTING_SNOWBALLS,
  STARTING_SNOWTHROWER_FUEL,
  // Stałe Rzucania
  MAX_CHARGE_MS,
} from "./config.js";

/**
 * Funkcja pomocnicza do rysowania zaokrąglonego prostokąta
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// =====================================================================
// SEKCJA 1: FUNKCJE POMOCNICZE (ZESTAWY)
// =====================================================================

/**
 * Rysuje elementy świata (bloki, strefy, bonusy).
 */
export function drawWorld(ctx, state, assets, worldOffsetX, worldOffsetY) {
  const { icePatches, worldBlocks, firePatches, bonuses } = state;
  const { boxFrames, bonusFrames } = assets;

  drawIcePatches(ctx, icePatches, worldOffsetX, worldOffsetY);
  drawBlocks(ctx, boxFrames, worldBlocks, worldOffsetX, worldOffsetY);
  drawFirePatches(ctx, firePatches, worldOffsetX, worldOffsetY);
  drawBonuses(ctx, bonusFrames, bonuses, worldOffsetX, worldOffsetY);
}

/**
 * Rysuje jednostki (gracze, boty).
 */
export function drawEntities(ctx, state, assets, worldOffsetX, worldOffsetY) {
  const { bots, players } = state;
  const { frames } = assets;

  drawBots(ctx, bots, frames, worldOffsetX, worldOffsetY);
  for (const player of players) {
    drawPlayer(ctx, player, frames, worldOffsetX, worldOffsetY);
  }
}

/**
 * Rysuje efekty (bomby, wybuchy, pociski, ściany, strumienie).
 */
export function drawEffects(ctx, state, assets, worldOffsetX, worldOffsetY) {
  const { iceWalls, bombs, projectiles, players } = state;
  const { frames } = assets;

  for (const wall of iceWalls) {
    drawIceWall(ctx, wall, worldOffsetX, worldOffsetY);
  }
  for (const b of bombs) {
    if (b.active && !b.isExploding) {
      drawBomb(ctx, frames, b, worldOffsetX, worldOffsetY);
    }
  }
  for (const p of projectiles) {
    if (p.active) {
      drawProjectile(ctx, frames, p, worldOffsetX, worldOffsetY);
    }
  }
  // Rysuj strumień miotacza (dla każdego gracza)
  for (const player of players) {
    if (player.isAlive) {
      drawSnowthrowerStream(ctx, player, worldOffsetX, worldOffsetY);
    }
  }
  for (const b of bombs) {
    if (b.isExploding) {
      drawExplosion(ctx, b, players, worldOffsetX, worldOffsetY);
    }
  }
}

// =====================================================================
// SEKCJA 2: RYSOWANIE ŚWIATA I EFEKTÓW STREFOWYCH
// =====================================================================

/**
 * Rysuje bloki świata widoczne w kamerze.
 */
function drawBlocks(ctx, boxFrames, worldBlocks, worldOffsetX, worldOffsetY) {
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  
  for (const block of worldBlocks) {
    const canvasX = block.worldX - worldOffsetX;
    const canvasY = block.worldY - worldOffsetY;

    // Culling (Sprawdzenie, czy blok jest na ekranie)
    if (
      canvasX + BOX_SIZE < 0 || canvasX > canvasWidth ||
      canvasY + BOX_SIZE < 0 || canvasY > canvasHeight
    ) {
      continue; // Pomiń rysowanie, jeśli poza ekranem
    }

    // --- POCZĄTEK POPRAWKI ---
    // Specjalna logika rysowania dla czarnej granicy
    if (block.type === 4) {
      ctx.fillStyle = "#c6cfc7ff"; // Ten sam kolor co tło body
      ctx.fillRect(canvasX, canvasY, BOX_SIZE, BOX_SIZE);
      continue; // Przejdź do następnego bloku
    }
    // --- KONIEC POPRAWKI ---

    // Normalna logika rysowania dla wszystkich innych bloków (0, 1, 2, 3)
    const frame = boxFrames[block.type % boxFrames.length];
    
    if (frame && frame.complete && frame.naturalWidth !== 0) {
      ctx.drawImage(frame, canvasX, canvasY, BOX_SIZE, BOX_SIZE);
    }
  }
}

/**
 * Rysuje bonusy widoczne w kamerze.
 */
function drawBonuses(ctx, bonusFrames, bonuses, worldOffsetX, worldOffsetY) {
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  for (const bonus of bonuses) {
    const canvasX = bonus.worldX - worldOffsetX;
    const canvasY = bonus.worldY - worldOffsetY;
    
    if (
      canvasX + BONUS_SIZE < 0 || canvasX - BONUS_SIZE > canvasWidth ||
      canvasY + BONUS_SIZE < 0 || canvasY - BONUS_SIZE > canvasHeight
    ) {
      continue;
    }
    
    const frame = bonusFrames[bonus.type];
    if (frame && frame.complete && frame.naturalWidth !== 0) {
      ctx.drawImage(frame, canvasX - BONUS_SIZE / 2, canvasY - BONUS_SIZE / 2, BONUS_SIZE, BONUS_SIZE);
    } else {
      ctx.fillStyle = "magenta";
      ctx.fillRect(canvasX - BONUS_SIZE / 2, canvasY - BONUS_SIZE / 2, BONUS_SIZE, BONUS_SIZE);
    }
  }
}

/**
 * Rysuje okrągłe plamy lodu (gradient, cząstki).
 */
function drawIcePatches(ctx, icePatches, worldOffsetX, worldOffsetY) {
  const timestamp = performance.now();
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  
  for (const patch of icePatches) {
    const canvasX = patch.worldX - worldOffsetX;
    const canvasY = patch.worldY - worldOffsetY;
    const age = timestamp - patch.createdAt;
    const lifePercent = age / ICE_PATCH_DURATION_MS;
    const alpha = 1.0 - Math.sin(lifePercent * (Math.PI / 2));

    if (
      canvasX + patch.radius < 0 || canvasX - patch.radius > canvasWidth ||
      canvasY + patch.radius < 0 || canvasY - patch.radius > canvasHeight ||
      alpha <= 0
    ) {
      continue;
    }

    ctx.save();
    const baseGradient = ctx.createRadialGradient(canvasX, canvasY, 0, canvasX, canvasY, patch.radius);
    baseGradient.addColorStop(0, `rgba(173, 216, 230, ${alpha * 0.5})`);
    baseGradient.addColorStop(1, `rgba(100, 149, 237, ${alpha * 0.2})`);
    ctx.fillStyle = baseGradient;
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, patch.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = `rgba(255, 255, 255, 1)`;
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (patch.radius - 1);
      const x = canvasX + Math.cos(angle) * r;
      const y = canvasY + Math.sin(angle) * r;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.restore();
  }
}

/**
 * Rysuje okrągłe plamy ognia (gradient, cząstki).
 */
function drawFirePatches(ctx, firePatches, worldOffsetX, worldOffsetY) {
  const timestamp = performance.now();
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  
  for (const patch of firePatches) {
    const canvasX = patch.worldX - worldOffsetX;
    const canvasY = patch.worldY - worldOffsetY;
    const age = timestamp - patch.createdAt;
    const lifePercent = age / FIRE_PATCH_DURATION_MS;
    const alpha = 1.0 - Math.sin(lifePercent * (Math.PI / 2));

    if (
      canvasX + patch.radius < 0 || canvasX - patch.radius > canvasWidth ||
      canvasY + patch.radius < 0 || canvasY - patch.radius > canvasHeight ||
      alpha <= 0
    ) {
      continue;
    }

    ctx.save();
    const baseGradient = ctx.createRadialGradient(canvasX, canvasY, 0, canvasX, canvasY, patch.radius);
    baseGradient.addColorStop(0, `rgba(255, 215, 0, ${alpha * 0.6})`);
    baseGradient.addColorStop(0.7, `rgba(255, 69, 0, ${alpha * 0.3})`);
    baseGradient.addColorStop(1, `rgba(210, 0, 0, 0)`);
    ctx.fillStyle = baseGradient;
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, patch.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 165, 0, ${alpha * 0.9})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    const particleCount = 60;
    for (let i = 0; i < particleCount; i++) {
      const r = Math.sqrt(Math.random()) * (patch.radius - 2);
      const angle = Math.random() * Math.PI * 2;
      const x = canvasX + Math.cos(angle) * r;
      const y = canvasY + Math.sin(angle) * r;
      const particleRoll = Math.random();
      let particleSize, particleAlpha = alpha * (0.5 + Math.random() * 0.5);
      if (particleRoll < 0.6) { ctx.fillStyle = `rgba(255, 69, 0, ${particleAlpha})`; particleSize = 3; }
      else if (particleRoll < 0.9) { ctx.fillStyle = `rgba(255, 215, 0, ${particleAlpha})`; particleSize = 2; }
      else { ctx.fillStyle = `rgba(255, 255, 200, ${particleAlpha * 1.2})`; particleSize = 1; }
      ctx.fillRect(x - particleSize / 2, y - particleSize / 2, particleSize, particleSize);
    }
    ctx.restore();
  }
}

/**
 * Rysuje ścianę lodu.
 */
function drawIceWall(ctx, wall, worldOffsetX, worldOffsetY) {
  const canvasX = wall.x - worldOffsetX;
  const canvasY = wall.y - worldOffsetY;

  if (
    canvasX + wall.width < 0 || canvasX > ctx.canvas.width ||
    canvasY + wall.height < 0 || canvasY > ctx.canvas.height
  ) {
    return;
  }

  const elapsed = Date.now() - wall.createdAt;
  const ratio = elapsed / wall.duration;
  let alpha = 0.7;
  if (ratio > 0.85) { 
    alpha = 0.7 * (1 - (ratio - 0.85) / 0.15);
  }

  ctx.save();
  ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
  ctx.strokeStyle = `rgba(50, 150, 255, ${alpha})`;
  ctx.lineWidth = 2;
  const radius = 4;
  drawRoundedRect(ctx, canvasX, canvasY, wall.width, wall.height, radius);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// =====================================================================
// SEKCJA 3: RYSOWANIE BRONI I EFEKTÓW (BOMBY, POCISKI, WYBUCHY)
// =====================================================================

/**
 * Rysuje bombę (tykającą lub rzucaną) wraz z cieniem.
 */
function drawBomb(ctx, frames, bombObject, worldOffsetX, worldOffsetY) {
  if (!bombObject.active) return;
  const canvasX = bombObject.worldX - worldOffsetX;
  const canvasY = bombObject.worldY - worldOffsetY;
  const canvasZ = bombObject.z;

  if (
    canvasX + BASE_BOMB_WIDTH < 0 || canvasX - BASE_BOMB_WIDTH > ctx.canvas.width ||
    canvasY + BASE_BOMB_HEIGHT < 0 || canvasY - BASE_BOMB_HEIGHT > ctx.canvas.height
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

  if (currentFrame && currentFrame.complete && currentFrame.naturalWidth !== 0) {
    ctx.save();
    if (bombObject.type === "ice") {
      ctx.filter = "sepia(100%) hue-rotate(180deg) saturate(200%) brightness(1.2)";
    } else if (bombObject.type === "fire") {
      ctx.filter = "sepia(100%) hue-rotate(-30deg) saturate(500%) brightness(1.1)";
    }
    ctx.drawImage(currentFrame, canvasX - drawW / 2, canvasY + canvasZ - drawH, drawW, drawH);
    ctx.restore();
  }
}

/**
 * Rysuje liniowy pocisk (śnieżkę).
 */
function drawProjectile(ctx, frames, projectile, worldOffsetX, worldOffsetY) {
  if (!projectile.active || projectile.type !== "cannon") return;

  const canvasX = projectile.worldX - worldOffsetX;
  const canvasY = projectile.worldY - worldOffsetY;
  const currentFrame = frames.snowball[0];

  if (
    canvasX + SNOWBALL_SIZE < 0 || canvasX - SNOWBALL_SIZE > ctx.canvas.width ||
    canvasY + SNOWBALL_SIZE < 0 || canvasY - SNOWBALL_SIZE > ctx.canvas.height
  ) {
    return;
  }

  if (currentFrame && currentFrame.complete && currentFrame.naturalWidth !== 0) {
    ctx.save();
    ctx.filter = `brightness(1.5) saturate(1.5)`;
    ctx.drawImage(currentFrame, canvasX - SNOWBALL_SIZE / 2, canvasY - SNOWBALL_SIZE / 2, SNOWBALL_SIZE, SNOWBALL_SIZE);
    ctx.restore();
  }
}

/**
 * Rysuje strumień śniegu z miotacza (NOWA, WYDAJNA WERSJA).
 * Używa jednego gradientu i minimalnej liczby cząsteczek.
 */
function drawSnowthrowerStream(ctx, player, worldOffsetX, worldOffsetY) {
  if (!player.isFiring || player.bombType !== "snowthrower") {
    return;
  }

  // Definicje strumienia
  const range = SNOWTHROWER_RANGE;
  const maxWidth = SNOWTHROWER_WIDTH * 3.5; // Szeroki stożek
  const particleCount = 70; // Mała, wydajna liczba cząsteczek
  const particleBaseSize = 3; // Małe cząsteczki
  const offsetDistance = 20; // Przesunięcie źródła strumienia od środka gracza

  let startX = player.worldX - worldOffsetX;
  let startY = player.worldY - worldOffsetY;
  const timestamp = performance.now(); // Do animacji "drżenia"

  // Przesunięcie punktu startowego strumienia w kierunku strzału
  // (żeby wylatywał z snowthrowera, a nie ze środka kaczki)
  switch (player.currentStatus) {
    case "back":
      startY -= offsetDistance;
      break;
    case "front":
      startY += offsetDistance;
      break;
    case "left":
      startX -= offsetDistance;
      break;
    case "right":
      startX += offsetDistance;
      break;
  }

  ctx.save();

  // --- 1. Oblicz punkty stożka ---
  let x1 = startX, y1 = startY, x2 = startX, y2 = startY; // Dwa punkty końcowe stożka
  let midX = startX, midY = startY; // Środek końca stożka (dla gradientu)
  
  switch (player.currentStatus) {
    case "back":  
      midY = startY - range;
      x1 = startX - maxWidth / 2; y1 = midY;
      x2 = startX + maxWidth / 2; y2 = midY;
      break;
    case "front": 
      midY = startY + range;
      x1 = startX - maxWidth / 2; y1 = midY;
      x2 = startX + maxWidth / 2; y2 = midY;
      break;
    case "left":  
      midX = startX - range;
      x1 = midX; y1 = startY - maxWidth / 2;
      x2 = midX; y2 = startY + maxWidth / 2;
      break;
    case "right": 
      midX = startX + range;
      x1 = midX; y1 = startY - maxWidth / 2;
      x2 = midX; y2 = startY + maxWidth / 2;
      break;
    default: // Domyślnie w dół
      midY = startY + range;
      x1 = startX - maxWidth / 2; y1 = midY;
      x2 = startX + maxWidth / 2; y2 = midY;
      break;
  }

  // --- 2. Rysuj Bazowy Stożek (Gradient - aby zasłonić podłoże) ---
  const grad = ctx.createLinearGradient(startX, startY, midX, midY);
  grad.addColorStop(0, 'rgba(210, 230, 255, 0.8)'); // Gęsto przy lufie (80% alpha)
  grad.addColorStop(0.3, 'rgba(210, 230, 255, 0.7)'); // Utrzymaj gęstość
  grad.addColorStop(1, 'rgba(180, 210, 240, 0.05)'); // Bardzo miękki, przezroczysty koniec

  // Narysuj trójkątny stożek
  ctx.beginPath();
  ctx.moveTo(startX, startY); // Wierzchołek
  ctx.lineTo(x1, y1);         // Róg 1
  ctx.lineTo(x2, y2);         // Róg 2
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill(); // Wypełnij stożek

  // --- 3. Rysuj Cząsteczki "Śniegu" (dla imitacji ruchu) ---
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Bardziej widoczne cząsteczki
  
  for (let i = 0; i < particleCount; i++) {
    const lengthRatio = Math.random();
    const currentLength = lengthRatio * range;
    
    const maxSpread = (lengthRatio * maxWidth) / 2;
    const currentSpread = (Math.random() - 0.5) * maxSpread * 2;

    const particleAlpha = (Math.sin(timestamp / 60 + i) * 0.4 + 0.5) * (1 - lengthRatio * 0.8);
    const particleSize = Math.random() * particleBaseSize + 1;

    ctx.fillStyle = `rgba(255, 255, 255, ${particleAlpha})`;
    
    let pX, pY;
    if (player.currentStatus === "left" || player.currentStatus === "right") {
      pX = startX + (player.currentStatus === "left" ? -currentLength : currentLength);
      pY = startY + currentSpread;
    } else {
      pX = startX + currentSpread;
      pY = startY + (player.currentStatus === "back" ? -currentLength : currentLength);
    }

    ctx.fillRect(pX - particleSize / 2, pY - particleSize / 2, particleSize, particleSize);
  }

  ctx.restore();
}


/**
 * Rysuje okrągły wybuch (TYLKO WIZUALNIE).
 */
export function drawExplosion(ctx, bombObject, players, worldOffsetX, worldOffsetY) {
  if (!bombObject || !bombObject.isExploding) return;

  const timeElapsed = performance.now() - bombObject.explosionTime;
  const progress = timeElapsed / EXPLOSION_DURATION_MS;

  if (progress >= 1.0) {
    return;
  }

  const owner = players.find((p) => p.id === bombObject.ownerId);
  const blastRange = owner ? owner.blastRange : BASE_BOMB_EXPLOSION_RANGE;
  const maxRadius = blastRange * BOX_SIZE + BOX_SIZE / 2;
  const easeOutProgress = Math.sin(progress * (Math.PI / 2));
  const currentRadius = maxRadius * easeOutProgress;
  const alpha = 1.0 - progress;

  const canvasX = bombObject.worldX - worldOffsetX;
  const canvasY = bombObject.worldY - worldOffsetY;

  if (
    canvasX + currentRadius < 0 || canvasX - currentRadius > ctx.canvas.width ||
    canvasY + currentRadius < 0 || canvasY - currentRadius > ctx.canvas.height
  ) {
    return;
  }

  let colorCenter, colorOuter;
  switch (bombObject.type) {
    case "ice":
      colorCenter = `rgba(220, 250, 255, ${alpha})`;
      colorOuter = `rgba(70, 130, 180, ${alpha * 0.3})`;
      break;
    case "fire":
      colorCenter = `rgba(255, 255, 150, ${alpha})`;
      colorOuter = `rgba(255, 69, 0, ${alpha * 0.3})`;
      break;
    default:
      colorCenter = `rgba(255, 255, 150, ${alpha})`;
      colorOuter = `rgba(255, 99, 71, ${alpha * 0.3})`;
  }

  ctx.save();
  const gradient = ctx.createRadialGradient(canvasX, canvasY, 0, canvasX, canvasY, currentRadius);
  gradient.addColorStop(0, colorCenter);
  gradient.addColorStop(0.5, colorCenter);
  gradient.addColorStop(1, colorOuter);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(canvasX, canvasY, currentRadius, 0, Math.PI * 2);
  ctx.fill();
  
  const corePulse = Math.sin(performance.now() / 50) * 0.1 + 0.9;
  const coreSize = BOX_SIZE * 0.4 * corePulse * (1 - progress);
  ctx.globalAlpha = (1 - progress) * 0.9;
  let coreColor = bombObject.type === "ice" ? "white" : "yellow";
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.arc(canvasX, canvasY, coreSize, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

// =====================================================================
// SEKCJA 4: RYSOWANIE INTERFEJSU (UI)
// =====================================================================

/**
 * Rysuje nowy, graficzny ekran Menu.
 */
export function drawMenu(ctx) {
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;

  // 1. Tło (pasujące do tła HTML)
  ctx.fillStyle = "rgba(2, 6, 23, 0.85)"; // Bardzo ciemny granat
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // 2. Tytuł
  ctx.fillStyle = "white";
  ctx.font = "bold 64px Inter"; // Duży, wyraźny tytuł
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(59, 130, 246, 0.8)"; // Niebieski neon
  ctx.shadowBlur = 20;
  ctx.fillText("SNOWY SHOWDOWN", canvasWidth / 2, canvasHeight * 0.25);
  ctx.shadowBlur = 0; // Reset cienia

  // 3. Opcje Graczy
  const buttonWidth = 350;
  const buttonHeight = 65;
  const spacing = 25;
  const startY = canvasHeight * 0.4;
  
  const options = [
    { key: "1", text: "1 Gracz (vs Bot)" },
    { key: "2", text: "2 Graczy" },
    { key: "3", text: "3 Graczy" },
    { key: "4", text: "4 Gracze" },
  ];

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const btnX = canvasWidth / 2 - buttonWidth / 2;
    const btnY = startY + i * (buttonHeight + spacing);

    // Tło przycisku
    ctx.fillStyle = "rgba(30, 41, 59, 0.9)"; // Ciemne tło
    ctx.strokeStyle = "rgba(59, 130, 246, 0.6)"; // Niebieska obwódka
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, btnX, btnY, buttonWidth, buttonHeight, 12);
    ctx.fill();
    ctx.stroke();

    // Tekst w przycisku
    ctx.fillStyle = "white";
    ctx.font = "600 26px Inter"; // "Semibold"
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    
    // Klucz (np. "[ 1 ]")
    ctx.fillStyle = "rgb(59, 130, 246)";
    ctx.font = "700 26px Inter"; // "Bold"
    ctx.fillText(`[ ${opt.key} ]`, btnX + 30, btnY + buttonHeight / 2);
    
    // Opis
    ctx.fillStyle = "white";
    ctx.font = "600 26px Inter";
    ctx.fillText(opt.text, btnX + 130, btnY + buttonHeight / 2);
  }
}

/**
 * Rysuje ekran Końca Rundy.
 */
export function drawGameOver(ctx, livingPlayers, livingBots, numPlayers) {
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  
  // Tło (pasujące do menu)
  ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.textAlign = "center";
  
  let winnerText = "REMIS!";
  if (numPlayers > 1) {
    if (livingPlayers.length === 1) winnerText = `WYGRYWA GRACZ ${livingPlayers[0].id}!`;
  } else {
    if (livingPlayers.length === 0) winnerText = "BOT WYGRYWA!";
    else if (livingBots.length === 0) winnerText = `GRACZ ${livingPlayers[0].id} WYGRYWA!`;
  }

  // Tytuł Zwycięzcy
  ctx.fillStyle = "#FACC15"; // Złoty kolor
  ctx.font = "800 64px Inter"; // "ExtraBold"
  ctx.shadowColor = "rgba(250, 204, 21, 0.6)";
  ctx.shadowBlur = 25;
  ctx.fillText(winnerText, canvasWidth / 2, canvasHeight / 2 - 40);
  ctx.shadowBlur = 0;
  
  // Instrukcja powrotu
  ctx.fillStyle = "#e2e8f0"; // Jasnoszary
  ctx.font = "500 24px Inter"; // "Medium"
  // Dodanie migotania do tekstu
  ctx.globalAlpha = Math.sin(performance.now() / 300) * 0.4 + 0.6; // 0.6 do 1.0
  ctx.fillText(
    "Naciśnij [ R ], aby wrócić do Menu",
    canvasWidth / 2,
    canvasHeight / 2 + 50
  );
  ctx.globalAlpha = 1.0;
}

