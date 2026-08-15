import { ExpenseItem } from '../types/expense';

/**
 * Persistence for the expense list.
 *
 * Receipt images used to be kept inline in localStorage, which allows about
 * 5 MB. A scanned bill stores as roughly 550 KB, so from around the ninth
 * scanned expense every write threw QuotaExceededError: the row stayed on
 * screen but was never saved, and reopening the app showed it gone.
 *
 * The list itself is small and stays in localStorage so it is available
 * synchronously on first paint. The images go to IndexedDB, whose quota is
 * measured in hundreds of megabytes, and are merged back in as they load.
 */

const EXPENSES_KEY = 'aims_expenses';
const DB_NAME = 'aims-receipts';
const STORE_NAME = 'images';
const DB_VERSION = 1;

/** What actually goes into localStorage: everything except the image itself. */
type StoredExpense = Omit<ExpenseItem, 'receiptImage'> & { hasImage?: boolean };

export interface PersistResult {
  ok: boolean;
  /** True when the browser refused to store the data. */
  quotaExceeded: boolean;
}

/* ------------------------------------------------------------------ *
 * IndexedDB, wrapped in promises
 * ------------------------------------------------------------------ */

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      // Private browsing and locked-down profiles can refuse outright.
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | null
): Promise<T | null> {
  return openDatabase().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction(STORE_NAME, mode);
          const request = run(tx.objectStore(STORE_NAME));
          if (!request) {
            tx.oncomplete = () => resolve(null);
            tx.onerror = () => resolve(null);
            return;
          }
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * The saved list, without images, available immediately for first paint.
 * Handles reports written by the previous format, where images were inline.
 */
export function loadExpenses(): ExpenseItem[] {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredExpense[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const { hasImage, ...rest } = item;
      // Older reports kept the image inline; it is still usable as-is.
      return rest as ExpenseItem;
    });
  } catch (e) {
    console.warn('Could not read saved expenses', e);
    return [];
  }
}

/** Fetches the stored images for the given expense ids. */
export async function loadReceiptImages(ids: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      const value = await withStore<string>('readonly', (store) => store.get(id) as IDBRequest<string>);
      if (typeof value === 'string' && value.length > 0) found.set(id, value);
    })
  );
  return found;
}

/**
 * Fills in any image that is stored but not yet in memory.
 *
 * The list paints from localStorage while the images are still coming out of
 * IndexedDB. Anything that draws bills — the compiled bills PDF above all —
 * must not depend on having been opened late enough for that to have finished,
 * or every bill prints "No bill image attached" purely because the user was
 * quick. Rows that already carry their image are returned untouched.
 */
export async function hydrateReceiptImages(expenses: ExpenseItem[]): Promise<ExpenseItem[]> {
  const missing = expenses.filter((e) => !e.receiptImage).map((e) => e.id);
  if (missing.length === 0) return expenses;

  const images = await loadReceiptImages(missing);
  if (images.size === 0) return expenses;

  return expenses.map((expense) =>
    expense.receiptImage ? expense : { ...expense, receiptImage: images.get(expense.id) }
  );
}

/** Images already written, so unchanged ones are not rewritten on every edit. */
const writtenImages = new Map<string, string>();

export async function persistExpenses(expenses: ExpenseItem[]): Promise<PersistResult> {
  const result: PersistResult = { ok: true, quotaExceeded: false };
  const liveIds = new Set(expenses.map((e) => e.id));

  // Images first: a row must never be listed as having an image that is missing.
  const imagesStored = await openDatabase().then((db) => db !== null);

  if (imagesStored) {
    await Promise.all(
      expenses.map(async (expense) => {
        const image = expense.receiptImage;
        if (!image) {
          if (writtenImages.has(expense.id)) {
            await withStore('readwrite', (store) => store.delete(expense.id) as IDBRequest<undefined>);
            writtenImages.delete(expense.id);
          }
          return;
        }
        if (writtenImages.get(expense.id) === image) return;

        const saved = await withStore('readwrite', (store) => store.put(image, expense.id) as IDBRequest<IDBValidKey>);
        if (saved === null) result.ok = false;
        else writtenImages.set(expense.id, image);
      })
    );

    // Drop images belonging to deleted rows.
    const keys = (await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys() as IDBRequest<IDBValidKey[]>)) || [];
    await Promise.all(
      keys
        .filter((key) => typeof key === 'string' && !liveIds.has(key))
        .map(async (key) => {
          await withStore('readwrite', (store) => store.delete(key) as IDBRequest<undefined>);
          writtenImages.delete(String(key));
        })
    );
  }

  // Then the list itself, with images left out when they live in IndexedDB.
  const stored: StoredExpense[] = expenses.map((expense) => {
    const { receiptImage, ...rest } = expense;
    if (imagesStored) return { ...rest, hasImage: Boolean(receiptImage) };
    // No IndexedDB available: keep the old inline behaviour so the bill is
    // not silently lost, and let the quota error surface if it comes.
    return { ...rest, receiptImage, hasImage: Boolean(receiptImage) } as StoredExpense;
  });

  try {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(stored));
  } catch (e) {
    console.warn('Could not save the expense list', e);
    result.ok = false;
    result.quotaExceeded = e instanceof DOMException && /quota/i.test(e.name);
  }

  return result;
}

/** Forgets the whole report, images included. */
export async function clearStoredExpenses(): Promise<void> {
  try {
    localStorage.removeItem(EXPENSES_KEY);
  } catch {
    // Nothing further to do; the list is gone from memory either way.
  }
  writtenImages.clear();
  await withStore('readwrite', (store) => store.clear() as IDBRequest<undefined>);
}
