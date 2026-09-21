import test from 'node:test';
import assert from 'node:assert/strict';
import {auditEventPath, auditExpiry, auditTimestamp, classifyAuditEvent, planAuditRetention,
    runAuditRetention, DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE, RETENTION_MONTHS} from './audit-retention.mjs';

// M7-R3 — prove sintetiche della retention del registro tecnico `auditEvents`.
// Solo dati fittizi: nessun Firestore reale, nessun job, nessuna cancellazione.
const at = iso => Date.parse(iso);
const event = (id, iso, extra = {}) => ({id, at: new Date(iso), ...extra});
const receiptNames = ['mutationResults', 'operationResults', 'archiveOperations', 'backupRestoreOperations'];

test('accetta solo timestamp databili: istanza, oggetto Firestore e Date', () => {
    assert.equal(auditTimestamp(new Date('2025-01-01T00:00:00Z')), at('2025-01-01T00:00:00Z'));
    assert.equal(auditTimestamp({toDate: () => new Date('2025-01-01T00:00:00Z')}), at('2025-01-01T00:00:00Z'));
    assert.equal(auditTimestamp({seconds: 1735689600, nanoseconds: 0}), 1735689600000);
    assert.equal(auditTimestamp({seconds: 1735689600}), 1735689600000);
});

test('una data non interpretabile è inverificabile, mai una data inventata', () => {
    for (const value of [undefined, null, '2025-01-01', 1735689600000, {}, {seconds: '1'}, {seconds: NaN},
        {seconds: -1}, new Date('invalid'), {toDate: () => 'nope'}, NaN, true]) {
        assert.equal(auditTimestamp(value), null, `atteso null per ${JSON.stringify(value)}`);
    }
});

test('la finestra è di ventiquattro mesi di calendario, con giorno limitato nei mesi corti', () => {
    assert.equal(RETENTION_MONTHS, 24);
    assert.equal(auditExpiry(at('2025-01-15T00:00:00Z')), at('2027-01-15T00:00:00Z'));
    // 29 febbraio di un anno bisestile -> 28 febbraio del secondo anno successivo
    assert.equal(auditExpiry(at('2024-02-29T12:00:00Z')), at('2026-02-28T12:00:00Z'));
    assert.throws(() => auditExpiry(NaN), /AUDIT_RETENTION_TIME_INVALID/);
    assert.throws(() => auditExpiry(0, 0), /AUDIT_RETENTION_MONTHS_INVALID/);
});

test('evento dentro la finestra conservato, al confine e oltre cancellabile', () => {
    const now = at('2026-06-01T00:00:00Z');
    assert.equal(classifyAuditEvent(event('a', '2024-06-01T00:00:01Z'), now), 'retained');
    assert.equal(classifyAuditEvent(event('b', '2024-06-01T00:00:00Z'), now), 'expired');
    assert.equal(classifyAuditEvent(event('c', '2023-01-01T00:00:00Z'), now), 'expired');
    assert.equal(classifyAuditEvent(event('d', '2025-06-01T00:00:00Z'), now), 'retained');
    assert.equal(classifyAuditEvent({id: 'e'}, now), 'unverifiable');
    assert.equal(classifyAuditEvent(event('f', '2025-01-01T00:00:00Z', {at: 'rotto'}), now), 'unverifiable');
    assert.throws(() => classifyAuditEvent(event('g', '2025-01-01T00:00:00Z'), NaN), /AUDIT_RETENTION_CLOCK_INVALID/);
});

test('il piano ordina dal più vecchio, con spareggio sull\'id, e separa i tre esiti', () => {
    const now = at('2026-06-01T00:00:00Z');
    const plan = planAuditRetention({uid: 'owner', now, batchSize: 2, events: [
        event('nuovo', '2026-05-01T00:00:00Z'),
        event('vecchio-b', '2024-02-01T00:00:00Z'),
        event('vecchio-a', '2024-02-01T00:00:00Z'),
        event('senza-data'),
        event('vecchissimo', '2023-01-01T00:00:00Z'),
        event('malformato', '2025-01-01T00:00:00Z', {at: {seconds: 'x'}})
    ]});
    assert.deepEqual(plan.expired, ['vecchissimo', 'vecchio-a', 'vecchio-b']);
    assert.deepEqual(plan.retained, ['nuovo']);
    assert.deepEqual(plan.unverifiable, ['senza-data', 'malformato']);
    assert.deepEqual(plan.batches.map(batch => batch.ids), [['vecchissimo', 'vecchio-a'], ['vecchio-b']]);
    assert.deepEqual(plan.batches.map(batch => batch.paths),
        [[auditEventPath('owner', 'vecchissimo'), auditEventPath('owner', 'vecchio-a')],
         [auditEventPath('owner', 'vecchio-b')]]);
});

test('nessun percorso pianificato esce dal registro di audit né tocca le ricevute', () => {
    const now = at('2026-06-01T00:00:00Z');
    const plan = planAuditRetention({uid: 'owner', now, events: [event('a', '2024-01-01T00:00:00Z')]});
    for (const batch of plan.batches) {
        for (const path of batch.paths) {
            assert.equal(path.startsWith('users/owner/auditEvents/'), true);
            for (const name of receiptNames) assert.equal(path.includes(name), false, `ricevuta coinvolta: ${path}`);
        }
    }
    // un id che tenta di uscire dal registro viene rifiutato, non pianificato
    for (const id of ['mutationResults/owner/operations/op', '../auditEvents/x', 'a/b', '']) {
        assert.throws(() => planAuditRetention({uid: 'owner', now, events: [{id, at: new Date('2024-01-01T00:00:00Z')}]}),
            /AUDIT_RETENTION_ID_INVALID/);
    }
});

