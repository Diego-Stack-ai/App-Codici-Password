// D0 help bootstrap: independent of authentication and the Vault.
import { documentationLabel } from './modules/assistant/documentation-ui-labels.js';

const CONTROLLER_URL = './modules/assistant/documentation-view.js?v=1.2.221';
let activeHelp = null;

export function initDocumentationHelp(pathname = window.location.pathname) {
    return mountDocumentationHelp(getDocumentationPageContext(pathname));
}

export default initDocumentationHelp;
export { initDocumentationHelp as init };

// Canonical route context only: no query, record ID or identity is captured.
export function getDocumentationPageContext(pathname) {
    if (pathname === '/home') return Object.freeze({ pageId: 'home_page' });
    const match = typeof pathname === 'string' && /^\/([a-z][a-z0-9_-]*)\.html$/.exec(pathname);
    return Object.freeze({ pageId: match ? match[1] : null });
}

export function mountDocumentationHelp({ pageId } = {}) {
    if (!pageId || pageId === 'prova' || pageId === 'index') return null;
    if (activeHelp?.pageId === pageId && activeHelp.live()) return activeHelp;
    activeHelp?.destroy();
    const pageHost = document.querySelector('.page-container') || document.querySelector('.vault')
        || document.querySelector('main.shared-contact-card');
    const footerHost = document.getElementById('footer-center-actions');
    const host = footerHost || pageHost;
    if (!host) return null;
    let live = true;
    let loading = false;
    let view = null;
    const abort = new AbortController();
    if (!document.querySelector('link[data-documentation-style]')) {
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = '/assets/css/documentation-guide.css?v=1.2.221';
        stylesheet.dataset.documentationStyle = 'true';
        document.head.append(stylesheet);
    }
    const entry = document.createElement('div');
    entry.className = 'documentation-entry';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = 'documentation-help-open';
    trigger.className = 'documentation-button';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.dataset.guideKey = pageId === 'impostazioni' ? 'guide.ui.start' : 'guide.ui.open';
    trigger.textContent = documentationLabel(trigger.dataset.guideKey);
    trigger.lang = 'it';
    const notice = document.createElement('span');
    notice.className = 'documentation-entry-notice';
    notice.setAttribute('role', 'status');
    entry.append(trigger, notice);
    if (footerHost) {
        entry.classList.add('documentation-entry-footer');
        trigger.classList.add('documentation-button-footer');
        trigger.title = trigger.textContent;
        trigger.setAttribute('aria-label', trigger.textContent);
        trigger.textContent = '?';
        host.append(entry);
    } else {
        host.prepend(entry);
    }
    const open = async () => {
        if (!live || loading || view) return;
        const modalOpen = [...document.querySelectorAll('[aria-modal="true"], .modal-overlay.active')]
            .some(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
        if (modalOpen) { notice.textContent = documentationLabel('guide.ui.busy'); return; }
        loading = true;
        trigger.setAttribute('aria-busy', 'true');
        notice.textContent = documentationLabel('guide.ui.loading');
        try {
            const { openDocumentationView } = await import(CONTROLLER_URL);
            if (!live) return;
            view = await openDocumentationView({ pageId, trigger, signal: abort.signal,
                onClose: () => { view = null; } });
            if (!live) { view?.destroy(); view = null; }
            else if (!view?.isOpen()) view = null;
            notice.textContent = '';
        } catch (error) {
            if (live && error?.name !== 'AbortError') notice.textContent = documentationLabel(error?.message === 'GUIDE_BUSY' ? 'guide.ui.busy' : 'guide.ui.error');
        } finally {
            loading = false;
            if (live) trigger.removeAttribute('aria-busy');
        }
    };
    trigger.addEventListener('click', open);
    const destroy = () => {
        if (!live) return;
        live = false;
        abort.abort();
        view?.destroy(); view = null;
        trigger.removeEventListener('click', open);
        window.removeEventListener('pagehide', pageHidden);
        window.removeEventListener('private-auth-blocked', destroy);
        entry.remove();
        if (activeHelp?.destroy === destroy) activeHelp = null;
    };
    const pageHidden = event => {
        destroy();
        if (event.persisted) window.addEventListener('pageshow', restored => {
            if (restored.persisted) initDocumentationHelp();
        }, { once: true });
    };
    window.addEventListener('pagehide', pageHidden);
    window.addEventListener('private-auth-blocked', destroy);
    activeHelp = Object.freeze({ pageId, live: () => live, destroy });
    return activeHelp;
}
