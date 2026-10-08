// Candidato di laboratorio (M7-R3). NON importato dall'applicazione né da
// Functions produttive: nessun job distribuito, nessuna scrittura reale.
//
// Traduce in piano verificabile la decisione di Diego del 21/09/2026 per il
// registro tecnico `users/{uid}/auditEvents`: conservazione di **24 mesi** dal
// timestamp autorevole, poi cancellazione automatica controllata dal backend;
// il client non può creare, modificare o cancellare singoli eventi.
//
// La correzione del 21/09/2026 (24 mesi al posto di 12) sostituisce la prima
// indicazione: la finestra vive nella costante RETENTION_MONTHS qui sotto.
//
// Regole di progetto codificate qui:
// - il timestamp autorevole è `at`, impostato dal backend con serverTimestamp;
// - un evento senza data valida è `unverifiable` e NON viene mai cancellato:
//   non si inventa una data per eliminare un record che non si sa datare;
// - la finestra usa mesi di calendario (non 365 giorni fissi); la convenzione
//   è una scelta di dettaglio da confermare ed è parametro del modulo;
// - i lotti rispettano il limite di scritture batch di Firestore (500);
// - nessun percorso pianificato può uscire da `users/{uid}/auditEvents/`:
//   le ricevute di idempotenza e ogni altra collezione sono escluse per costruzione.

export const RETENTION_MONTHS = 24;
export const DEFAULT_BATCH_SIZE = 200;
export const MAX_BATCH_SIZE = 500; // limite di operazioni per batch Firestore
export const MAX_EVENTS_PER_RUN = 10_000;

const IDENTIFIER = /^[A-Za-z0-9._:-]{1,200}$/;
const fail = code => Object.assign(new Error(code), {code});

export function auditEventPath(uid, id) {
  if (typeof uid !== 'string' || !IDENTIFIER.test(uid)) throw fail('AUDIT_RETENTION_UID_INVALID');
  if (typeof id !== 'string' || !IDENTIFIER.test(id)) throw fail('AUDIT_RETENTION_ID_INVALID');
  const path = `users/${uid}/auditEvents/${id}`;
  if (!path.startsWith(`users/${uid}/auditEvents/`)) throw fail('AUDIT_RETENTION_PATH_FORBIDDEN');
  return path;
}

// Accetta le forme con cui Firestore restituisce un Timestamp (istanza SDK,
// oggetto {seconds,nanoseconds}, Date lato test). Qualunque altra cosa è
// inverificabile: stringhe, numeri, null, oggetti vuoti, NaN.
//
// Difetto corretto dopo la revisione Codex del 21/09/2026: i nanosecondi di un
// Timestamp Firestore sono validi solo da 0 a 999999999 e i secondi devono
// cadere nell'intervallo rappresentabile da una data JavaScript. Un valore
// fuori intervallo è malformato e deve restare `unverifiable`, non diventare
// una data stimata.
const MAX_NANOSECONDS = 999_999_999;
const MAX_DATE_MS = 8.64e15; // intervallo massimo di Date in millisecondi

function safeInstant(ms) {
  return Number.isSafeInteger(ms) && Number.isFinite(ms) && Math.abs(ms) <= MAX_DATE_MS &&
    Number.isFinite(new Date(ms).getTime()) ? ms : null;
}

export function auditTimestamp(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? safeInstant(value.getTime()) : null;
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? safeInstant(date.getTime()) : null;
  }
  const seconds = value?.seconds, rawNanoseconds = value?.nanoseconds;
  // Un nanosecondo presente ma non intero (null, stringa, NaN, Infinity) è malformato.
  if (rawNanoseconds !== undefined && !Number.isInteger(rawNanoseconds)) return null;
  const nanoseconds = rawNanoseconds === undefined ? 0 : rawNanoseconds;
  if (!Number.isSafeInteger(seconds) || seconds < 0) return null;
  if (nanoseconds < 0 || nanoseconds > MAX_NANOSECONDS) return null;
  return safeInstant(seconds * 1000 + Math.floor(nanoseconds / 1e6));
}

// Scadenza con mesi di calendario: il giorno viene limitato se il mese di
// destinazione è più corto (29/02 -> 28/02 negli anni non bisestili).
export function auditExpiry(at, months = RETENTION_MONTHS) {
  if (!Number.isFinite(at)) throw fail('AUDIT_RETENTION_TIME_INVALID');
  if (!Number.isSafeInteger(months) || months <= 0) throw fail('AUDIT_RETENTION_MONTHS_INVALID');
  const from = new Date(at), day = from.getUTCDate();
  const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1,
    from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.getTime();
}

