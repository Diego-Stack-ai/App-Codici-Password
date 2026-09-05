import {
    getDoc as getDocOnline,
    getDocFromCache,
    getDocs as getDocsOnline,
    getDocsFromCache
} from '/assets/js/vendor/firebase-runtime.js';

export function getDocSmart(reference) {
    return navigator.onLine ? getDocOnline(reference) : getDocFromCache(reference);
}

export function getDocsSmart(reference) {
    return navigator.onLine ? getDocsOnline(reference) : getDocsFromCache(reference);
}

