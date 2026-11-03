const DB_NAME = "dressopp-storage";
const DB_VERSION = 1;
const STORE_NAME = "app-state";
const STATE_KEY = "primary";
const FALLBACK_KEY = "dressopp-state-v1";
let databasePromise;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise(function(resolve, reject) {
    if (!("indexedDB" in globalThis)) { reject(new Error("IndexedDB indisponible")); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = function() {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = function() { resolve(request.result); };
    request.onerror = function() { reject(request.error || new Error("Ouverture de la base impossible")); };
  });
  return databasePromise;
}

export async function loadState() {
  let indexedState = null;
  let fallbackState = null;

  try {
    const database = await openDatabase();
    indexedState = await new Promise(function(resolve, reject) {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = function() { resolve(request.result ? request.result.value : null); };
      request.onerror = function() { reject(request.error); };
    });
  } catch (error) {
    console.warn("Lecture IndexedDB impossible, essai du stockage de secours.", error);
  }

  try {
    const backup = localStorage.getItem(FALLBACK_KEY);
    fallbackState = backup ? JSON.parse(backup) : null;
  } catch (error) {
    console.warn("Aucune sauvegarde locale de secours lisible.", error);
  }

  const indexedDate = indexedState && Date.parse(indexedState.updatedAt || "") || 0;
  const fallbackDate = fallbackState && Date.parse(fallbackState.updatedAt || "") || 0;
  return fallbackState && fallbackDate > indexedDate
    ? fallbackState
    : (indexedState || fallbackState || null);
}

export async function saveState(state) {
  const snapshot = JSON.parse(JSON.stringify(state));
  snapshot.updatedAt = new Date().toISOString();
  try {
    const database = await openDatabase();
    await new Promise(function(resolve, reject) {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ id: STATE_KEY, value: snapshot });
      transaction.oncomplete = function() { resolve(); };
      transaction.onerror = function() { reject(transaction.error); };
      transaction.onabort = function() { reject(transaction.error || new Error("Écriture annulée")); };
    });
    return { ok: true, method: "IndexedDB", updatedAt: snapshot.updatedAt };
  } catch (error) {
    console.warn("Écriture IndexedDB impossible, essai du stockage de secours.", error);
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(snapshot));
      return { ok: true, method: "localStorage", warning: "Stockage de secours utilisé", updatedAt: snapshot.updatedAt };
    } catch (fallbackError) { return { ok: false, error: fallbackError.message || error.message }; }
  }
}

export async function clearState() {
  try {
    const database = await openDatabase();
    await new Promise(function(resolve, reject) {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(STATE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = function() { reject(transaction.error); };
    });
  } catch (error) { console.warn("Suppression IndexedDB incomplète.", error); }
  try { localStorage.removeItem(FALLBACK_KEY); } catch (error) { console.warn(error); }
}
