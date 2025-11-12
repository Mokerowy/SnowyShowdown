// --- components/interactions.js ---

import {
  // Stałe Stref
  ICE_PATCH_DURATION_MS,
  ICE_PATCH_RADIUS,
  FIRE_PATCH_DURATION_MS,
  FIRE_PATCH_RADIUS,
  // Stałe Bonusów
  BONUS_PICKUP_RANGE,
  BONUS_SIZE,
  BOX_SIZE,
  // Stałe Krio
  MAX_FREEZE_LEVEL,
  STUN_DURATION_MS,
  FREEZE_EFFECTS,
  // Stałe Miotacza
  SNOWTHROWER_RANGE,
  SNOWTHROWER_WIDTH,
  SNOWTHROWER_FREEZE_PER_TICK,
  // Stałe Gracza (do hitboxa miotacza i speed boost)
  PLAYER_DRAW_WIDTH,
  PLAYER_DRAW_HEIGHT,
  SPEED_BOOST_AMOUNT,
  MAX_MOVE_SPEED,
} from "./config.js";

// =====================================================================
// SEKCJA 1: ZARZĄDZANIE EFEKTAMI (PLAMY LODU/OGNIA)
// =====================================================================

/**
 * Tworzy nową łatę lodu w świecie.
 * @param {Array<Object>} icePatches - Obecna tablica łat lodu.
 * @param {number} worldX - Pozycja X.
 * @param {number} worldY - Pozycja Y.
 */
export function createIcePatch(icePatches, worldX, worldY) {
  icePatches.push({
    worldX: worldX,
    worldY: worldY,
    radius: ICE_PATCH_RADIUS,
    createdAt: performance.now(),
  });
}

/**
 * Tworzy nową łatę ognia w świecie.
 * @param {Array<Object>} firePatches - Obecna tablica łat ognia.
 * @param {number} worldX - Pozycja X.
 * @param {number} worldY - Pozycja Y.
 */
export function createFirePatch(firePatches, worldX, worldY) {
  firePatches.push({
    worldX: worldX,
    worldY: worldY,
    radius: FIRE_PATCH_RADIUS,
    createdAt: performance.now(),
  });
}

/**
 * Usuwa przestarzałe łaty lodu.
 * @param {Array<Object>} icePatches - Obecna tablica łat lodu.
 * @param {number} timestamp - Aktualny czas.
 * @returns {Array<Object>} - Przefiltrowana tablica.
 */
export function updateIcePatches(icePatches, timestamp) {
  return icePatches.filter((patch) => {
    return timestamp - patch.createdAt < ICE_PATCH_DURATION_MS;
  });
}

/**
 * Usuwa przestarzałe łaty ognia.
 * @param {Array<Object>} firePatches - Obecna tablica łat ognia.
 * @param {number} timestamp - Aktualny czas.
 * @returns {Array<Object>} - Przefiltrowana tablica.
 */
export function updateFirePatches(firePatches, timestamp) {
  return firePatches.filter((patch) => {
    return timestamp - patch.createdAt < FIRE_PATCH_DURATION_MS;
  });
}

/**
 * Sprawdza, czy stopy jednostki znajdują się na plamie lodu (kolizja kołowa).
 */
export function checkEntityOnIce(worldX, worldY, entityHeight, icePatches) {
  for (const patch of icePatches) {
    const playerFeetY = worldY + entityHeight / 4;
    const distanceSquared = Math.hypot(worldX - patch.worldX, playerFeetY - patch.worldY) ** 2;
    if (distanceSquared < patch.radius * patch.radius) {
      return true; // Stopy są w kole
    }
  }
  return false;
}

/**
 * Sprawdza, czy stopy jednostki znajdują się na plamie ognia (kolizja kołowa).
 */
export function checkEntityOnFire(
  worldX,
  worldY,
  objectWidth,
  objectHeight,
  firePatches
) {
  for (const patch of firePatches) {
    const objectFeetY = worldY + objectHeight / 4;
    const distanceSquared = Math.hypot(worldX - patch.worldX, objectFeetY - patch.worldY) ** 2;
    if (distanceSquared < patch.radius * patch.radius) {
      return true; // Stopy są w kole
    }
  }
  return false;
}

