import { createDocumentationGuide } from './documentation-guide.js';
import { documentationLabel as label } from './documentation-ui-labels.js';

const CATALOG_URL = '/assets/js/modules/assistant/documentation-catalog.json';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

export async function openDocumentationView({ pageId, trigger, signal, onClose }) {
    const response = await fetch(CATALOG_URL, { credentials: 'omit', signal, cache: 'no-cache' });
    if (!response.ok) throw new Error('GUIDE_UNAVAILABLE');
    const catalog = await response.json();
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const service = createDocumentationGuide(catalog);
    if (!service.getPageGuide(pageId)) throw new Error('GUIDE_PAGE_UNKNOWN');
    let live = true;
    let modalObserver = null;
    const overlay = element('div', null, 'documentation-overlay');
    const panel = element('section', null, 'documentation-panel');
    panel.lang = catalog.fallbackLocale;
    panel.tabIndex = -1;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'documentation-title');
    panel.setAttribute('aria-describedby', 'documentation-privacy');
    const header = element('header', null, 'documentation-heading');
    const title = element('h2', label('guide.ui.title'));
    title.id = 'documentation-title';
    const closeButton = element('button', label('guide.ui.close'), 'documentation-button');
    closeButton.type = 'button';
    closeButton.id = 'documentation-close';
    header.append(title, closeButton);
    const privacy = element('p', label('guide.ui.privacy'));
    privacy.id = 'documentation-privacy';
    const fallback = element('p', label('guide.ui.fallback'), 'documentation-fallback');
    // Only the existing non-sensitive language preference is consulted.
    try { fallback.hidden = (localStorage.getItem('app_language') || 'it') === catalog.fallbackLocale; }
    catch { fallback.hidden = false; }
    const controls = element('div', null, 'documentation-controls');
    const pageLabel = element('label', label('guide.ui.page'));
    pageLabel.htmlFor = 'documentation-page';
    const select = element('select');
    select.id = 'documentation-page';
    select.className = 'documentation-select';
    catalog.pages.forEach(page => {
        const option = element('option', service.getPageGuide(page.pageId).title);
        option.value = page.pageId;
        select.append(option);
    });
    const firstSteps = element('button', label('guide.ui.firstSteps'), 'documentation-button');
    firstSteps.type = 'button';
    firstSteps.id = 'documentation-first-steps';
    const context = element('button', label('guide.ui.context'), 'documentation-button');
    context.type = 'button';
    context.id = 'documentation-current-page';
    controls.append(pageLabel, select, firstSteps, context);
    const journey = element('nav', null, 'documentation-journey');
    journey.setAttribute('aria-label', label('guide.ui.firstSteps'));
    journey.hidden = true;
    const article = element('article', null, 'documentation-article');
    const announce = element('span', null, 'sr-only');
    announce.setAttribute('role', 'status');
    const render = selectedId => {
        const guide = service.getPageGuide(selectedId);
        if (!guide) return;
        select.value = guide.pageId;
        const heading = element('h3', guide.title);
        const purpose = element('p', guide.purpose);
        const instructions = element('ol');
        guide.steps.forEach(step => instructions.append(element('li', step.body)));
        const related = element('nav', null, 'documentation-related');
        related.setAttribute('aria-label', label('guide.ui.related'));
        related.append(element('h4', label('guide.ui.related')));
        guide.relatedPageIds.forEach(id => {
            const button = element('button', service.getPageGuide(id).title, 'documentation-button');
            button.type = 'button';
            button.addEventListener('click', () => { render(id); select.focus(); });
            related.append(button);
        });
        const version = element('p', `${label('guide.ui.version')}: ${guide.contentVersion} · ${guide.reviewedAppVersion}`, 'documentation-version');
        article.replaceChildren(heading, purpose, instructions, related, version);
        article.scrollTop = 0;
        announce.textContent = guide.title;
    };
    const showFirstSteps = () => {
        if (!journey.hidden) { journey.hidden = true; return; }
        journey.replaceChildren();
        const route = service.listJourneys().find(item => item.journeyId === 'first-use');
        route.pageIds.forEach((id, index) => {
            const button = element('button', `${index + 1}. ${service.getPageGuide(id).title}`, 'documentation-button');
            button.type = 'button';
            button.addEventListener('click', () => { render(id); select.focus(); });
            journey.append(button);
        });
        journey.hidden = false;
        announce.textContent = route.title;
    };
    const background = [...document.body.children].map(node => ({ node, inert: node.inert }));
    const previousFocus = document.activeElement;
    const otherModalVisible = () => [...document.querySelectorAll('[aria-modal="true"], .modal-overlay.active')]
        .some(node => !overlay.contains(node) && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden');
    if (otherModalVisible()) throw new Error('GUIDE_BUSY');
    const close = ({ restoreFocus = true } = {}) => {
        if (!live) return;
        live = false;
        modalObserver?.disconnect();
        document.removeEventListener('keydown', keydown, true);
        signal.removeEventListener('abort', abort);
        background.forEach(({ node, inert }) => { if (node.isConnected) node.inert = inert; });
        overlay.remove();
        onClose?.();
        const focus = trigger?.isConnected ? trigger : previousFocus;
        if (restoreFocus && focus?.isConnected && !document.body.inert && !document.body.hidden) focus.focus?.();
    };
    const keydown = event => {
        if (!live) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
        if (event.key !== 'Tab') return;
        const controls = [...panel.querySelectorAll('button, select')].filter(node => !node.disabled && node.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
            event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
            event.preventDefault(); first?.focus();
        }
    };
    const abort = () => close({ restoreFocus: false });
    closeButton.addEventListener('click', () => close());
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    select.addEventListener('change', () => render(select.value));
    firstSteps.addEventListener('click', showFirstSteps);
    context.addEventListener('click', () => { journey.hidden = true; render(pageId); });
    panel.append(header, privacy, fallback, controls, journey, article, announce);
    overlay.append(panel);
    render(pageId);
    background.forEach(({ node }) => { node.inert = true; });
    document.body.append(overlay);
    modalObserver = new MutationObserver(() => {
        if (live && otherModalVisible()) close({ restoreFocus: false });
    });
    modalObserver.observe(document.body, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['aria-modal', 'class', 'hidden', 'style'] });
    document.addEventListener('keydown', keydown, true);
    signal.addEventListener('abort', abort, { once: true });
    closeButton.focus();
    return Object.freeze({ isOpen: () => live, destroy: () => close({ restoreFocus: false }) });
}
