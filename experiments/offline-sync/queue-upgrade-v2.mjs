// M6-A-2 — laboratorio: upgrade additivo della coda da schema 1 a schema 2.
//
// SOLO laboratorio. Non è collegato al runtime dell'app e nessun file di `Frontend/public/**`
// lo importa: l'upgrade reale resta da progettare in un incarico dedicato, dopo la prova mista
// di convivenza (M6-F3). Il modulo aggiunge **solo** lo store `queueLeases` nella stessa
// transazione di cambio versione; non tocca `encryptedOperations`, non scrive, non cancella.
const fail = code => Object.assign(new Error(code), {code});
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});

export async function upgradeQueueSchemaToV2({uid, indexedDb = globalThis.indexedDB, mode = 'create', timeoutMs = 10000} = {}) {
    if (typeof uid !== 'string' || !uid || !indexedDb || !['create', 'abort'].includes(mode) ||
        !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw fail('QUEUE_UPGRADE_CONFIG');
    const name = `codex-offline-queue-${uid}`;

    // 1. Lettura dello schema **senza imporre una versione**: una coda assente resta assente e
    //    uno schema che non è la v1 attesa viene rifiutato prima di qualsiasi cambio di versione.
    const probe = indexedDb.open(name);
    await new Promise((resolve, reject) => {
        probe.onupgradeneeded = () => { probe.transaction.abort(); reject(fail('QUEUE_UPGRADE_MISSING')); };
        probe.onerror = () => reject(probe.error || fail('QUEUE_UPGRADE_OPEN'));
        probe.onblocked = () => reject(fail('QUEUE_UPGRADE_BLOCKED'));
        probe.onsuccess = () => resolve();
    });
    const current = probe.result;
    try {
        if (current.version !== 1 || !current.objectStoreNames.contains('encryptedOperations')) throw fail('QUEUE_UPGRADE_SCHEMA');
        const store = current.transaction('encryptedOperations', 'readonly').objectStore('encryptedOperations');
        if (store.keyPath !== 'id' || store.autoIncrement) throw fail('QUEUE_UPGRADE_SCHEMA');
    } finally { current.close(); }

    // 2. Cambio di versione additivo: lo store del lease nasce **dentro** `onupgradeneeded`,
    //    cioè nella stessa transazione che porta il database a 2 (è l'unico punto in cui
    //    `createObjectStore` è lecito, quindi versione e store sono atomici per costruzione).
    const request = indexedDb.open(name, 2);
    let abortReason = null;
    const done = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(fail('QUEUE_UPGRADE_TIMEOUT')), timeoutMs);
        const settle = (error, value) => { clearTimeout(timer); error ? reject(error) : resolve(value); };
        request.onupgradeneeded = () => {
            try {
                const database = request.result;
                if (database.objectStoreNames.contains('encryptedOperations') === false) {
                    abortReason = fail('QUEUE_UPGRADE_SCHEMA'); request.transaction.abort(); return;
                }
                if (!database.objectStoreNames.contains('queueLeases')) database.createObjectStore('queueLeases', {keyPath: 'id'});
            } catch (error) { abortReason = error; request.transaction.abort(); return; }
            if (mode === 'abort') { abortReason = fail('QUEUE_UPGRADE_ABORTED'); request.transaction.abort(); }
        };
        request.onblocked = () => settle(fail('QUEUE_UPGRADE_BLOCKED'));
        request.onerror = () => settle(abortReason || request.error || fail('QUEUE_UPGRADE_FAILED'));
        request.onsuccess = async () => {
            const database = request.result;
            try {
                if (mode === 'abort') throw fail('QUEUE_UPGRADE_ABORTED');
                if (database.version !== 2 || !database.objectStoreNames.contains('encryptedOperations') ||
                    !database.objectStoreNames.contains('queueLeases')) throw fail('QUEUE_UPGRADE_VERIFY');
                settle(null, {version: database.version, database});
            } catch (error) { database.close(); settle(error); }
        };
    });
    const outcome = await done;
    outcome.database.close();
    return {version: outcome.version, created: ['queueLeases']};
}

// Sonda di sola lettura per il banco: versione, store e righe grezze della coda.
export async function inspectQueueSchema({uid, indexedDb = globalThis.indexedDB} = {}) {
    const database = await requestValue(indexedDb.open(`codex-offline-queue-${uid}`));
    try {
        const rows = [];
        const request = database.transaction('encryptedOperations', 'readonly').objectStore('encryptedOperations').openCursor();
        await new Promise((resolve, reject) => {
            request.onerror = () => reject(request.error || fail('QUEUE_UPGRADE_READ'));
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) { resolve(); return; }
                rows.push(cursor.value); cursor.continue();
            };
        });
        return {version: database.version, stores: [...database.objectStoreNames].sort(), rows};
    } finally { database.close(); }
}