// =====================================================================
// SEKCJA 2: ZBIERANIE BONUSÓW I KOLIZJE BYTÓW
// =====================================================================

/**
 * Sprawdza, czy gracz zebrał bonusy i aktualizuje jego statystyki.
 * (Wersja z limitem prędkości i mniejszym bonusem)
 */
export function checkAndCollectBonuses(player, bonuses, statusMessage) {
  const newBonuses = []; // Bonusy, które zostaną na mapie
  for (const bonus of bonuses) {
    const distance = Math.hypot(
      player.worldX - bonus.worldX,
      player.worldY - bonus.worldY
    );

    if (distance < BONUS_PICKUP_RANGE) {
      // Gracz zebrał bonus
      if (bonus.type === "speedBoost") {
        
        if (player.moveSpeed < MAX_MOVE_SPEED) {
          // Dodaj mniejszą wartość
          player.moveSpeed += SPEED_BOOST_AMOUNT;
          
          // Natychmiast zastosuj limit, jeśli został przekroczony
          player.moveSpeed = Math.min(player.moveSpeed, MAX_MOVE_SPEED);
          
          statusMessage.textContent = `Gracz ${player.id} zebrał bonus! (Prędkość: ${player.moveSpeed.toFixed(1)})`;
        } else {
          // Gracz ma już max prędkość
          statusMessage.textContent = `Gracz ${player.id} ma już maksymalną prędkość!`;
        }

      } else if (bonus.type === "bombType_fire") {
        player.currentFireBombs += 3;
        statusMessage.textContent = `Gracz ${player.id} zebrał 3 bomby ogniste! (Ma: ${player.currentFireBombs})`;
      } else if (bonus.type === "extraBomb") {
        player.maxBombs++;
        player.currentSnowballs += 3; // (Logika armatki)
        statusMessage.textContent = `Gracz ${player.id} zebrał bonus! (Max Bomb/Śnieżki)`;
      }
    } else {
      // Bonus nie został zebrany
      newBonuses.push(bonus);
    }
  }
  return newBonuses; // Zwróć zaktualizowaną listę
}

/**
 * Sprawdza kolizję gracza z botem (dotyk = stun).
 */
export function checkPlayerBotCollision(player, bots, statusMessage) {
  if (!player.isAlive || player.isStunned) return; // Stunowany gracz nie może być złapany

  const duckRect = {
    x: player.worldX - player.drawWidth / 2,
    y: player.worldY - player.drawHeight / 2,
    width: player.drawWidth,
    height: player.drawHeight,
  };
  for (const bot of bots) {
    if (!bot.isAlive || bot.isStunned) continue; // Stunowany bot nie łapie

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
      // Kolizja z botem = natychmiastowe 100% zamrożenia i STUN
      player.freezeLevel = 0;
      player.isStunned = true;
      player.stunEndTime = performance.now() + STUN_DURATION_MS;
      statusMessage.textContent = `Gracz ${player.id} złapany przez bota! ZAMROŻONY!`;
      break; // Wystarczy jedna kolizja
    }
  }
}

// =====================================================================
// SEKCJA 3: SKUTKI EKSPLOZJI (BOMBY)
// =====================================================================

/**
 * Niszczy bloki (i tworzy bonusy) w okrągłym zasięgu eksplozji.
 */
