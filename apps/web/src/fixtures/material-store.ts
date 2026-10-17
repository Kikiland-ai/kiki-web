import { IntakeRequestSchema, type IntakeRequest } from '../contracts/intake';

/** Actual browser storage of preview files; no cloud transfer or OCR is simulated. */
const database = 'kiki-material-preview-v1';
async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(database, 2);
    request.onupgradeneeded = () => { for (const name of ['requests','blobs','texts']) { if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, name === 'requests' ? { keyPath: 'id' } : undefined); } };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Browser storage could not open.'));
  });
}
async function transact<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode); let value: T;
      tx.oncomplete = () => resolve(value);
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('The file could not be saved in this browser.'));
      work(tx, next => { value = next; });
    });
  } finally { db.close(); }
}
export async function listRequests(): Promise<IntakeRequest[]> {
  return transact(['requests'], 'readonly', (tx, result) => { const r = tx.objectStore('requests').getAll(); r.onsuccess = () => { try { result(r.result.map((x: unknown) => IntakeRequestSchema.parse(x))); } catch { tx.abort(); } }; });
}
export async function storeRequest(request: IntakeRequest, files: { id: string; blob: Blob }[] = [], texts: { id: string; text: string }[] = []): Promise<IntakeRequest> {
  const valid = IntakeRequestSchema.parse(request);
  return transact<IntakeRequest>(['requests', 'blobs', 'texts'], 'readwrite', (tx, result) => {
    tx.objectStore('requests').put(valid);
    files.forEach(file => tx.objectStore('blobs').put(file.blob, file.id));
    texts.forEach(item => tx.objectStore('texts').put(item.text, item.id));
    result(valid);
  });
}
export async function readBlob(id: string): Promise<Blob> {
  return transact(['blobs'], 'readonly', (tx, result) => {
    const r = tx.objectStore('blobs').get(id);
    r.onsuccess = () => { if (r.result instanceof Blob) result(r.result); else tx.abort(); };
  });
}

export async function readText(id: string): Promise<string> {
  return transact(['texts'], 'readonly', (tx, result) => {
    const r = tx.objectStore('texts').get(id);
    r.onsuccess = () => { if (typeof r.result === 'string') result(r.result); else tx.abort(); };
  });
}
