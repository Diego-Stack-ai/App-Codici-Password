const DATABASE_NAME = 'codex-vault-offline-files';
const DATABASE_VERSION = 1;
const STORE_NAME = 'encrypted-attachments';
export const MAX_OFFLINE_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_OFFLINE_TOTAL_BYTES = 100 * 1024 * 1024;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
                store.createIndex('uid', 'uid', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function keyFor(uid, storagePath) {
    if (!uid || !storagePath) throw new Error('OFFLINE_ATTACHMENT_ID_REQUIRED');
    return `${uid}:${storagePath}`;
}

async function withStore(mode, operation) {
    const database = await openDatabase();
    try {
        const transaction = database.transaction(STORE_NAME, mode);
        const completion = new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error('OFFLINE_ATTACHMENT_TRANSACTION_ABORTED'));
        });
        const result = await operation(transaction.objectStore(STORE_NAME));
        await completion;
        return result;
    } finally {
        database.close();
    }
}

export async function getOfflineAttachment(uid, storagePath) {
    try {
        const record = await withStore('readonly', store => requestResult(store.get(keyFor(uid, storagePath))));
        return record?.ciphertext || null;
    } catch {
        return null;
    }
}

export async function hasOfflineAttachment(uid, storagePath) {
    return Boolean(await getOfflineAttachment(uid, storagePath));
}

export async function saveOfflineAttachment(uid, attachment, ciphertext) {
    if (!attachment?.storagePath || !attachment?.encryption || !(ciphertext instanceof ArrayBuffer)) {
        throw new Error('OFFLINE_ATTACHMENT_INVALID');
    }
    if (ciphertext.byteLength > MAX_OFFLINE_ATTACHMENT_BYTES) throw new Error('OFFLINE_ATTACHMENT_TOO_LARGE');
    const targetKey = keyFor(uid, attachment.storagePath);
    const usage = await withStore('readonly', store => new Promise((resolve, reject) => {
        let usedBytes = 0;
        let previousBytes = 0;
        const request = store.openCursor();
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) { resolve({ usedBytes, previousBytes }); return; }
            usedBytes += cursor.value.byteLength || 0;
            if (cursor.value.key === targetKey) previousBytes = cursor.value.byteLength || 0;
            cursor.continue();
        };
        request.onerror = () => reject(request.error);
    }));
    const { usedBytes, previousBytes } = usage;
    if (usedBytes - previousBytes + ciphertext.byteLength > MAX_OFFLINE_TOTAL_BYTES) {
        throw new Error('OFFLINE_ATTACHMENT_QUOTA');
    }
    await withStore('readwrite', store => requestResult(store.put({
        key: targetKey,
        uid,
        storagePath: attachment.storagePath,
        byteLength: ciphertext.byteLength,
        savedAt: Date.now(),
        ciphertext
    })));
}

export async function removeOfflineAttachment(uid, storagePath) {
    await withStore('readwrite', store => requestResult(store.delete(keyFor(uid, storagePath))));
}