export function classifyAuditEvent(event, now, {months = RETENTION_MONTHS} = {}) {
  if (!Number.isFinite(now)) throw fail('AUDIT_RETENTION_CLOCK_INVALID');
  const at = auditTimestamp(event?.at);
  if (at === null) return 'unverifiable';
  const expiry = auditExpiry(at, months);
  // Una scadenza non calcolabile non autorizza né la conservazione né la
  // cancellazione: l'evento resta inverificabile e fuori da ogni lotto.
  if (!Number.isFinite(expiry)) return 'unverifiable';
  return expiry <= now ? 'expired' : 'retained';
}

// Piano deterministico: solo gli eventi scaduti e databili, dal più vecchio,
// con spareggio sull'id, divisi in lotti entro il limite Firestore.
export function planAuditRetention({uid, events = [], now, batchSize = DEFAULT_BATCH_SIZE, months = RETENTION_MONTHS} = {}) {
  if (!Number.isFinite(now)) throw fail('AUDIT_RETENTION_CLOCK_INVALID');
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) throw fail('AUDIT_RETENTION_BATCH_INVALID');
  if (!Array.isArray(events) || events.length > MAX_EVENTS_PER_RUN) throw fail('AUDIT_RETENTION_INPUT_INVALID');
  const expired = [], retained = [], unverifiable = [];
  for (const event of events) {
    if (event?.uid !== undefined && event.uid !== uid) throw fail('AUDIT_RETENTION_UID_MISMATCH');
    const id = event?.id;
    const path = auditEventPath(uid, id);
    const at = auditTimestamp(event.at);
    const state = classifyAuditEvent(event, now, {months});
    if (state === 'expired') expired.push({id, path, at});
    else if (state === 'retained') retained.push(id);
    else unverifiable.push(id);
  }
  expired.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const batches = [];
  for (let index = 0; index < expired.length; index += batchSize) {
    const slice = expired.slice(index, index + batchSize);
    batches.push(Object.freeze({index: batches.length, ids: Object.freeze(slice.map(item => item.id)),
      paths: Object.freeze(slice.map(item => item.path))}));
  }
  return Object.freeze({
    uid, now, months, batchSize,
    batches: Object.freeze(batches),
    expired: Object.freeze(expired.map(item => item.id)),
    retained: Object.freeze(retained),
    unverifiable: Object.freeze(unverifiable)
  });
}

// Esecutore: cancella lotti nell'ordine del piano, si ferma al primo errore e
// non dichiara mai completato ciò che non lo è. La ripetizione è idempotente
// perché il piano si ricalcola dagli eventi ancora presenti.
//
// Ogni lotto viene ri-derivato da UID e id prima di qualunque chiamata: un
// piano arbitrario con UID non valido o percorso non coerente viene rifiutato
// senza invocare `deleteBatch` (revisione Codex del 21/09/2026).
export async function runAuditRetention({plan, deleteBatch, isActive = () => true} = {}) {
  if (!plan?.batches || typeof deleteBatch !== 'function' || typeof isActive !== 'function') throw fail('AUDIT_RETENTION_RUN_INVALID');
  if (typeof plan.uid !== 'string' || !IDENTIFIER.test(plan.uid)) throw fail('AUDIT_RETENTION_UID_INVALID');
  let completed = 0;
  for (const batch of plan.batches) {
    if (!Array.isArray(batch.ids) || !Array.isArray(batch.paths) || batch.ids.length !== batch.paths.length) {
      throw fail('AUDIT_RETENTION_PATH_FORBIDDEN');
    }
    for (let index = 0; index < batch.ids.length; index++) {
      // auditEventPath valida UID e id e ricostruisce il percorso atteso.
      if (auditEventPath(plan.uid, batch.ids[index]) !== batch.paths[index]) throw fail('AUDIT_RETENTION_PATH_FORBIDDEN');
    }
    if (!isActive()) return Object.freeze({status: 'interrupted', completed, total: plan.batches.length});
    try {
      await deleteBatch({index: batch.index, ids: batch.ids, paths: batch.paths});
    } catch (error) {
      return Object.freeze({status: 'partial', completed, total: plan.batches.length,
        failedBatch: batch.index, code: error?.code ?? null, message: String(error?.message ?? error)});
    }
    completed++;
  }
  return Object.freeze({status: 'completed', completed, total: plan.batches.length});
}
