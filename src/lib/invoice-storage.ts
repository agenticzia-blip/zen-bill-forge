export const CURRENT_KEY = "invoice-generator-data-v2";
export const SAVED_LIST_KEY = "invoice-saved-list-v1";
export const LOAD_PENDING_KEY = "invoice-load-pending-v1";

const DB_NAME = "invoice-generator-saved-db";
const DB_VERSION = 1;
const DB_STORE = "savedInvoices";
const SIXTY_YEARS_MS = 60 * 365 * 24 * 60 * 60 * 1000;

export type SavedInvoice = {
  id: string;
  savedAt: number;
  expiresAt?: number;
  invoiceNumber: string;
  displayName?: string;
  total: number;
  currencySymbol: string;
  snapshot: unknown;
};

// Effectively unlimited capacity — keep up to 10,000 invoices locally.
const MAX_SAVED = 10000;

export function getSavedInvoices(): SavedInvoice[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(SAVED_LIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? sortInvoices(arr) : [];
  } catch {
    return [];
  }
}

function sortInvoices(list: SavedInvoice[]): SavedInvoice[] {
  return [...list].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

function withRetention(entry: SavedInvoice): SavedInvoice {
  return {
    ...entry,
    expiresAt: entry.expiresAt ?? entry.savedAt + SIXTY_YEARS_MS,
  };
}

function sameInvoice(a: SavedInvoice, b: SavedInvoice): boolean {
  const an = a.invoiceNumber?.trim();
  const bn = b.invoiceNumber?.trim();
  if (an && bn) return an === bn;
  return a.id === b.id;
}

function mergeInvoiceLists(list: SavedInvoice[]): SavedInvoice[] {
  const map = new Map<string, SavedInvoice>();
  for (const item of list) {
    const key = item.invoiceNumber?.trim()
      ? `number:${item.invoiceNumber.trim()}`
      : `id:${item.id}`;
    const existing = map.get(key);
    if (!existing || (item.savedAt || 0) > (existing.savedAt || 0)) {
      map.set(key, withRetention(item));
    }
  }
  return sortInvoices([...map.values()]).slice(0, MAX_SAVED);
}

function stripLogo(i: SavedInvoice): SavedInvoice {
  return i.snapshot && typeof i.snapshot === "object"
    ? {
        ...i,
        snapshot: {
          ...(i.snapshot as Record<string, unknown>),
          logo: null,
        },
      }
    : i;
}

function trySetList(list: SavedInvoice[]): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(SAVED_LIST_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function saveInvoiceSnapshot(entry: SavedInvoice): SavedInvoice {
  const nextEntry = withRetention(entry);
  const list = getSavedInvoices();
  // Replace if same invoiceNumber, else prepend
  const filtered = list.filter((i) => !sameInvoice(i, nextEntry));
  filtered.unshift(nextEntry);
  let trimmed = mergeInvoiceLists(filtered).slice(0, MAX_SAVED);
  if (trySetList(trimmed)) return nextEntry;

  // Quota hit — progressively shed logos from oldest first, then drop oldest entries.
  for (let i = trimmed.length - 1; i >= 0; i--) {
    trimmed[i] = stripLogo(trimmed[i]);
    if (trySetList(trimmed)) return stripLogo(nextEntry);
  }
  while (trimmed.length > 1) {
    trimmed = trimmed.slice(0, Math.floor(trimmed.length / 2));
    if (trySetList(trimmed)) return stripLogo(nextEntry);
  }

  const smallestPossible = [stripLogo(nextEntry)];
  if (trySetList(smallestPossible)) return smallestPossible[0];

  throw new Error("Unable to save invoice because browser storage is full.");
}

export function deleteSavedInvoice(id: string) {
  const list = getSavedInvoices().filter((i) => i.id !== id);
  localStorage.setItem(SAVED_LIST_KEY, JSON.stringify(list));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open invoice DB"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Invoice DB transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("Invoice DB transaction failed"));
  });
}

function getAllFromDb(db: IDBDatabase): Promise<SavedInvoice[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error ?? new Error("Could not read saved invoices"));
  });
}

async function putManyInDb(db: IDBDatabase, list: SavedInvoice[]) {
  const tx = db.transaction(DB_STORE, "readwrite");
  const store = tx.objectStore(DB_STORE);
  list.forEach((item) => store.put(withRetention(item)));
  await txDone(tx);
}

async function pruneDb(db: IDBDatabase) {
  const list = sortInvoices(await getAllFromDb(db));
  const toDelete = list.slice(MAX_SAVED);
  if (toDelete.length === 0) return;

  const tx = db.transaction(DB_STORE, "readwrite");
  const store = tx.objectStore(DB_STORE);
  toDelete.forEach((item) => store.delete(item.id));
  await txDone(tx);
}

export async function getSavedInvoicesAsync(): Promise<SavedInvoice[]> {
  const localList = getSavedInvoices();

  try {
    const db = await openDb();
    try {
      const dbList = await getAllFromDb(db);
      const merged = mergeInvoiceLists([...dbList, ...localList]);

      // Migrate older localStorage saves into IndexedDB so they do not disappear.
      if (localList.length > 0 || merged.length !== dbList.length) {
        await putManyInDb(db, merged);
      }

      return merged;
    } finally {
      db.close();
    }
  } catch {
    return localList;
  }
}

export async function getSavedInvoiceByIdAsync(id: string): Promise<SavedInvoice | null> {
  try {
    const db = await openDb();
    try {
      const fromDb = await new Promise<SavedInvoice | undefined>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readonly");
        const store = tx.objectStore(DB_STORE);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result as SavedInvoice | undefined);
        request.onerror = () => reject(request.error ?? new Error("Could not read invoice"));
      });
      if (fromDb) return withRetention(fromDb);
    } finally {
      db.close();
    }
  } catch {
    // Fall through to localStorage backup.
  }

  return getSavedInvoices().find((item) => item.id === id) ?? null;
}

export async function saveInvoiceSnapshotAsync(entry: SavedInvoice): Promise<SavedInvoice> {
  const nextEntry = withRetention(entry);

  try {
    const db = await openDb();
    try {
      const existing = await getAllFromDb(db);
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      existing
        .filter((item) => sameInvoice(item, nextEntry) && item.id !== nextEntry.id)
        .forEach((item) => store.delete(item.id));
      store.put(nextEntry);
      await txDone(tx);
      await pruneDb(db);
    } finally {
      db.close();
    }

    // Keep a smaller localStorage backup for browsers/users where IndexedDB is blocked later.
    try {
      saveInvoiceSnapshot(nextEntry);
    } catch {
      trySetList([stripLogo(nextEntry)]);
    }

    return nextEntry;
  } catch {
    // Fallback for private browsing / blocked IndexedDB.
    return saveInvoiceSnapshot(nextEntry);
  }
}

export async function deleteSavedInvoiceAsync(id: string) {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(id);
      await txDone(tx);
    } finally {
      db.close();
    }
  } catch {
    // localStorage cleanup below still runs.
  }

  deleteSavedInvoice(id);
}

