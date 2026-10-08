// [M6-A-7 R1] Trigger **tecnico** dell'upgrade per il pilota di sviluppo, senza dipendenze
// Firebase: è lo stesso codice che il pilota riesporta, così può essere provato direttamente sul
// percorso reale. Nessun percorso dell'app lo avvia da sé: si esegue solo se qualcuno lo invoca.
import {inspectOfflineQueueSchema, upgradeOfflineQueueSchema} from './offline-mutation-upgrade.js';

function assertUid(uid) {
    if (!uid) throw new Error('PRIVATE_ACCOUNT_PILOT_INPUT_INVALID');
}

// Snapshot **senza creare nulla**: su coda assente la sonda fallisce con `QUEUE_UPGRADE_MISSING`
// e non nasce alcun database. Tutte le attese sono limitate e la sessione è verificata.
export async function inspectPrivateAccountPilotQueue({uid, indexedDb, signal, isActive, timeoutMs} = {}) {
    assertUid(uid);
    const schema = await inspectOfflineQueueSchema({uid, indexedDb, signal, isActive, timeoutMs});
    return {version: schema.version, stores: schema.stores, operations: schema.rows.length};
}

// Upgrade additivo su richiesta esplicita: crea **solo** `queueLeases` e lascia i contenitori
// sigillati identici. Se la coda non esiste non viene creata; blocco, scadenza, abort e schema
// inatteso falliscono chiusi con un codice dichiarato. Quando aggiornare le **PWA installate**
// resta una decisione di prodotto aperta (M6-F3 e collaudi fisici).
export async function upgradePrivateAccountPilotQueue({uid, indexedDb, signal, isActive, timeoutMs} = {}) {
    assertUid(uid);
    const before = await inspectPrivateAccountPilotQueue({uid, indexedDb, signal, isActive, timeoutMs});
    const outcome = await upgradeOfflineQueueSchema({uid, indexedDb, signal, isActive, timeoutMs});
    return {...outcome, previousVersion: before.version};
}
