// --- components/assets.js ---

import {
  frameSourcesMap,
  BOX_SOURCES,
  BONUS_SOURCES,
} from "./config.js";

/**
 * Ładuje wszystkie zasoby gry (obrazy, klatki) i raportuje postęp.
 * @param {HTMLElement} statusMessageElement - Element DOM do wyświetlania statusu.
 * @returns {Promise<Object>} Obiekt zawierający załadowane zasoby: { frames, boxFrames, bonusFrames }
 */
export function loadGameAssets(statusMessageElement) {
  const frames = {};
  const boxFrames = [];
  const bonusFrames = {};
  let loadedCount = 0;
  let totalFramesToLoad = 0;

  // 1. Oblicz całkowitą liczbę klatek (NOWA LOGIKA)
  for (const status in frameSourcesMap) {
    if (Array.isArray(frameSourcesMap[status])) {
      // Standardowe animacje (np. 'front', 'bomb', 'snowball')
      totalFramesToLoad += frameSourcesMap[status].length;
    } else if (
      typeof frameSourcesMap[status] === "object" &&
      frameSourcesMap[status] !== null
    ) {
      // Obiekty z klatkami (np. 'cannon')
      totalFramesToLoad += Object.keys(frameSourcesMap[status]).length;
    }
  }
  totalFramesToLoad += BOX_SOURCES.length;
  totalFramesToLoad += Object.keys(BONUS_SOURCES).length;

  if (totalFramesToLoad === 0) {
    statusMessageElement.textContent = "Błąd: Brak źródeł klatek do załadowania.";
    return Promise.reject("No frames to load");
  }

  let loadedPromises = [];

  // --- 2. Funkcja pomocnicza do ładowania obrazka ---
  // (Aby uniknąć powtarzania kodu)
  const createLoadPromise = (img, src) => {
    return new Promise((resolve) => {
      img.onload = () => {
        loadedCount++;
        statusMessageElement.textContent = `Ładowanie klatek... (${loadedCount} z ${totalFramesToLoad})`;
        resolve();
      };
      img.onerror = () => {
        console.error(`Błąd ładowania: ${src}`);
        resolve(); // Rozwiąż nawet w przypadku błędu
      };
      img.src = src; // Ustaw źródło na końcu
    });
  };

  // --- 3. Ładowanie klatek animacji (NOWA LOGIKA) ---
  for (const status in frameSourcesMap) {
    const sourceData = frameSourcesMap[status];

    if (Array.isArray(sourceData)) {
      // Przypadek 1: Tablica (np. 'front', 'snowball')
      frames[status] = [];
      sourceData.forEach((src) => {
        const img = new Image();
        frames[status].push(img);
        loadedPromises.push(createLoadPromise(img, src));
      });
    } else if (typeof sourceData === "object" && sourceData !== null) {
      // Przypadek 2: Obiekt (np. 'cannon')
      frames[status] = {};
      for (const key in sourceData) {
        const src = sourceData[key];
        const img = new Image();
        frames[status][key] = img;
        loadedPromises.push(createLoadPromise(img, src));
      }
    }
  }

  // --- 4. Ładowanie tekstur bloków ---
  BOX_SOURCES.forEach((src) => {
    const img = new Image();
    boxFrames.push(img);
    loadedPromises.push(createLoadPromise(img, src));
  });

  // --- 5. Ładowanie tekstur bonusów ---
  for (const bonusType in BONUS_SOURCES) {
    const src = BONUS_SOURCES[bonusType];
    const img = new Image();
    bonusFrames[bonusType] = img;
    loadedPromises.push(createLoadPromise(img, src));
  }

  // --- 6. Zwróć główną obietnicę ---
  return Promise.all(loadedPromises).then(() => {
    // Sprawdzenie klatek bota (bez zmian)
    if (!frames.bot || frames.bot.length === 0) {
      console.warn("Brak klatek bota, używam klatek 'front' jako zastępczych.");
      frames.bot = frames.front;
    }

    // Zwróć załadowane zasoby
    return { frames, boxFrames, bonusFrames };
  });
}