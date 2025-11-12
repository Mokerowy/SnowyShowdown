// --- components/bot.js ---

import {
  // Stałe Bota
  BOT_DRAW_WIDTH,
  BOT_DRAW_HEIGHT,
  BOT_MOVE_SPEED,
  BOT_AI_UPDATE_MS,
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
  // Stałe Animacji
  frameDelayMs,
} from "./config.js";

// Funkcje z innych modułów
import { checkCollision } from "./world.js";
import { checkEntityOnIce, checkEntityOnFire } from "./interactions.js";

// --- Szablon Bota (Prywatny dla modułu) ---
const botTemplate = {
  id: 101, // Domyślne ID
  width: BOT_DRAW_WIDTH,
  height: BOT_DRAW_HEIGHT,
  worldX: 750,
  worldY: 750,
  isAlive: true,
  currentFrameIndex: 0,
  lastFrameTime: 0,
  lastAiUpdateTime: 0,
  state: "WANDERING", // "WANDERING", "HUNTING", "FLEEING"
  moveVector: { x: 0, y: 0 },
  keyMap: { id: "BOT" }, // Identyfikator dla systemu Krio
  // Stan Krio Bota
  freezeLevel: 0,
  isStunned: false,
  stunEndTime: 0,
  lastPatchEffectTime: 0,
};

// =====================================================================
// SEKCJA 1: TWORZENIE BOTA
// =====================================================================

/**
 * Tworzy nową instancję bota.
 * @param {number} id - Unikalne ID bota.
 * @param {number} startX - Pozycja startowa X.
 * @param {number} startY - Pozycja startowa Y.
 */
export function createBot(id, startX, startY) {
  const newBot = { ...botTemplate };
  newBot.id = id;
  newBot.worldX = startX;
  newBot.worldY = startY;
  newBot.isAlive = true;
  newBot.lastAiUpdateTime = performance.now();
  // Reset stanu Krio
  newBot.freezeLevel = 0;
  newBot.isStunned = false;
  newBot.stunEndTime = 0;
  newBot.lastPatchEffectTime = 0;
  return newBot;
}

// =====================================================================
// SEKCJA 2: AKTUALIZACJA STANU BOTA (LOGIKA)
// =====================================================================

/**
 * Aktualizuje logikę i pozycję wszystkich botów.
 * @param {Array<Object>} bots - Tablica botów do aktualizacji.
 * @param {number} timestamp - Aktualny czas.
 * @param {Object} state - Stan gry (worldBlocks, icePatches, firePatches, frames, iceWalls).
 */
