import { APP_VERSION } from './env-v126.js';

const ENGINE_POLICY = Object.freeze([
    { id: 'm7-purge', label: 'M7 · Cancellazione definitiva', state: 'limited', detail: 'Disponibile solo per il collaudo autorizzato; blocco globale attivo.' },
    { id: 'm8-restore', label: 'M8 · Ripristino corrente', state: 'active', detail: 'Ripristino corrente disponibile con anteprima e controlli di sicurezza.' },
    { id: 'm8-resumable', label: 'M8 · Ripristino riprendibile', state: 'off', detail: 'Motore V2 mantenuto disabilitato.' },
    { id: 'cpfe2-read', label: 'CPFE2 · Lettura', state: 'active', detail: 'Lettura compatibile del nuovo formato disponibile.' },
    { id: 'cpfe2-write', label: 'CPFE2 · Nuove scritture', state: 'off', detail: 'Nuove scritture nel formato CPFE2 mantenute disabilitate.' },
    { id: 'mfa-recovery', label: 'MFA · Recupero selettivo', state: 'off', detail: 'Rimozione automatica selettiva del fattore mantenuta disabilitata.' }
]);

function result(id, label, status, detail) {
    return { id, label, status, detail: String(detail || '').slice(0, 160) };
}

async function checkLocalStorage(storage) {
    const key = 'codex_diagnostics_probe';
    try {
        storage.setItem(key, '1');
        const valid = storage.getItem(key) === '1';
        storage.removeItem(key);
        return result('local-storage', 'Archivio locale', valid ? 'pass' : 'fail', valid ? 'Scrittura temporanea riuscita.' : 'La lettura non coincide con la scrittura.');
    } catch {
        try { storage.removeItem(key); } catch { /* archivio non accessibile */ }
        return result('local-storage', 'Archivio locale', 'fail', 'Scrittura temporanea non disponibile.');
    }
}

async function checkHosting(fetcher, online) {
    if (!online) return result('hosting', 'File applicazione', 'warn', 'Dispositivo offline: controllo remoto non eseguito.');
    try {
        const response = await fetcher(`/assets/js/env-v126.js?diagnostic=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
        return result('hosting', 'File applicazione', response.ok ? 'pass' : 'fail', response.ok ? `Versione ${APP_VERSION} raggiungibile.` : `Risposta HTTP ${response.status}.`);
    } catch {
        return result('hosting', 'File applicazione', 'fail', 'File della versione non raggiungibile.');
    }
}

export function getEnginePolicyReport() {
    return ENGINE_POLICY.map(item => ({ ...item }));
}

export async function runAppDiagnostics({
    online = navigator.onLine,
    storage = localStorage,
    fetcher = fetch,
    cryptoApi = globalThis.crypto,
    indexedDb = globalThis.indexedDB,
    serviceWorker = navigator.serviceWorker,
    authenticated = false
} = {}) {
    const checks = [
        result('network', 'Connessione', online ? 'pass' : 'warn', online ? 'Browser online.' : 'Browser offline.'),
        result('authentication', 'Sessione utente', authenticated ? 'pass' : 'fail', authenticated ? 'Utente autenticato.' : 'Sessione non autenticata.'),
        result('web-crypto', 'Crittografia browser', cryptoApi?.subtle ? 'pass' : 'fail', cryptoApi?.subtle ? 'Web Crypto disponibile.' : 'Web Crypto non disponibile.'),
        result('indexed-db', 'Database offline', indexedDb ? 'pass' : 'fail', indexedDb ? 'IndexedDB disponibile.' : 'IndexedDB non disponibile.'),
        result('service-worker', 'Modalità offline', serviceWorker?.controller ? 'pass' : 'warn', serviceWorker?.controller ? 'Service Worker attivo.' : 'Service Worker non ancora attivo in questa scheda.')
    ];
    checks.push(await checkLocalStorage(storage));
    checks.push(await checkHosting(fetcher, online));
    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        overall: checks.some(check => check.status === 'fail') ? 'fail' : checks.some(check => check.status === 'warn') ? 'warn' : 'pass',
        checks,
        engines: getEnginePolicyReport(),
        limits: [
            'I controlli non leggono contenuti della Vault e non modificano dati remoti.',
            'Lo stato motori descrive la politica della release; non sostituisce collaudi GCS, dispositivi fisici, audit o privacy.'
        ]
    };
}
