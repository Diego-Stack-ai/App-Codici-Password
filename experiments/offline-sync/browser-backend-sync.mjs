import {createFencedQueueClient} from './fenced-queue-client.mjs';
import {createFencedQueueWriter} from './fenced-queue-writer.mjs';
import {encrypt} from './crypto-utils.js';
import {mountOfflineSavePanel} from './offline-save-panel.mjs';
const passed = [], assert = (value, code) => { if (!value) throw new Error(code); };
let db, client;
try {
    const {uid, privateAccounts} = await (await fetch('/fixture')).json();
    db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(`codex-offline-queue-${uid}`, 2);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('queueLeases', {keyPath: 'id'});
            request.result.createObjectStore('encryptedOperations', {keyPath: 'id'});
        };
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const options = {database: db, uid, holderId: 'browser', vaultKeyMaterial: 'SYNTHETIC-QUEUE-KEY', ttlMs: 30000};
    let online = false, loseReply = false, replies = [], states = [], sendCount = 0;
    const post = (url, body) => fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    client = await createFencedQueueClient({...options, isOnline: () => online, onState: state => states.push(state.state),
        send: async operation => {
            sendCount++;
            const response = await post('/mutation', {operation, dropResponse: loseReply}); loseReply = false;
            const result = await response.json();
            if (!response.ok) throw Object.assign(new Error('TRANSPORT_ERROR'), result);
            replies.push(result); return result;
        }});
    const writer = await createFencedQueueWriter({...options, holderId: 'inspector'});
    const pending = async () => (await writer.run(api => api.list())).value;
    const snapshot = async operation => (await post('/snapshot', {operation})).json();
    const operation = {schemaVersion: 1, uid, operationId: 'bridge-first', recordId: 'fixture', deviceId: 'browser-test',
        expectedRevision: 0, encryptedPayload: await encrypt('SYNTHETIC-PAYLOAD', 'SYNTHETIC-VAULT-KEY')};
    if (privateAccounts) {
        operation.record = {nomeAccount: 'Synthetic isolated account', type: 'account', visibility: 'private', _encrypted: true,
            username: '', account: '', password: operation.encryptedPayload, note: ''};
        delete operation.encryptedPayload;
    }
    await client.enqueue(operation);
    assert((await pending()).length === 1 && !(await snapshot(operation)).record, 'OFFLINE_WRITE');
    online = true; await client.flush();
    const saved = await snapshot(operation);
    assert(saved.record?.revision === 1 && (privateAccounts ? saved.record.password === operation.record.password : saved.record.encryptedPayload === operation.encryptedPayload) &&
        saved.receipt?.bindingVersion === 1 && (await pending()).length === 0, 'APPLY_RECEIPT');
    passed.push('browser encrypted queue applies through original handler and emulator transaction with bound receipt');
    const retry = {...operation, operationId: 'bridge-retry', expectedRevision: 1}; loseReply = true;
    await client.enqueue(retry);
    const beforeRetry = await snapshot(retry);
    assert(beforeRetry.record.revision === 2 && (await pending()).length === 1, 'LOST_REPLY_QUEUE');
    await client.flush(); const afterRetry = await snapshot(retry);
    assert(replies.at(-1).duplicate === true && afterRetry.updateTime === beforeRetry.updateTime &&
        JSON.stringify(afterRetry.record) === JSON.stringify(beforeRetry.record) && !(await pending()).length, 'RETRY_REWRITE');
    passed.push('lost reply preserves local operation; actual server receipt prevents a second write on retry');
    const stale = {...operation, operationId: 'bridge-stale'};
    await client.enqueue(stale);
    const conflict = await snapshot(stale);
    assert(states.at(-1) === 'conflict' && (await pending()).length === 1 && conflict.record.revision === 2 &&
        conflict.updateTime === afterRetry.updateTime && conflict.receipt?.status !== 'applied', 'STALE_REVISION');
    await client.discard(stale);
    passed.push('stale revision retains queued command without modifying server record');
    const differentCiphertext = await encrypt('SYNTHETIC-DIFFERENT-PAYLOAD', 'SYNTHETIC-VAULT-KEY');
    const reused = privateAccounts ? {...retry, record: {...retry.record, password: differentCiphertext}} : {...retry, encryptedPayload: differentCiphertext};
    await client.enqueue(reused);
    assert(states.at(-1) === 'recoverable-error' && (await pending()).length === 1 &&
        (await snapshot(retry)).updateTime === afterRetry.updateTime, 'REUSED_ID');
    await client.discard(reused);
    passed.push('changed payload cannot reuse a committed operation ID or falsely clear the queue');
    const wrong = {...operation, uid: 'another-owner', operationId: 'bridge-owner', expectedRevision: 2};
    const rejected = await post('/mutation', {operation: wrong});
    assert(!rejected.ok && (await snapshot(wrong)).updateTime === afterRetry.updateTime && !(await snapshot(wrong)).receipt, 'OWNER_MISMATCH');
    passed.push('original handler rejects mismatched command owner without record or receipt changes');
    if (privateAccounts) {
        for (const scope of ['profile', 'company']) {
            await post('/scope', {operation, scope});
            const linked = {...operation, operationId: `bridge-linked-${scope}`, expectedRevision: 2};
            await client.enqueue(linked);
            const blocked = await snapshot(linked), held = await pending();
            assert(states.at(-1) === 'reconciliation-required' && held.length === 1 &&
                held[0]._reviewReason === 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED' && blocked.updateTime === afterRetry.updateTime && !blocked.receipt, 'LINKED_ACCOUNT_WRITTEN');
            const sent = sendCount;
            await client.flush(); assert(sendCount === sent && states.at(-1) === 'reconciliation-required', 'LINKED_AUTO_RETRY');
            await client.discard(held[0]);
            passed.push(`${scope} inverse link rejects reduced private write and persists encrypted reconciliation marker`);
        }
        await client.enqueue(retry);
        assert(replies.at(-1).duplicate === true && !(await pending()).length &&
            (await snapshot(retry)).updateTime === afterRetry.updateTime, 'TRUSTED_RETRY_AFTER_LINK');
        passed.push('trusted private retry remains authoritative after a new profile link without rewriting record');
        await post('/scope', {operation, scope: 'none'});
        const root = document.createElement('div'); document.body.append(root);
        const page = new AbortController(); online = false;
        let preparedNote, refreshedRecord, refreshCount = 0;
        const disposePanel = await mountOfflineSavePanel(root, {signal: page.signal,
            onSaved: async ({isActive}) => {
                const result = await snapshot({...operation, operationId: 'bridge-ui'});
                if (isActive()) { refreshedRecord = result.record; refreshCount++; }
            },
            createClient: config => createFencedQueueClient({...options, ...config, isOnline: () => online,
                send: async command => {
                    const response = await post('/mutation', {operation: command}), result = await response.json();
                    if (!response.ok) throw Object.assign(new Error('TRANSPORT_ERROR'), result);
                    return result;
                }}),
            prepare: async value => {
                preparedNote = await encrypt(value, 'SYNTHETIC-VAULT-KEY');
                return {...operation, operationId: 'bridge-ui', expectedRevision: 2, record: {...operation.record, note: preparedNote}};
            }});
        const input = root.querySelector('textarea'), buttons = root.querySelectorAll('button');
        input.value = 'SYNTHETIC-NOTE-FROM-UI'; await buttons[0].onclick();
        assert(root.textContent.includes('In attesa di connessione') && input.value === '' && buttons[0].disabled && refreshCount === 0, 'UI_OFFLINE_STATE');
        online = true; await buttons[1].onclick();
        const uiSaved = await snapshot({...operation, operationId: 'bridge-ui'});
        assert(root.textContent.includes('Nota salvata') && uiSaved.record.note === preparedNote && uiSaved.record.revision === 3 &&
            refreshCount === 1 && refreshedRecord.note === preparedNote, 'UI_SAVE_STATE');
        page.abort(); assert(root.children.length === 0 && buttons[0].onclick === null, 'UI_ABORT_CLEANUP');
        disposePanel();
        passed.push('note panel queues offline and retries online against private backend, then detaches on page abort');
        const openingPage = new AbortController(); let resolveOpening, lateClosed = false;
        const opening = mountOfflineSavePanel(root, {signal: openingPage.signal, initialNote: 'SYNTHETIC-DRAFT',
            createClient: () => new Promise(resolve => { resolveOpening = resolve; }), prepare: async () => operation});
        const openingInput = root.querySelector('textarea');
        openingPage.abort(); resolveOpening({close() { lateClosed = true; }}); await opening;
        assert(lateClosed && root.children.length === 0 && openingInput.value === '', 'LATE_CLIENT_RETAINED');
        passed.push('page closed during client initialization clears draft and closes late client');
        const preparingPage = new AbortController(); let resolvePrepare, enqueued = 0;
        await mountOfflineSavePanel(root, {signal: preparingPage.signal,
            createClient: async () => ({close() {}, enqueue: async () => { enqueued++; }}),
            prepare: () => new Promise(resolve => { resolvePrepare = resolve; })});
        const retainedInput = root.querySelector('textarea'); retainedInput.value = 'SYNTHETIC-DRAFT';
        const preparation = root.querySelector('button').onclick(); preparingPage.abort(); resolvePrepare(operation); await preparation;
        assert(enqueued === 0 && retainedInput.value === '' && !root.children.length, 'LATE_PREPARE_ENQUEUED');
        passed.push('page abort during encryption preparation prevents enqueue and clears visible draft');
        const conflictPage = new AbortController(); let discardedRefresh = 0;
        const conflictedNote = {...operation, operationId: 'bridge-ui-conflict', expectedRevision: 2};
        await mountOfflineSavePanel(root, {signal: conflictPage.signal,
            createClient: config => createFencedQueueClient({...options, ...config, isOnline: () => true,
                send: async command => {
                    const response = await post('/mutation', {operation: command}), result = await response.json();
                    if (!response.ok) throw Object.assign(new Error('TRANSPORT_ERROR'), result);
                    return result;
                }}), prepare: async () => conflictedNote, onDiscarded: () => { discardedRefresh++; }});
        const conflictButtons = root.querySelectorAll('button');
        await conflictButtons[0].onclick();
        assert(!conflictButtons[2].hidden && (await pending()).length === 1, 'UI_CONFLICT_MISSING');
        conflictButtons[2].onclick(); conflictButtons[4].onclick();
        assert((await pending()).length === 1 && discardedRefresh === 0, 'UI_CANCEL_DISCARDED');
        const beforeDiscard = await snapshot(conflictedNote);
        conflictButtons[2].onclick(); await conflictButtons[3].onclick();
        const afterDiscard = await snapshot(conflictedNote);
        assert(!(await pending()).length && discardedRefresh === 1 && beforeDiscard.updateTime === afterDiscard.updateTime &&
            JSON.stringify(beforeDiscard.record) === JSON.stringify(afterDiscard.record) &&
            root.textContent.includes('dati online sono invariati'), 'UI_DISCARD_CHANGED_SERVER');
        conflictPage.abort(); root.remove();
        passed.push('explicit conflict discard removes only queued command; cancellation and online record remain unchanged');
    }
    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: true, domain: privateAccounts ? 'private-account' : 'offline-generic', passed, browser: navigator.userAgent})});
} catch (error) {
    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: false, passed, code: error.code || error.message})});
} finally { client?.close(); db?.close(); }
