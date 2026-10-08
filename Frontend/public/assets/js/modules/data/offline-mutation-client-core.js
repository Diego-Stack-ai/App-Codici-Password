export const OFFLINE_MUTATION_WRITES_ENABLED = false;

// [M6-A-8c R1] Rifiuti del confine che significano «un token preso è stato perso» oppure «la
// sessione è cambiata»: in questi casi la coda **non** va scritta. Ogni altro rifiuto del confine
// (occupato, API di piattaforma assente, lease indisponibile, acquisizione scaduta) lascia
// l'accodamento possibile **senza** token, come nel comportamento precedente: la modifica
// dell'utente va conservata e l'indisponibilità viene riferita.
const FENCED_WRITE_REFUSALS = new Set(['LEASE_LOST', 'LEASE_CONTEXT_CLOSED', 'LEASE_SESSION_INACTIVE',
    'OFFLINE_SESSION_CHANGED', 'LEASE_ASYNC_MUTATION_FORBIDDEN', 'LEASE_GUARD_INVALID']);

export async function createOfflineMutationClientCore({
    uid,
    vaultKeyMaterial,
    enabled = OFFLINE_MUTATION_WRITES_ENABLED,
    createQueue,
    createQueueReader,
    createSynchronizer,
    withLease,
    createChannel,
    send,
    onState = () => {},
    isOnline,
    isActive = () => true
}) {
    if (!enabled) throw new Error('OFFLINE_MUTATION_WRITES_DISABLED');
    if (!uid || !vaultKeyMaterial || !createQueue || !createSynchronizer || !withLease || !send) {
        throw new Error('OFFLINE_MUTATION_CLIENT_CONFIG_INVALID');
    }
    let closed = false;
    const active = () => !closed && isActive();
    const assertActive = () => { if (!active()) throw new Error('OFFLINE_SESSION_CHANGED'); };
    assertActive();
    // [M6-A-6] La **lettura** passa dal lettore compatibile v1/v2; lo **scrittore** resta quello di
    // prima e non viene toccato. Se la coda non è operabile — per esempio una copia non compatibile
    // con lo schema presente — il client resta vivo e riferisce l'indisponibilità tramite il
    // sincronizzatore, invece di morire o di far credere che la coda sia vuota.
    // [M6-A-6 R2] La factory del lettore è **asincrona** (deriva la chiave): va attesa, e se la
    // sessione cambia nel frattempo non si lascia aperto nulla. Se la creazione fallisce il
    // percorso di lettura resta dichiaratamente indisponibile, senza far morire il client.
    let reader = null, readerUnavailable = null;
    if (createQueueReader) {
        try {
            reader = await createQueueReader({uid, vaultKeyMaterial, isActive: active});
        } catch (error) {
            if (error?.message === 'OFFLINE_SESSION_CHANGED') throw error;
            readerUnavailable = error?.code || error?.message || 'QUEUE_READER_UNAVAILABLE';
        }
        if (reader && !active()) { reader.close?.(); reader = null; throw new Error('OFFLINE_SESSION_CHANGED'); }
    }
    let queue = null, writeUnavailable = null;
    try {
        queue = await createQueue({uid, vaultKeyMaterial, isActive: active});
    } catch (error) {
        if (!reader && !readerUnavailable) throw error;
        writeUnavailable = error?.name || error?.code || error?.message;
    }
    if (queue && !active()) { queue.close?.(); throw new Error('OFFLINE_SESSION_CHANGED'); }
    const readQueue = createQueueReader
        ? (reader ? () => reader.read() : () => ({available: false, version: null, operations: null, reason: readerUnavailable}))
        : undefined;
    const synchronizer = createSynchronizer({uid, queue, readQueue, send, withLease, onState, isOnline, isActive: active});
    const channel = createChannel?.(uid, () => synchronizer.flush()) ?? {notify() {}, close() {}};
    // Gli ingressi di **scrittura** richiedono la coda operabile: senza di essa — perché non è mai
    // stata aperta o perché un upgrade concorrente ne ha chiuso la connessione **dopo** l'apertura
    // — rifiutano in modo dichiarato e non accodano nulla.
    const assertWritable = () => {
        assertActive();
        const closedAfterOpen = !!queue && typeof queue.isOperable === 'function' && queue.isOperable() === false;
        if (!queue || closedAfterOpen) {
            throw Object.assign(new Error('OFFLINE_QUEUE_WRITE_UNAVAILABLE'), {
                code: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE',
                reason: writeUnavailable || 'QUEUE_CLOSED_BY_VERSION_CHANGE'
            });
        }
    };
    return {
        async enqueue(operation) {
            assertWritable();
            if (operation?.uid !== uid) throw new Error('OFFLINE_OPERATION_SCOPE_INVALID');
            // [M6-A-8c R1] L'accodamento passa dal confine **con il token** quando il confine può
            // essere acquisito: la verifica del lease e l'inserimento stanno nella stessa
            // transazione, quindi un titolare scaduto o subentrato non accoda nulla. La
            // conservazione della modifica non deve però dipendere da un lock: se nessun token è mai
            // stato preso (confine occupato, API di piattaforma assente, lease indisponibile,
            // acquisizione scaduta) si accoda **senza** token come prima; se invece un token preso
            // viene perso o la sessione cambia, l'esito è un rifiuto e **non** si scrive.
            let queued = false, taskStarted = false, boundaryError = null;
            try {
                const result = await withLease(uid, async lease => {
                    taskStarted = true;
                    assertActive();
                    await queue.enqueue(operation, {isActive: active, lease: lease ?? null});
                    queued = true;
                    return {queued: true};
                });
                if (result?.acquired === false) queued = false;
            } catch (error) { boundaryError = error; }
            if (!queued) {
                if (taskStarted || (boundaryError && FENCED_WRITE_REFUSALS.has(boundaryError.code || boundaryError.message))) {
                    throw boundaryError;
                }
                assertActive();
                await queue.enqueue(operation, {isActive: active});
            }
            channel.notify();
            return synchronizer.flush();
        },
        async replace(expectedOperation, replacement) {
            assertWritable();
            if (expectedOperation?.uid !== uid || replacement?.uid !== uid) throw new Error('OFFLINE_OPERATION_SCOPE_INVALID');
            const result = await withLease(uid, async lease => {
                assertActive();
                await queue.replace(expectedOperation, replacement, {isActive: active, lease: lease ?? null});
                return {status: 'replaced'};
            });
            if (result?.acquired === false) return {status: 'recoverable-error'};
            assertActive();
            channel.notify();
            return synchronizer.flush();
        },
        flush: () => synchronizer.flush(),
        async discard(operationId) {
            assertWritable();
            if (!operationId) throw new Error('OFFLINE_OPERATION_ID_REQUIRED');
            const result = await withLease(uid, async lease => {
                assertActive();
                const expected = (await queue.list()).find(operation => operation.operationId === operationId);
                assertActive();
                if (!expected) throw new Error('OFFLINE_ACK_MISSING');
                await queue.remove(expected, {isActive: active, lease: lease ?? null});
            });
            if (result?.acquired === false) throw new Error('OFFLINE_QUEUE_BUSY');
            assertActive();
            channel.notify();
        },
        async discardRecord(recordId) {
            assertWritable();
            if (!recordId) throw new Error('OFFLINE_RECORD_ID_REQUIRED');
            let discarded = 0, remaining = 0;
            const result = await withLease(uid, async lease => {
                assertActive();
                const matches = (await queue.list()).filter(operation => operation.recordId === recordId);
                for (const operation of matches) {
                    assertActive();
                    await queue.remove(operation, {isActive: active, lease: lease ?? null});
                    discarded += 1;
                }
                assertActive();
                remaining = (await queue.list()).filter(operation => operation.recordId === recordId).length;
            });
            if (result?.acquired === false) throw new Error('OFFLINE_QUEUE_BUSY');
            assertActive();
            channel.notify();
            return {discarded, remaining};
        },
        close() { closed = true; channel.close(); queue?.close?.(); withLease?.close?.(); }
    };
}
