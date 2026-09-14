import {createFencedQueueClient} from './fenced-queue-client.mjs';
import {createFencedQueueWriter} from './fenced-queue-writer.mjs';
import {encrypt, decrypt} from './crypto-utils.js';
import {readConflictNotes} from './conflict-note-review.mjs';
import {createConflictNoteProposal} from './conflict-note-proposal.mjs';
import {mountOfflineSavePanel} from './offline-save-panel.mjs';
const passed = [], assert = (value, code) => { if (!value) throw new Error(code); };
let db, client;
try {
    const {uid, privateAccounts, email, password} = await (await fetch('/fixture')).json();
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
    let writer = await createFencedQueueWriter({...options, holderId: 'inspector'});
    const pending = async () => (await writer.run(api => api.list())).value;
    const snapshot = async operation => (await post('/snapshot', {operation})).json();
    const operation = {schemaVersion: 1, uid, operationId: 'bridge-first', recordId: 'fixture', deviceId: 'browser-test',
        expectedRevision: 0, encryptedPayload: await encrypt('SYNTHETIC-PAYLOAD', 'SYNTHETIC-VAULT-KEY')};
    if (privateAccounts) {
        operation.record = {nomeAccount: 'Synthetic isolated account', type: 'account', visibility: 'private', _encrypted: true,
            username: '', account: '', url: '', password: operation.encryptedPayload, note: ''};
        delete operation.encryptedPayload;
    }
    await client.enqueue(operation);
    assert((await pending()).length === 1 && !(await snapshot(operation)).record, 'OFFLINE_WRITE');
    const recoveredIdentity = await client.pendingForRecord(operation.recordId);
    assert(recoveredIdentity.acquired && JSON.stringify(recoveredIdentity.value) ===
        JSON.stringify({operationId: operation.operationId, recordId: operation.recordId}) &&
        (await client.pendingForRecord('another-record')).value === null, 'PENDING_SCOPE');
    const duplicatePending = {...operation, operationId: 'duplicate-pending'};
    await writer.run(api => api.enqueue(duplicatePending));
    let ambiguous = false;
    try { await client.pendingForRecord(operation.recordId); } catch (error) { ambiguous = error.message === 'FENCED_CLIENT_PENDING_AMBIGUOUS'; }
    assert(ambiguous && (await pending()).length === 2 && sendCount === 0, 'PENDING_AMBIGUOUS');
    await client.discard(duplicatePending);
    passed.push('pending recovery exposes only record identity and refuses ambiguous commands without sending or deleting');
    const disposableWriter = await createFencedQueueWriter({...options, holderId: 'disposable'});
    let began, resume;
    const started = new Promise(resolve => { began = resolve; });
    const release = new Promise(resolve => { resume = resolve; });
    const writing = disposableWriter.run(async api => { began(); await release; return api.remove(operation); });
    await started; disposableWriter.close(); resume();
    let stopped = false;
    try { await writing; } catch { stopped = true; }
    let denied = false;
    try { await disposableWriter.run(api => api.list()); } catch (error) { denied = error.code === 'FENCED_QUEUE_CLOSED'; }
    assert(stopped && denied && (await pending()).length === 1, 'DISPOSED_WRITER_MUTATED');
    const lifetime = new AbortController();
    const disposableClient = await createFencedQueueClient({...options, holderId: 'disposable-client', signal: lifetime.signal,
        send: () => { throw new Error('DISPOSED_CLIENT_SENT'); }, isOnline: () => true});
    lifetime.abort(); let clientDenied = false;
    try { await disposableClient.flush(); } catch { clientDenied = true; }
    assert(clientDenied && (await pending()).length === 1, 'ABORTED_CLIENT_MUTATED');
    passed.push('closing writer during work and aborting client prevent retained callbacks from changing the encrypted queue');
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
        let page = new AbortController(); online = false;
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
        const input = root.querySelector('textarea'); let buttons = root.querySelectorAll('button');
        input.value = 'SYNTHETIC-NOTE-FROM-UI'; await buttons[0].onclick();
        assert(root.textContent.includes('In attesa di connessione') && input.value === '' && buttons[0].disabled && refreshCount === 0, 'UI_OFFLINE_STATE');
        page.abort(); disposePanel(); client.close(); db.close();
        db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(`codex-offline-queue-${uid}`);
            request.onupgradeneeded = () => { request.transaction.abort(); reject(new Error('RECOVERY_MUST_NOT_UPGRADE')); };
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        options.database = db; writer = await createFencedQueueWriter({...options, holderId: 'reopened-inspector'});
        page = new AbortController(); let resumedSends = 0;
        await mountOfflineSavePanel(root, {signal: page.signal, recoveryRecordId: operation.recordId,
            prepare: () => { throw new Error('RECOVERY_CREATED_SECOND_OPERATION'); },
            createClient: config => createFencedQueueClient({...options, ...config, isOnline: () => online,
                send: async command => {
                    resumedSends++;
                    const response = await post('/mutation', {operation: command}), result = await response.json();
                    if (!response.ok) throw Object.assign(new Error('TRANSPORT_ERROR'), result);
                    return result;
                }}),
            onSaved: async ({isActive}) => {
                const result = await snapshot({...operation, operationId: 'bridge-ui'});
                if (isActive()) { refreshedRecord = result.record; refreshCount++; }
            }});
        buttons = root.querySelectorAll('button');
        assert(buttons[0].disabled && !buttons[1].hidden && root.querySelector('textarea').value === '' &&
            resumedSends === 0 && refreshCount === 0 && (await pending()).length === 1, 'UI_REOPEN_PENDING');
        passed.push('closed encrypted database and editor reopen with the original queued identity and no automatic send');
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
        const localConflictNote = await encrypt('SYNTHETIC-LOCAL-CONFLICT-NOTE', 'SYNTHETIC-VAULT-KEY');
        const conflictedNote = {...operation, operationId: 'bridge-ui-conflict', expectedRevision: 2,
            record: {...operation.record, note: localConflictNote}};
        const proposalContext = {user: {uid}, signal: conflictPage.signal, unlocked: true,
            read: ({ciphertext}) => decrypt(ciphertext, 'SYNTHETIC-VAULT-KEY'),
            encrypt: value => encrypt(value, 'SYNTHETIC-VAULT-KEY')};
        const readLatest = async command => ({source: {...(await snapshot(command)).record, id: command.recordId, ownerId: uid}, hasProfileLink: false});
        await mountOfflineSavePanel(root, {signal: conflictPage.signal,
            readConflict: command => readConflictNotes({operation: command,
                context: {user: {uid}, signal: conflictPage.signal, unlocked: true,
                    read: ({ciphertext}) => decrypt(ciphertext, 'SYNTHETIC-VAULT-KEY')},
                readLatest: async () => ({...(await snapshot(command)).record, id: command.recordId, ownerId: uid})}),
            createConflictProposal: command => createConflictNoteProposal({context: proposalContext, operation: command,
                readLatest: () => readLatest(command), noteOnly: true, deviceId: 'browser-test', newOperationId: () => 'bridge-ui-reproposal'}),
            createClient: config => createFencedQueueClient({...options, ...config, isOnline: () => true,
                send: async command => {
                    const response = await post('/mutation', {operation: command}), result = await response.json();
                    if (!response.ok) throw Object.assign(new Error('TRANSPORT_ERROR'), result);
                    return result;
                }}), prepare: async () => conflictedNote, onDiscarded: () => { discardedRefresh++; }});
        const conflictButtons = root.querySelectorAll('button');
        await conflictButtons[0].onclick();
        assert(!conflictButtons[2].hidden && (await pending()).length === 1, 'UI_CONFLICT_MISSING');
        await conflictButtons[5].onclick();
        const compared = root.querySelectorAll('pre');
        assert(compared.length === 2 && compared[0].textContent === 'SYNTHETIC-LOCAL-CONFLICT-NOTE' && compared[1].textContent === 'SYNTHETIC-NOTE-FROM-UI' &&
            (await pending()).length === 1, 'UI_COMPARISON_CHANGED_QUEUE');
        await conflictButtons[6].onclick(); conflictButtons[8].onclick();
        assert((await pending()).length === 1, 'UI_REPROPOSAL_CANCEL_CHANGED_QUEUE');
        conflictButtons[6].onclick(); await conflictButtons[7].onclick();
        const reproposed = await snapshot({...conflictedNote, operationId: 'bridge-ui-reproposal'});
        assert(!(await pending()).length && reproposed.record.revision === 4 && reproposed.record.note !== localConflictNote &&
            (await decrypt(reproposed.record.note, 'SYNTHETIC-VAULT-KEY')) === 'SYNTHETIC-LOCAL-CONFLICT-NOTE', 'UI_REPROPOSAL_NOT_APPLIED');
        conflictPage.abort(); assert([...compared].every(node => node.textContent === ''), 'UI_COMPARISON_RETAINED');
        passed.push('confirmed note reproposal atomically replaces the conflicted command and applies through the private emulator backend');
        const discardPage = new AbortController();
        await mountOfflineSavePanel(root, {signal: discardPage.signal,
            createClient: config => createFencedQueueClient({...options, ...config, isOnline: () => true,
                send: async command => { const response = await post('/mutation', {operation: command}); return response.json(); }}),
            prepare: async () => ({...conflictedNote, operationId: 'bridge-ui-discard', expectedRevision: 3})});
        const discardButtons = root.querySelectorAll('button'); await discardButtons[0].onclick();
        const beforeDiscard = await snapshot(conflictedNote);
        discardButtons[2].onclick(); await discardButtons[3].onclick();
        const afterDiscard = await snapshot(conflictedNote);
        assert(!(await pending()).length && beforeDiscard.updateTime === afterDiscard.updateTime &&
            JSON.stringify(beforeDiscard.record) === JSON.stringify(afterDiscard.record), 'UI_DISCARD_CHANGED_SERVER');
        discardPage.abort(); root.remove();
    }
    const sdk = await import('/firebase-queue.mjs');
    const app = sdk.initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key', appId: 'synthetic-offline-browser'});
    const auth = sdk.initializeAuth(app, {persistence: sdk.inMemoryPersistence});
    sdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
    sdk.initializeAppCheck(app, {provider: new sdk.CustomProvider({getToken: async () => ({token: 'synthetic-app-check', expireTimeMillis: Date.now() + 3600000})}), isTokenAutoRefreshEnabled: false});
    const functions = sdk.getFunctions(app, 'europe-west1'); sdk.connectFunctionsEmulator(functions, '127.0.0.1', Number(location.port));
    let sdkClient, queueSession, queueContext;
    try {
        await sdk.signInWithEmailAndPassword(auth, email, password);
        queueSession = sdk.createProtectedSession({getUser: () => auth.currentUser,
            subscribeUser: fn => sdk.onAuthStateChanged(auth, fn), routes: {queue: context => { queueContext = context; }},
            createVault: callbacks => sdk.createMemoryVault({...callbacks, unlockKey: async () => 'SYNTHETIC-QUEUE-KEY',
                openQueueWithKey: (vaultKeyMaterial, scope) => sdk.createFirebaseFencedQueueClient({...options, ...scope, vaultKeyMaterial,
                    database: db, holderId: 'shell-firebase-sdk', auth, functions, isOnline: () => true})})});
        await queueSession.unlock(); await queueSession.navigate('queue');
        assert(queueContext.openMutationQueue === undefined && queueContext.key === undefined, 'QUEUE_EXPOSED_TO_ROUTE');
        const before = await snapshot(operation);
        const command = {...operation, operationId: 'bridge-sdk', expectedRevision: before.record.revision};
        const missing = await fetch(`/demo-vault-shell/europe-west1/${privateAccounts ? 'applyPrivateAccountMutation' : 'applyOfflineMutation'}`, {
            method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}`}, body: JSON.stringify({data: command})});
        assert(missing.status === 401 && (await snapshot(command)).updateTime === before.updateTime, 'SDK_MISSING_ATTESTATION_ACCEPTED');
        sdkClient = await queueSession.openMutationQueue({domain: privateAccounts ? 'private-account' : 'offline-sync', signal: queueContext.signal});
        await sdkClient.enqueue(command);
        const after = await snapshot(command);
        assert(after.record.revision === before.record.revision + 1 && after.receipt?.bindingVersion === 1 && !(await pending()).length, 'SDK_QUEUE_NOT_COMMITTED');
        const late = {...command, operationId: 'bridge-sdk-late', expectedRevision: after.record.revision};
        const sending = sdkClient.enqueue(late).catch(() => null);
        let committed;
        for (let attempt = 0; attempt < 100; attempt++) {
            committed = await snapshot(late);
            if (committed.receipt) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert(committed.receipt && committed.record.revision === after.record.revision + 1, 'SDK_DELAYED_NOT_COMMITTED');
        queueSession.lock(); await post('/release-sdk', {operation: late}); await sending;
        assert((await pending()).length === 1, 'SDK_LATE_ACK_REMOVED_QUEUE');
        await queueSession.unlock(); await queueSession.navigate('queue');
        sdkClient = await queueSession.openMutationQueue({domain: privateAccounts ? 'private-account' : 'offline-sync', signal: queueContext.signal});
        await sdkClient.flush();
        const resumed = await snapshot(late);
        assert(!(await pending()).length && resumed.updateTime === committed.updateTime, 'SDK_RESUME_REWROTE_RECORD');
        passed.push('shell-owned Vault lock after server commit retains the queue; unlock opens a new scoped SDK client and retries without rewriting');
        await sdk.signOut(auth);
        let denied = false; try { await sdkClient.enqueue({...command, operationId: 'bridge-sdk-signed-out'}); } catch { denied = true; }
        assert(denied && (await snapshot(command)).updateTime === resumed.updateTime && !(await pending()).length, 'SDK_LOGOUT_WRITE');
        passed.push('Firebase callable SDK sends Auth emulator identity and synthetic App Check header; receipt clears queue and logout prevents reuse');
    } finally { sdkClient?.close(); queueSession?.dispose(); await sdk.deleteApp(app); }
    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: true, domain: privateAccounts ? 'private-account' : 'offline-generic', passed, browser: navigator.userAgent})});
} catch (error) {
    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: false, passed, code: error.code || error.message})});
} finally { client?.close(); db?.close(); }