test('isolamento fra UID: un evento di un altro proprietario interrompe il piano', () => {
    const now = at('2026-06-01T00:00:00Z');
    assert.throws(() => planAuditRetention({uid: 'owner', now, events: [
        event('a', '2024-01-01T00:00:00Z'), event('b', '2024-01-01T00:00:00Z', {uid: 'other'})]}),
        /AUDIT_RETENTION_UID_MISMATCH/);
    assert.throws(() => auditEventPath('', 'a'), /AUDIT_RETENTION_UID_INVALID/);
});

test('configurazione non valida e input fuori misura sono rifiutati', () => {
    const now = at('2026-06-01T00:00:00Z');
    assert.throws(() => planAuditRetention({uid: 'owner', now, batchSize: 0}), /AUDIT_RETENTION_BATCH_INVALID/);
    assert.throws(() => planAuditRetention({uid: 'owner', now, batchSize: MAX_BATCH_SIZE + 1}), /AUDIT_RETENTION_BATCH_INVALID/);
    assert.throws(() => planAuditRetention({uid: 'owner', now: NaN}), /AUDIT_RETENTION_CLOCK_INVALID/);
    assert.throws(() => planAuditRetention({uid: 'owner', now, events: 'nope'}), /AUDIT_RETENTION_INPUT_INVALID/);
    assert.throws(() => planAuditRetention({uid: 'owner', now, events: Array.from({length: 10001}, (_, i) => event(`e${i}`, '2024-01-01T00:00:00Z'))}),
        /AUDIT_RETENTION_INPUT_INVALID/);
    assert.equal(DEFAULT_BATCH_SIZE <= MAX_BATCH_SIZE, true);
});

test('nessun evento scaduto significa nessun lotto', () => {
    const now = at('2026-06-01T00:00:00Z');
    const plan = planAuditRetention({uid: 'owner', now, events: [event('a', '2026-05-01T00:00:00Z'), event('b')]});
    assert.deepEqual(plan.batches, []);
    assert.deepEqual(plan.expired, []);
    assert.deepEqual(plan.retained, ['a']);
    assert.deepEqual(plan.unverifiable, ['b']);
});

test('l\'esecutore cancella i lotti in ordine e dichiara il completamento', async () => {
    const now = at('2026-06-01T00:00:00Z');
    const plan = planAuditRetention({uid: 'owner', now, batchSize: 2, events: [
        event('c', '2024-03-01T00:00:00Z'), event('a', '2024-01-01T00:00:00Z'),
        event('b', '2024-02-01T00:00:00Z'), event('d', '2024-04-01T00:00:00Z')]});
    const calls = [];
    const report = await runAuditRetention({plan, deleteBatch: async batch => { calls.push(batch.ids); }});
    assert.deepEqual(report, {status: 'completed', completed: 2, total: 2});
    assert.deepEqual(calls, [['a', 'b'], ['c', 'd']]);
});

test('errore parziale: nessun falso completamento e ripresa idempotente', async () => {
    const now = at('2026-06-01T00:00:00Z');
    const events = [event('a', '2024-01-01T00:00:00Z'), event('b', '2024-02-01T00:00:00Z'), event('c', '2024-03-01T00:00:00Z')];
    const plan = planAuditRetention({uid: 'owner', now, batchSize: 1, events});
    const deleted = new Set();
    const flaky = async batch => {
        if (batch.ids.includes('b')) throw Object.assign(new Error('synthetic failure'), {code: 'SYNTHETIC'});
        for (const id of batch.ids) deleted.add(id);
    };
    const first = await runAuditRetention({plan, deleteBatch: flaky});
    assert.equal(first.status, 'partial');
    assert.equal(first.completed, 1);
    assert.equal(first.failedBatch, 1);
    assert.equal(first.code, 'SYNTHETIC');
    assert.deepEqual([...deleted], ['a']);
    // ripresa: il piano si ricalcola dagli eventi ancora presenti
    const remaining = events.filter(item => !deleted.has(item.id));
    const retry = await runAuditRetention({plan: planAuditRetention({uid: 'owner', now, batchSize: 1, events: remaining}),
        deleteBatch: async batch => { for (const id of batch.ids) deleted.add(id); }});
    assert.equal(retry.status, 'completed');
    assert.deepEqual([...deleted].sort(), ['a', 'b', 'c']);
    // a registro vuoto il piano non produce più lotti
    assert.deepEqual(planAuditRetention({uid: 'owner', now, batchSize: 1, events: []}).batches, []);
});

test('interruzione per sessione chiusa e difesa sul percorso dei lotti', async () => {
    const now = at('2026-06-01T00:00:00Z');
    const plan = planAuditRetention({uid: 'owner', now, batchSize: 1, events: [
        event('a', '2024-01-01T00:00:00Z'), event('b', '2024-02-01T00:00:00Z')]});
    let calls = 0;
    const interrupted = await runAuditRetention({plan, isActive: () => calls < 1, deleteBatch: async () => { calls++; }});
    assert.deepEqual(interrupted, {status: 'interrupted', completed: 1, total: 2});
    assert.equal(calls, 1);
    await assert.rejects(runAuditRetention({plan}), /AUDIT_RETENTION_RUN_INVALID/);
    await assert.rejects(runAuditRetention({plan: {uid: 'owner', batches: [{index: 0, ids: ['op'],
        paths: ['mutationResults/owner/operations/op']}]}, deleteBatch: async () => {}}),
        /AUDIT_RETENTION_PATH_FORBIDDEN/);
});