export function updateBots(bots, timestamp, state) {
  const { worldBlocks, icePatches, firePatches, frames, iceWalls } = state;

  for (const bot of bots) {
    if (!bot.isAlive) continue;

    // --- 1. Logika Stanu (Stun i Odmrażanie) ---
    if (bot.isStunned) {
      if (timestamp > bot.stunEndTime) {
        bot.isStunned = false; // Koniec stuna
      }

      // Sprawdź, czy bot stoi na ogniu, gdy jest zamrożony
      const isOnFire_Bot_Stunned = checkEntityOnFire(
        bot.worldX, bot.worldY, bot.width, bot.height, firePatches
      );
      if (
        isOnFire_Bot_Stunned &&
        timestamp - bot.lastPatchEffectTime > PATCH_EFFECT_INTERVAL_MS
      ) {
        bot.lastPatchEffectTime = timestamp;
        bot.isStunned = false; // Ogień natychmiast ratuje bota
        bot.stunEndTime = 0;
        bot.freezeLevel = Math.max(0, bot.freezeLevel - FIRE_PATCH_UNFREEZE_PER_TICK);
      }
      continue; // Zatrzymany bot nie rusza się ani nie myśli
    }

    // Pasywne odmrażanie
    if (bot.freezeLevel > 0) {
      bot.freezeLevel = Math.max(0, bot.freezeLevel - PASSIVE_UNFREEZE_RATE);
    }

    // --- 2. Logika Efektów Strefowych ---
    const isOnIce_Bot = checkEntityOnIce(bot.worldX, bot.worldY, bot.height, icePatches);
    const isOnFire_Bot = checkEntityOnFire(
      bot.worldX, bot.worldY, bot.width, bot.height, firePatches
    );

    if (
      (isOnIce_Bot || isOnFire_Bot) &&
      timestamp - bot.lastPatchEffectTime > PATCH_EFFECT_INTERVAL_MS
    ) {
      bot.lastPatchEffectTime = timestamp;

      if (isOnFire_Bot) {
        // Ogień leczy bota
        bot.freezeLevel = Math.max(0, bot.freezeLevel - FIRE_PATCH_UNFREEZE_PER_TICK);
      } else if (isOnIce_Bot) {
        // Lód powoli zamraża bota
        bot.freezeLevel = Math.min(MAX_FREEZE_LEVEL, bot.freezeLevel + ICE_PATCH_FREEZE_PER_TICK);
        if (bot.freezeLevel >= MAX_FREEZE_LEVEL) {
          bot.freezeLevel = 0;
          bot.isStunned = true; // Strefa lodu może ogłuszyć bota
          bot.stunEndTime = performance.now() + STUN_DURATION_MS;
        }
      }
    }

    // --- 3. Spowolnienie Bota ---
    const botFreezePercent = bot.freezeLevel / MAX_FREEZE_LEVEL;
    const botSpeedModifier = 1.0 - botFreezePercent;
    const currentBotMoveSpeed = BOT_MOVE_SPEED * Math.max(0, botSpeedModifier);

    // --- 4. Logika AI (Wandering) ---
    if (timestamp - bot.lastAiUpdateTime > BOT_AI_UPDATE_MS) {
      bot.lastAiUpdateTime = timestamp;
      if (bot.state === "WANDERING") {
        const roll = Math.random();
        if (roll < 0.25) bot.moveVector = { x: currentBotMoveSpeed, y: 0 };
        else if (roll < 0.5) bot.moveVector = { x: -currentBotMoveSpeed, y: 0 };
        else if (roll < 0.75) bot.moveVector = { x: 0, y: currentBotMoveSpeed };
        else bot.moveVector = { x: 0, y: -currentBotMoveSpeed };
      }
    }

    // --- 5. Logika Ruchu Bota ---
    if (bot.moveVector.x !== 0 || bot.moveVector.y !== 0) {
      let futureX = bot.worldX + bot.moveVector.x;
      let futureY = bot.worldY + bot.moveVector.y;

      // Sprawdź kolizję ze światem i ścianami lodu (z world.js)
      if (checkCollision(futureX, futureY, bot.width, bot.height, worldBlocks, iceWalls)) {
        bot.moveVector.x *= -1;
        bot.moveVector.y *= -1;
        bot.lastAiUpdateTime = 0; // Wymuś nową decyzję AI
      } else {
        // Sprawdzenie granic świata
        const isInsideWorldX =
          futureX >= bot.width / 2 && futureX <= WORLD_WIDTH_PX - bot.width / 2;
        const isInsideWorldY =
          futureY >= bot.height / 2 &&
          futureY <= WORLD_HEIGHT_PX - bot.height / 2;
        
        if (isInsideWorldX && isInsideWorldY) {
          bot.worldX = futureX;
          bot.worldY = futureY;
          // Animacja bota
          if (timestamp - bot.lastFrameTime > frameDelayMs * 2) {
            bot.lastFrameTime = timestamp;
            bot.currentFrameIndex = (bot.currentFrameIndex + 1) % frames.bot.length;
          }
        } else {
          // Zderzenie z granicą świata
          bot.moveVector.x *= -1;
          bot.moveVector.y *= -1;
          bot.lastAiUpdateTime = 0;
        }
      }
    }
  }
}

// =====================================================================
// SEKCJA 3: RYSOWANIE BOTA
// =====================================================================

/**
 * Rysuje wszystkie żywe boty na canvasie (z filtrami efektów Krio).
 * @param {CanvasRenderingContext2D} ctx - Kontekst Canvas.
 * @param {Array<Object>} bots - Tablica botów.
 * @param {Object} frames - Obiekt z klatkami ('bot').
 * @param {number} worldOffsetX - Przesunięcie kamery X.
 * @param {number} worldOffsetY - Przesunięcie kamery Y.
 */
export function drawBots(ctx, bots, frames, worldOffsetX, worldOffsetY) {
  for (const bot of bots) {
    const canvasX = bot.worldX - worldOffsetX;
    const canvasY = bot.worldY - worldOffsetY;
    const currentFrame = frames.bot[bot.currentFrameIndex];

    // Culling
    if (
      canvasX + bot.width < 0 ||
      canvasX - bot.width > ctx.canvas.width ||
      canvasY + bot.height < 0 ||
      canvasY - bot.height > ctx.canvas.height
    ) {
      continue;
    }

    if (currentFrame && currentFrame.complete && currentFrame.naturalWidth !== 0) {
      ctx.save();

      let filterString = "grayscale(100%) brightness(1.2) contrast(1.2)"; // Domyślny filtr bota
      let finalAlpha = 1.0;

      // Zastosuj filtry efektów
      if (bot.isStunned) {
        filterString = "brightness(2) contrast(1.5) sepia(100%) hue-rotate(180deg) saturate(200%)";
        finalAlpha = 0.8;
      } else if (bot.freezeLevel > 0) {
        const freezeIntensity = bot.freezeLevel / MAX_FREEZE_LEVEL;
        filterString = `brightness(${1.0 + freezeIntensity * 0.5}) sepia(${freezeIntensity}) hue-rotate(${freezeIntensity * 150}deg) saturate(${1.0 - freezeIntensity * 0.5})`;
      } else if (!bot.isAlive) {
        filterString = "grayscale(100%) brightness(1.5) sepia(100%) hue-rotate(-50deg) saturate(600%) contrast(1)";
        finalAlpha = 0.5;
      }

      ctx.globalAlpha = finalAlpha;
      ctx.filter = filterString;

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