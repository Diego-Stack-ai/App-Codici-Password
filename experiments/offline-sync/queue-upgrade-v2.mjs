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
    //    La sonda è **limitata nel tempo**: una richiesta di apertura senza versione resta
    //    accodata dietro una richiesta di cambio versione in sospeso (comportamento osservato
    //    del motore), quindi senza limite il candidato resterebbe appeso invece di fallire
    //    chiuso. Alla scadenza nessuna richiesta di cambio versione è stata creata: la coda non
    //    può essere stata toccata da noi. Un successo tardivo della sonda chiude la connessione.
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
        const store = current.transaction('encryptedOperations', 'readonly').objectStore('encryptedOperations');
        if (store.keyPath !== 'id' || store.autoIncrement) throw fail('QUEUE_UPGRADE_SCHEMA');
    } finally { current.close(); }

    // 2. Cambio di versione additivo: lo store del lease nasce **dentro** `onupgradeneeded`,
    //    cioè nella stessa transazione che porta il database a 2 (è l'unico punto in cui
    //    `createObjectStore` è lecito, quindi versione e store sono atomici per costruzione).
    //
    //    Semantica di blocco e scadenza (correzione M6-A-2 R1). Il chiamante non deve mai
    //    ricevere un errore mentre lo schema sta cambiando, e un errore già ricevuto non deve
    //    permettere a un upgrade tardivo di andare a buon fine:
    //    - `onblocked` o scadenza **prima** dell'avvio → il chiamante riceve l'errore; un
    //      `onupgradeneeded` tardivo **annulla** la transazione e non crea nulla; un
    //      `onsuccess` tardivo **chiude** la connessione;
    //    - scadenza **dopo** l'avvio dell'upgrade → non esiste: il timer viene annullato appena
    //      `onupgradeneeded` parte e si attende l'esito definitivo della transazione.
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
                if (database.objectStoreNames.contains('encryptedOperations') === false) {
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
