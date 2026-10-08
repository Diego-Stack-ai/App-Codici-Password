"use strict";

// M7-AUDIT-6 — Retention del registro tecnico `users/{uid}/auditEvents`.
//
// Monta in Functions il candidato di laboratorio
// `experiments/history-recovery/audit-retention.mjs` con la politica approvata
// in M7-AUDIT-6P-R1 e nella rettifica del 21/09/2026:
//
// - finestra di **24 mesi di calendario** (giorno limitato nei mesi corti) dal
//   timestamp **efficace** dell'evento;
// - data efficace: `at` se contiene un Timestamp valido; **altrimenti**
//   `createdAt` se contiene un Timestamp valido **e** l'azione appartiene alle
//   due famiglie che scrivono solo `createdAt` (`shared-vault-*`,
//   `account-widget-*` — `functions/index.js:253`/`:313-320` e `:376`/`:391-398`);
// - **vincolo di revisione di Codex**: un `at` presente ma malformato o
//   incongruente **non** viene aggirato da un ripiego implicito: l'evento è
//   `unverifiable`, e un evento non databile **non entra in alcun lotto**;
// - nessun percorso pianificato può uscire da `users/{uid}/auditEvents/`.
//
// Il modulo è **puro**: non importa Firebase, non legge e non scrive. L'I/O vive
// nel job pianificato di `functions/index.js`.

const RETENTION_MONTHS = 24;
const DEFAULT_BATCH_SIZE = 200;
const MAX_BATCH_SIZE = 500; // limite di operazioni per batch Firestore
const MAX_EVENTS_PER_RUN = 10_000;

// Azioni che scrivono `createdAt` (Timestamp del server) e **non** `at`.
// Verificato nella storia del repository: introdotte con `1812b5b9`
// (account-widget) e `adcc5a52` (shared-vault) e mai modificate.
const CREATED_AT_ONLY_ACTIONS = Object.freeze(["shared-vault-", "account-widget-"]);

const IDENTIFIER = /^[A-Za-z0-9._:-]{1,200}$/;
const fail = code => Object.assign(new Error(code), {code});

function auditEventPath(uid, id) {
    if (typeof uid !== "string" || !IDENTIFIER.test(uid)) throw fail("AUDIT_RETENTION_UID_INVALID");
    if (typeof id !== "string" || !IDENTIFIER.test(id)) throw fail("AUDIT_RETENTION_ID_INVALID");
    const path = `users/${uid}/auditEvents/${id}`;
    if (!path.startsWith(`users/${uid}/auditEvents/`)) throw fail("AUDIT_RETENTION_PATH_FORBIDDEN");
    return path;
}

// Accetta le forme con cui Firestore restituisce un Timestamp (istanza SDK,
// oggetto {seconds,nanoseconds}, Date lato test) e nient'altro: stringhe, numeri,
// null, oggetti vuoti e NaN sono **non databili**. Nanosecondi e secondi fuori
// intervallo sono malformati, non date stimate.
const MAX_NANOSECONDS = 999_999_999;
const MAX_DATE_MS = 8.64e15;

function safeInstant(ms) {
    return Number.isSafeInteger(ms) && Number.isFinite(ms) && Math.abs(ms) <= MAX_DATE_MS &&
        Number.isFinite(new Date(ms).getTime()) ? ms : null;
}

function auditTimestamp(value) {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? safeInstant(value.getTime()) : null;
    if (typeof value?.toDate === "function") {
        const date = value.toDate();
        return date instanceof Date && Number.isFinite(date.getTime()) ? safeInstant(date.getTime()) : null;
    }
    const seconds = value?.seconds, rawNanoseconds = value?.nanoseconds;
    if (rawNanoseconds !== undefined && !Number.isInteger(rawNanoseconds)) return null;
    const nanoseconds = rawNanoseconds === undefined ? 0 : rawNanoseconds;
    if (!Number.isSafeInteger(seconds) || seconds < 0) return null;
    if (nanoseconds < 0 || nanoseconds > MAX_NANOSECONDS) return null;
    return safeInstant(seconds * 1000 + Math.floor(nanoseconds / 1e6));
}

function isCreatedAtOnlyAction(action) {
    return typeof action === "string" && CREATED_AT_ONLY_ACTIONS.some(prefix => action.startsWith(prefix));
}

// Data efficace dell'evento, o `null` se l'evento non è databile.
// `field` dice da dove viene la data, per i log e per le prove.
function effectiveAuditDate(event) {
    if (!event || typeof event !== "object") return null;
    if (Object.prototype.hasOwnProperty.call(event, "at")) {
        // Presente: se non è databile l'evento resta inverificabile. Nessun
        // ripiego implicito, come richiesto dalla revisione.
        const at = auditTimestamp(event.at);
        return at === null ? null : {at, field: "at"};
    }
    if (!isCreatedAtOnlyAction(event.action)) return null;
    if (!Object.prototype.hasOwnProperty.call(event, "createdAt")) return null;
    const createdAt = auditTimestamp(event.createdAt);
    return createdAt === null ? null : {at: createdAt, field: "createdAt"};
}