export function destroyBlocksInCircle(
  worldBlocks,
  bonuses,
  centerX,
  centerY,
  radius
) {
  const blocksToKeep = [];
  const newlyCreatedBonuses = [];
  const radiusSquared = radius * radius;

  for (const block of worldBlocks) {
    const closestX = Math.max(
      block.worldX,
      Math.min(centerX, block.worldX + BOX_SIZE)
    );
    const closestY = Math.max(
      block.worldY,
      Math.min(centerY, block.worldY + BOX_SIZE)
    );
    const distanceSquared = Math.hypot(centerX - closestX, centerY - closestY) ** 2;

    let wasHit = distanceSquared < radiusSquared;

    if (wasHit) {
      // Tylko typ 0 i 1 są zniszczalne.
      if (block.type === 0 || block.type === 1) {
        if (Math.random() < 0.3) {
          let bonusType = "extraBomb";
          const typeRoll = Math.random();
          if (typeRoll < 0.33) bonusType = "extraBomb";
          else if (typeRoll < 0.66) bonusType = "speedBoost";
          else bonusType = "bombType_fire";
          
          newlyCreatedBonuses.push({
            worldX: block.worldX + BOX_SIZE / 2,
            worldY: block.worldY + BOX_SIZE / 2,
            type: bonusType,
          });
        }
      } else {
        blocksToKeep.push(block); // Zachowaj niezniszczalny (typ 2 i 3)
      }
    } else {
      blocksToKeep.push(block); // Zachowaj nietrafiony
    }
  }
  
  return {
    newWorldBlocks: blocksToKeep,
    newBonuses: [...bonuses, ...newlyCreatedBonuses],
  };
}

/**
 * Sprawdza kolizję jednostek i ścian lodu z okrągłym wybuchem.
 * Aplikuje efekty Krio (obrażenia, leczenie, stun, shatter).
 */
export function checkEntitiesInCircle(
  state,
  centerX,
  centerY,
  radius,
  bombType,
  statusMessage
) {
  const { players, bots, iceWalls } = state;
  const allEntities = [...players, ...bots];
  const radiusSquared = radius * radius;

  // 1. Sprawdź jednostki (Gracze i Boty)
  for (const entity of allEntities) {
    if (!entity.keyMap || !entity.isAlive) continue;

    const entityWidth = entity.drawWidth || entity.width;
    const distanceSquared =
      Math.hypot(centerX - entity.worldX, centerY - entity.worldY) ** 2;
    const entityRadius = entityWidth / 2;
    const totalRadius = radius + entityRadius;

    if (distanceSquared < totalRadius * totalRadius) {
      let freezePower = (FREEZE_EFFECTS[bombType] || FREEZE_EFFECTS.normal).player;

      if (freezePower < 0) { // Bomba OGNISTA (HEAL)
        if (entity.freezeLevel > 0) {
          entity.freezeLevel = Math.max(0, entity.freezeLevel + freezePower);
        }
        entity.isStunned = false;
        entity.stunEndTime = 0;
      } else { // Bomba MROŻĄCA
        if (entity.isStunned) {
          entity.isAlive = false;
          statusMessage.textContent = `Jednostka ${entity.id} została wyeliminowana!`;
        } else {
          entity.freezeLevel = Math.min(
            MAX_FREEZE_LEVEL,
            entity.freezeLevel + freezePower
          );
          if (entity.freezeLevel >= MAX_FREEZE_LEVEL) {
            entity.freezeLevel = 0;
            entity.isStunned = true;
            entity.stunEndTime = performance.now() + STUN_DURATION_MS;
          }
        }
      }
    }
  }

  // 2. Sprawdź ściany lodu
  const wallsToKeep = [];
  for (const wall of iceWalls) {
    const wallCenterX = wall.x + wall.width / 2;
    const wallCenterY = wall.y + wall.height / 2;
    const distSquared =
      Math.hypot(centerX - wallCenterX, centerY - wallCenterY) ** 2;
    const wallRadius = wall.width / 2;
    const totalRadiusForWall = radius + wallRadius;

    if (
      distSquared < totalRadiusForWall * totalRadiusForWall &&
      wall.isDestructible
    ) {
      // Ściana trafiona - zniszcz ją
    } else {
      wallsToKeep.push(wall);
    }
  }
  
  return wallsToKeep;
}

// =====================================================================
// SEKCJA 4: LOGIKA BRONI SPECJALNYCH (MIOTACZ)
// =====================================================================

