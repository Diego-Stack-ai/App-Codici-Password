import {
    getDoc as getDocOnline,
    getDocFromCache,
    getDocs as getDocsOnline,
    getDocsFromCache
} from '/assets/js/vendor/firebase-runtime.js';

const requests = new Map();
const referenceIds = new WeakMap();
let nextReferenceId = 1;

function deduplicate(key, operation) {
    if (requests.has(key)) return requests.get(key);
    const pending = operation().finally(() => requests.delete(key));
    requests.set(key, pending);
    return pending;
}

function referenceKey(reference, mode) {
    if (!referenceIds.has(reference)) referenceIds.set(reference, nextReferenceId++);
    return `${mode}:${referenceIds.get(reference)}`;
}

export function getDocServerConfirmed(reference) {
    return deduplicate(referenceKey(reference, 'doc-server'), () => getDocOnline(reference));
}

export function getDocsServerConfirmed(reference) {
    return deduplicate(referenceKey(reference, 'query-server'), () => getDocsOnline(reference));
}

export async function getDocSmart(reference) {
    if (!navigator.onLine) return getDocFromCache(reference);
    try {
        const cached = await getDocFromCache(reference);
        if (cached.exists()) void getDocServerConfirmed(reference).catch(() => null);
        else return getDocServerConfirmed(reference);
        return cached;
    } catch {
        return getDocServerConfirmed(reference);
    }
}

export async function getDocsSmart(reference) {
    if (!navigator.onLine) return getDocsFromCache(reference);
    try {
        const cached = await getDocsFromCache(reference);
        // Una query vuota dalla cache non consente di distinguere tra una
        // raccolta realmente vuota e una mai sincronizzata: online chiediamo
        // conferma al server, evitando liste falsamente vuote.
        if (cached.empty) return getDocsServerConfirmed(reference);
        void getDocsServerConfirmed(reference).catch(() => null);
        return cached;
    } catch {
        return getDocsServerConfirmed(reference);
    }
}
