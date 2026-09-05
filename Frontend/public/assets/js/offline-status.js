const BANNER_ID = 'offline-status-banner';

function updateOfflineStatus() {
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
        banner = document.createElement('div');
        banner.id = BANNER_ID;
        banner.className = 'offline-status-banner';
        banner.setAttribute('role', 'status');
        banner.textContent = 'Modalità offline · vengono mostrati i dati salvati su questo dispositivo';
        document.body?.prepend(banner);
    }
    banner.hidden = navigator.onLine;
    document.documentElement.toggleAttribute('data-offline', !navigator.onLine);
}

export function initOfflineStatus() {
    updateOfflineStatus();
    window.addEventListener('online', updateOfflineStatus);
    window.addEventListener('offline', updateOfflineStatus);
}