/**
 * Aplikuje efekt zamrożenia miotacza śniegu (Snowthrower) na cele.
 * @param {Object} player - Gracz, który strzela.
 * @param {Object} state - Obiekt stanu gry { players, bots, worldBlocks, bonuses, statusMessage }.
 */
export function applySnowthrowerHit(player, state) {
  const { players, bots, worldBlocks, bonuses, statusMessage } = state;
  const allEntities = [...players, ...bots];

  // 1. Zdefiniuj "hitbox" strumienia
  const range = SNOWTHROWER_RANGE;
  const width = SNOWTHROWER_WIDTH;
  let streamRect = { x: 0, y: 0, width: 0, height: 0 };
  switch (player.currentStatus) {
    case "back":  
      streamRect.width = width; streamRect.height = range;
      streamRect.x = player.worldX - width / 2;
      streamRect.y = player.worldY - range - player.drawHeight / 2;
      break;
    case "front": 
      streamRect.width = width; streamRect.height = range;
      streamRect.x = player.worldX - width / 2;
      streamRect.y = player.worldY + player.drawHeight / 2;
      break;
    case "left":  
      streamRect.width = range; streamRect.height = width;
      streamRect.x = player.worldX - range - player.drawWidth / 2;
      streamRect.y = player.worldY - width / 2;
      break;
    case "right": 
      streamRect.width = range; streamRect.height = width;
      streamRect.x = player.worldX + player.drawWidth / 2;
      streamRect.y = player.worldY - width / 2;
      break;
    default:
      return; 
  }

  // 2. Sprawdź kolizję z jednostkami
  for (const entity of allEntities) {
    if (!entity.isAlive || entity.id === player.id) continue;
    const eWidth = entity.drawWidth || entity.width;
    const eHeight = entity.drawHeight || entity.height;
    const entityRect = { x: entity.worldX - eWidth / 2, y: entity.worldY - eHeight / 2, width: eWidth, height: eHeight };

    if (
      streamRect.x < entityRect.x + entityRect.width &&
      streamRect.x + streamRect.width > entityRect.x &&
      streamRect.y < entityRect.y + entityRect.height &&
      streamRect.y + streamRect.height > entityRect.y
    ) {
      const freezeAmount = FREEZE_EFFECTS.snowthrower.player;
      if (entity.isStunned) {
        entity.isAlive = false;
        if(statusMessage) {
            statusMessage.textContent = `Jednostka ${entity.id} została wyeliminowana!`;
        }
      } 
      else if (entity.freezeLevel < MAX_FREEZE_LEVEL) {
        entity.freezeLevel = Math.min(MAX_FREEZE_LEVEL, entity.freezeLevel + freezeAmount);
        if (entity.freezeLevel >= MAX_FREEZE_LEVEL) {
          entity.freezeLevel = 0;
          entity.isStunned = true;
          entity.stunEndTime = performance.now() + STUN_DURATION_MS;
        }
      }
    }
  }

  // 3. Sprawdź kolizję z blokami
  const blocksToRemove = new Set();
  for (const block of worldBlocks) {
    // Tylko typ 0 i 1 są zniszczalne
    if (block.type !== 0 && block.type !== 1) {
      continue; 
    }

    const blockRect = { x: block.worldX, y: block.worldY, width: BOX_SIZE, height: BOX_SIZE };
    if (
      streamRect.x < blockRect.x + blockRect.width &&
      streamRect.x + streamRect.width > blockRect.x &&
      streamRect.y < blockRect.y + blockRect.height &&
      streamRect.y + streamRect.height > blockRect.y
    ) {
      blocksToRemove.add(block);
    }
  }

  // 4. Zastosuj zniszczenie i stwórz bonusy
  if (blocksToRemove.size > 0) {
    state.worldBlocks = worldBlocks.filter(block => !blocksToRemove.has(block));
    
    blocksToRemove.forEach(block => {
      if (Math.random() < 0.3) { 
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
    state.bonuses = bonuses;
  }
}