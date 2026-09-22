// [M6-A-7] Upgrade additivo della coda da schema 1 a schema 2, **esplicitamente invocabile**.
//
// Porta nel runtime il candidato approvato in M6-A-2 R1/R2. Non viene avviato da nessun percorso
// automatico dell'app: lo invoca solo chi lo chiama (nel pilota di sviluppo, su richiesta). Crea
// **solo** lo store `queueLeases` nella stessa transazione di cambio versione e non tocca
// `encryptedOperations`: contenitori sigillati e stati di riconciliazione restano identici.
// Su blocco, scadenza, abort o schema inatteso fallisce chiuso, senza coda vuota, senza scritture
// o invii e senza lasciare connessioni aperte.
const fail = code => Object.assign(new Error(code), {code});
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});

export async function upgradeOfflineQueueSchema({uid, indexedDb = globalThis.indexedDB, signal, isActive = () => true, timeoutMs = 10000, mode = 'create'} = {}) {
    if (typeof uid !== 'string' || !uid || !indexedDb || !['create', 'abort'].includes(mode) ||
        typeof isActive !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw fail('QUEUE_UPGRADE_CONFIG');
    const name = `codex-offline-queue-${uid}`;
    const check = () => { if (signal?.aborted || !isActive()) throw fail('QUEUE_UPGRADE_SESSION'); };
    check();

    // 1. Sonda **senza versione** e **limitata nel tempo**: una coda assente resta assente e uno
    //    schema che non è la v1 attesa viene rifiutato prima di qualsiasi cambio di versione. La
    //    transazione di sola lettura viene portata a conclusione prima di chiudere la connessione,
    //    perché una chiusura ancora in sospeso può bloccare il cambio versione (M6-A-2 R2).
    const probe = indexedDb.open(name);
    let probeSettled = false;
    await new Promise((resolve, reject) => {
        const settle = error => {
            if (probeSettled) return;
            probeSettled = true; clearTimeout(timer);
            if (error) reject(error); else resolve();
        };
        const timer = setTimeout(() => settle(fail('QUEUE_UPGRADE_TIMEOUT')), timeoutMs);
        probe.onupgradeneeded = () => { probe.transaction.abort(); settle(fail('QUEUE_UPGRADE_MISSING')); };
        probe.onblocked = () => settle(fail('QUEUE_UPGRADE_BLOCKED'));
        probe.onerror = () => settle(probe.error || fail('QUEUE_UPGRADE_OPEN'));
        probe.onsuccess = () => {
            if (probeSettled) { probe.result?.close(); return; }
            settle(null);
        };
    });
    const current = probe.result;
    try {
        if (current.version !== 1 || !current.objectStoreNames.contains('encryptedOperations')) throw fail('QUEUE_UPGRADE_SCHEMA');
        const transaction = current.transaction('encryptedOperations', 'readonly');
        const store = transaction.objectStore('encryptedOperations');
        if (store.keyPath !== 'id' || store.autoIncrement) throw fail('QUEUE_UPGRADE_SCHEMA');
        await new Promise((resolve, reject) => {
            store.count();
            transaction.oncomplete = () => resolve();
            transaction.onabort = transaction.onerror = () => reject(fail('QUEUE_UPGRADE_SCHEMA'));
        });
    } finally { current.close(); }

    // 2. Cambio di versione additivo. Semantica di blocco e scadenza (M6-A-2 R1): dopo un errore
    //    riportato al chiamante un upgrade tardivo viene annullato e un successo tardivo chiude la
    //    connessione; la scadenza non può dichiarare fallito un upgrade già avviato.
    const request = indexedDb.open(name, 2);
    let abortReason = null, settled = false, timer = null;
    const done = new Promise((resolve, reject) => {
        const settle = (error, value) => {
            if (settled) return;
            settled = true; clearTimeout(timer);
            if (error) reject(error); else resolve(value);
        };
        timer = setTimeout(() => settle(fail('QUEUE_UPGRADE_TIMEOUT')), timeoutMs);
        request.onupgradeneeded = () => {
            clearTimeout(timer);
            if (settled) { request.transaction.abort(); return; }
            try {
                const database = request.result;
                if (!database.objectStoreNames.contains('encryptedOperations')) {
                    abortReason = fail('QUEUE_UPGRADE_SCHEMA'); request.transaction.abort(); return;
                }
                if (!database.objectStoreNames.contains('queueLeases')) database.createObjectStore('queueLeases', {keyPath: 'id'});
            } catch (error) { abortReason = error; request.transaction.abort(); return; }
            if (mode === 'abort') { abortReason = fail('QUEUE_UPGRADE_ABORTED'); request.transaction.abort(); }
        };
        request.onblocked = () => settle(fail('QUEUE_UPGRADE_BLOCKED'));
        request.onerror = () => settle(abortReason || request.error || fail('QUEUE_UPGRADE_FAILED'));
        request.onsuccess = () => {
            const database = request.result;
            if (settled) { database.close(); return; }
            try {
                check();
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

// Sonda di sola lettura: versione, store e righe grezze della coda. Serve alle prove e alla
// diagnostica del pilota; non scrive e non migra.
export async function inspectOfflineQueueSchema({uid, indexedDb = globalThis.indexedDB, timeoutMs = 10000} = {}) {
    if (typeof uid !== 'string' || !uid || !indexedDb || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw fail('QUEUE_UPGRADE_CONFIG');
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