// Scadenza con mesi di calendario: il giorno viene limitato se il mese di
// destinazione è più corto (29/02 -> 28/02 negli anni non bisestili).
function auditExpiry(at, months = RETENTION_MONTHS) {
    if (!Number.isFinite(at)) throw fail("AUDIT_RETENTION_TIME_INVALID");
    if (!Number.isSafeInteger(months) || months <= 0) throw fail("AUDIT_RETENTION_MONTHS_INVALID");
    const from = new Date(at), day = from.getUTCDate();
    const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1,
        from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.getTime();
}

function classifyAuditEvent(event, now, {months = RETENTION_MONTHS} = {}) {
    if (!Number.isFinite(now)) throw fail("AUDIT_RETENTION_CLOCK_INVALID");
    const effective = effectiveAuditDate(event);
    if (effective === null) return "unverifiable";
    const expiry = auditExpiry(effective.at, months);
    if (!Number.isFinite(expiry)) return "unverifiable";
    return expiry <= now ? "expired" : "retained";
}

// Piano deterministico: solo gli eventi scaduti e databili, dal più vecchio, con
// spareggio sull'id, divisi in lotti entro il limite Firestore.
function planAuditRetention({uid, events = [], now, batchSize = DEFAULT_BATCH_SIZE, months = RETENTION_MONTHS} = {}) {
    if (!Number.isFinite(now)) throw fail("AUDIT_RETENTION_CLOCK_INVALID");
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
        throw fail("AUDIT_RETENTION_BATCH_INVALID");
    }
    if (!Array.isArray(events) || events.length > MAX_EVENTS_PER_RUN) throw fail("AUDIT_RETENTION_INPUT_INVALID");
    const expired = [], retained = [], unverifiable = [];
    for (const event of events) {
        if (event?.uid !== undefined && event.uid !== uid) throw fail("AUDIT_RETENTION_UID_MISMATCH");
        const id = event?.id;
        const path = auditEventPath(uid, id);
        const effective = effectiveAuditDate(event);
        const state = classifyAuditEvent(event, now, {months});
        if (state === "expired") {
            expired.push({id, path, at: effective.at, field: effective.field});
        } else if (state === "retained") {
            retained.push(id);
        } else {
            unverifiable.push(id);
        }
    }
    expired.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    const batches = [];
    for (let index = 0; index < expired.length; index += batchSize) {
        const slice = expired.slice(index, index + batchSize);
        batches.push(Object.freeze({
            index: batches.length,
            ids: Object.freeze(slice.map(item => item.id)),
            paths: Object.freeze(slice.map(item => item.path))
        }));
    }
    return Object.freeze({
        uid, now, months, batchSize,
        batches: Object.freeze(batches),
        expired: Object.freeze(expired.map(item => item.id)),
        retained: Object.freeze(retained),
        unverifiable: Object.freeze(unverifiable)
    });
}

// Esecutore: cancella i lotti nell'ordine del piano, si ferma al primo errore e
// non dichiara mai completato ciò che non lo è. La ripetizione è idempotente
// perché il piano si ricalcola dagli eventi ancora presenti.
//
// Ogni lotto viene ri-derivato da UID e id prima di qualunque chiamata: un piano
// arbitrario con UID non valido o percorso non coerente viene rifiutato senza
// invocare `deleteBatch`.
async function runAuditRetention({plan, deleteBatch, isActive = () => true} = {}) {
    if (!plan?.batches || typeof deleteBatch !== "function" || typeof isActive !== "function") {
        throw fail("AUDIT_RETENTION_RUN_INVALID");
    }
    if (typeof plan.uid !== "string" || !IDENTIFIER.test(plan.uid)) throw fail("AUDIT_RETENTION_UID_INVALID");
    let completed = 0;
    for (const batch of plan.batches) {
        if (!Array.isArray(batch.ids) || !Array.isArray(batch.paths) || batch.ids.length !== batch.paths.length) {
            throw fail("AUDIT_RETENTION_PATH_FORBIDDEN");
        }
        for (let index = 0; index < batch.ids.length; index++) {
            if (auditEventPath(plan.uid, batch.ids[index]) !== batch.paths[index]) {
                throw fail("AUDIT_RETENTION_PATH_FORBIDDEN");
            }
        }
        if (!isActive()) return Object.freeze({status: "interrupted", completed, total: plan.batches.length});
        try {
            await deleteBatch({index: batch.index, ids: batch.ids, paths: batch.paths});
        } catch (error) {
            return Object.freeze({
                status: "partial", completed, total: plan.batches.length,
                failedBatch: batch.index, code: error?.code ?? null, message: String(error?.message ?? error)
            });
        }
        completed++;
    }
    return Object.freeze({status: "completed", completed, total: plan.batches.length});
}

module.exports = {
    CREATED_AT_ONLY_ACTIONS,
    DEFAULT_BATCH_SIZE,
    MAX_BATCH_SIZE,
    MAX_EVENTS_PER_RUN,
    RETENTION_MONTHS,
    auditEventPath,
    auditExpiry,
    auditTimestamp,
    classifyAuditEvent,
    effectiveAuditDate,
    isCreatedAtOnlyAction,
    planAuditRetention,
    runAuditRetention
};
