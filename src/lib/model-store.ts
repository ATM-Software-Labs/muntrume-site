/**
 * Local-first IndexedDB persistence for user-supplied 3D car models (.GLB / .GLTF) per car_slug.
 * Zero server uploads — models stay 100% private in the user's browser cache and auto-load
 * whenever the same iRacing car is selected again.
 */

const DB_NAME = "mmt-skins-models-v1";
const DB_VERSION = 1;
const STORE_NAME = "car_models";

export interface StoredCarModel {
  carSlug: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  buffer: ArrayBuffer;
  updatedAt: string;
}

function openModelDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible en este navegador."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "carSlug" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("No se pudo abrir IndexedDB."));
  });
}

export async function saveCarModel(carSlug: string, file: File): Promise<StoredCarModel> {
  const buffer = await file.arrayBuffer();
  const record: StoredCarModel = {
    carSlug,
    filename: file.name,
    mimeType: file.type || (file.name.toLowerCase().endsWith(".gltf") ? "model/gltf+json" : "model/gltf-binary"),
    sizeBytes: buffer.byteLength,
    buffer,
    updatedAt: new Date().toISOString(),
  };
  const db = await openModelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve(record);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Error guardando modelo 3D en IndexedDB."));
    };
  });
}

export async function loadCarModel(carSlug: string): Promise<StoredCarModel | null> {
  try {
    const db = await openModelDb();
    return await new Promise<StoredCarModel | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(carSlug);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredCarModel | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function deleteCarModel(carSlug: string): Promise<void> {
  try {
    const db = await openModelDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(carSlug);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function listSavedCarSlugs(): Promise<string[]> {
  try {
    const db = await openModelDb();
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => {
        db.close();
        resolve(Array.isArray(req.result) ? req.result.map(String) : []);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return [];
  }
}
