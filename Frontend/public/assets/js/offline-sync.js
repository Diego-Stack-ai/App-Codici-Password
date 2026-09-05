import { getDocsSmart as getDocs } from "/assets/js/offline-firestore.js";
import { collection } from "/assets/js/vendor/firebase-runtime.js";
import { db } from './firebase-config.js?v=1.2.37';

const CORE_COLLECTIONS = [
    'accounts',
    'aziende',
    'contacts',
    'deadlineNotifications',
    'profileWidgets',
    'scadenze',
    'settings'
];

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

export async function prepareOfflineData(user) {
    if (!user?.uid || !navigator.onLine) return getOfflineReadiness(user?.uid);

    const results = await Promise.allSettled(CORE_COLLECTIONS.map(async (name) => {
        const snapshot = await getDocs(collection(db, 'users', user.uid, name));
        return { name, count: snapshot.size, snapshot };
    }));
    const companiesResult = results.find(result =>
        result.status === 'fulfilled' && result.value.name === 'aziende');
    const companies = companiesResult?.status === 'fulfilled'
        ? companiesResult.value.snapshot.docs : [];
    const companyAccounts = await Promise.allSettled(companies.map(company =>
        getDocs(collection(db, 'users', user.uid, 'aziende', company.id, 'accounts'))));

    const failedCollections = results
        .map((result, index) => result.status === 'rejected' ? CORE_COLLECTIONS[index] : null)
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
    return readiness;
}
