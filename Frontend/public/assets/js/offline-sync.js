import { collection, getDocsFromServer } from "/assets/js/vendor/firebase-runtime.js";
import { db } from './firebase-config.js?v=1.2.39';
import { startMetric, endMetric } from './performance-metrics.js';

const CORE_COLLECTIONS = [
    'accounts',
    'aziende',
    'contacts',
    'deadlineNotifications',
    'profileWidgets',
    'scadenze',
    'settings'
];

const PAGE_PRIORITIES = {
    home: ['accounts', 'aziende', 'scadenze', 'deadlineNotifications'],
    account_privati: ['accounts'],
    lista_aziende: ['aziende'],
    account_azienda: ['aziende'],
    scadenze: ['scadenze', 'deadlineNotifications'],
    profilo: ['profileWidgets', 'contacts'],
    profilo_v2: ['profileWidgets', 'contacts'],
    impostazioni: ['settings', 'contacts']
};

const SYNC_TTL_MS = 5 * 60 * 1000;
let activeSync = null;

function waitForIdle() {
    return new Promise(resolve => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => resolve(), { timeout: 2000 });
        } else {
            window.setTimeout(resolve, 250);
        }
    });
}

async function syncWithConcurrency(items, operation, concurrency = 3) {
    const results = new Array(items.length);
    let cursor = 0;
    async function worker() {
        while (cursor < items.length) {
            const index = cursor++;
            try {
                results[index] = { status: 'fulfilled', value: await operation(items[index]) };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return results;
}

function readinessKey(uid) {
    return `codex_offline_ready_${uid}`;
}

export function getOfflineReadiness(uid) {
    try {
        return JSON.parse(localStorage.getItem(readinessKey(uid)) || 'null');
    } catch {
        return null;
    }
}

async function syncOfflineData(user, currentPage) {
    if (!user?.uid || !navigator.onLine) return getOfflineReadiness(user?.uid);

    const previous = getOfflineReadiness(user.uid);
    if (previous?.complete && Date.now() - previous.syncedAt < SYNC_TTL_MS) return previous;

    startMetric('offline-sync');
    const priority = PAGE_PRIORITIES[currentPage] || [];
    const remaining = CORE_COLLECTIONS.filter(name => !priority.includes(name));
    const syncCollections = names => Promise.allSettled(names.map(async (name) => {
        const snapshot = await getDocsFromServer(collection(db, 'users', user.uid, name));
        return { name, count: snapshot.size, snapshot };
    }));

    const priorityResults = await syncCollections(priority);
    await waitForIdle();
    if (!navigator.onLine) return getOfflineReadiness(user.uid);
    const remainingResults = await syncCollections(remaining);
    const orderedCollections = [...priority, ...remaining];
    const results = [...priorityResults, ...remainingResults];
    const companiesResult = results.find(result =>
        result.status === 'fulfilled' && result.value.name === 'aziende');
    const companies = companiesResult?.status === 'fulfilled'
        ? companiesResult.value.snapshot.docs : [];
    const companyAccounts = await syncWithConcurrency(companies, company =>
        getDocsFromServer(collection(db, 'users', user.uid, 'aziende', company.id, 'accounts')));

    const failedCollections = results
        .map((result, index) => result.status === 'rejected' ? orderedCollections[index] : null)
        .filter(Boolean);
    if (companyAccounts.some(result => result.status === 'rejected')) {
        failedCollections.push('aziende/*/accounts');
    }

    const readiness = {
        complete: failedCollections.length === 0,
        syncedAt: Date.now(),
        failedCollections
    };
    localStorage.setItem(readinessKey(user.uid), JSON.stringify(readiness));
    window.dispatchEvent(new CustomEvent('codex:offline-readiness', { detail: readiness }));
    endMetric('offline-sync', {
        collectionCount: orderedCollections.length,
        failedCount: failedCollections.length
    });
    return readiness;
}

export function prepareOfflineData(user, currentPage = '') {
    if (activeSync) return activeSync;
    activeSync = syncOfflineData(user, currentPage).finally(() => {
        activeSync = null;
    });
    return activeSync;
}
