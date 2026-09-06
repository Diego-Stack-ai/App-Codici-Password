const CACHE_KEY = 'codex_show_company_area';
const keyFor = uid => uid ? `${CACHE_KEY}:${uid}` : CACHE_KEY;

export function getCachedCompanyAreaPreference(uid = '') {
    const value = localStorage.getItem(keyFor(uid));
    return value === null ? true : value !== 'false';
}

export function cacheCompanyAreaPreference(enabled, uid = '') {
    localStorage.setItem(keyFor(uid), enabled ? 'true' : 'false');
    return enabled;
}

export function getSyncedCompanyAreaPreference(userData, uid = '') {
    const enabled = userData?.settings_show_company_area !== false;
    return cacheCompanyAreaPreference(enabled, uid);
}

export function applyCompanyAreaVisibility(enabled) {
    document.querySelectorAll('[data-company-area]').forEach(element => {
        element.classList.toggle('hidden', !enabled);
    });
}
