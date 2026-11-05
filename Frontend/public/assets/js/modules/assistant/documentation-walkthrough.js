import { presentGuideStep } from './documentation-guide.js';
import { documentationLabel as label } from './documentation-ui-labels.js';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function targetSnapshot(selector) {
    const matches = selector ? [...document.querySelectorAll(selector)] : [];
    const target = matches.length === 1 ? matches[0] : null;
    const rect = target?.getBoundingClientRect();
    const computed = target ? getComputedStyle(target) : null;
    const visible = Boolean(target && rect && rect.width > 0 && rect.height > 0
        && computed?.display !== 'none' && computed?.visibility !== 'hidden' && Number(computed?.opacity || 1) > 0);
    const enabled = Boolean(target && !target.matches(':disabled, [aria-disabled="true"]'));
    return {
        target,
        state: { matches: matches.length, visible, enabled, connected: target?.isConnected === true }
    };
}

export function openDocumentationWalkthrough({ guide, trigger, signal } = {}) {
    if (!guide?.steps?.length || signal?.aborted) return null;
    let live = true;
    let index = 0;
    let activeTarget = null;
    let animationFrame = 0;
    const previousFocus = document.activeElement;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const background = [...document.body.children].map(node => ({ node, inert: node.inert }));
    const root = element('div', null, 'documentation-walkthrough');
    const shield = element('div', null, 'documentation-walkthrough-shield');
    const spotlight = element('div', null, 'documentation-spotlight');
    spotlight.setAttribute('aria-hidden', 'true');
    const panel = element('section', null, 'documentation-walkthrough-panel');
    panel.lang = guide.fallbackLocale;
    panel.tabIndex = -1;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'documentation-walkthrough-title');
    panel.setAttribute('aria-describedby', 'documentation-walkthrough-body');
    const heading = element('div', null, 'documentation-walkthrough-heading');
    const title = element('h2', guide.title);
    title.id = 'documentation-walkthrough-title';
    const exit = element('button', label('guide.ui.exit'), 'documentation-button');
    exit.type = 'button';
    const counter = element('p', null, 'documentation-walkthrough-counter');
    const body = element('p');
    body.id = 'documentation-walkthrough-body';
    const status = element('p', null, 'documentation-walkthrough-status');
    const controls = element('div', null, 'documentation-walkthrough-controls');
    const previous = element('button', label('guide.ui.previous'), 'documentation-button');
    previous.type = 'button';
    const next = element('button', label('guide.ui.next'), 'documentation-button');
    next.type = 'button';
    const announce = element('span', null, 'sr-only');
    announce.setAttribute('role', 'status');
    heading.append(title, exit);
    controls.append(previous, next);
    panel.append(heading, counter, body, status, controls, announce);
    root.append(shield, spotlight, panel);

    const positionSpotlight = () => {
        cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(() => {
            if (!live || !activeTarget?.isConnected) {
                spotlight.hidden = true;
                return;
            }
            const rect = activeTarget.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                spotlight.hidden = true;
                return;
            }
            const gap = 8;
            spotlight.hidden = false;
            spotlight.style.setProperty('--guide-left', `${Math.max(4, rect.left - gap)}px`);
            spotlight.style.setProperty('--guide-top', `${Math.max(4, rect.top - gap)}px`);
            spotlight.style.setProperty('--guide-width', `${Math.min(innerWidth - 8, rect.width + gap * 2)}px`);
            spotlight.style.setProperty('--guide-height', `${Math.min(innerHeight - 8, rect.height + gap * 2)}px`);
        });
    };

    const render = () => {
        const step = guide.steps[index];
        const snapshot = targetSnapshot(step.target);
        const presentation = presentGuideStep(guide, step.stepId, snapshot.state);
        activeTarget = presentation?.target ? snapshot.target : null;
        root.dataset.presentation = presentation?.presentation || 'text-only';
        counter.textContent = label('guide.ui.stepCounter')
            .replace('{current}', String(index + 1)).replace('{total}', String(guide.steps.length));
        body.textContent = presentation?.body || step.body;
        status.textContent = activeTarget ? label('guide.ui.highlighted') : label('guide.ui.textOnly');
        previous.disabled = index === 0;
        next.textContent = index === guide.steps.length - 1 ? label('guide.ui.finish') : label('guide.ui.next');
        if (activeTarget) {
            activeTarget.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
        }
        positionSpotlight();
        announce.textContent = `${counter.textContent}. ${body.textContent}`;
    };

    const close = ({ restoreFocus = true } = {}) => {
        if (!live) return;
        live = false;
        cancelAnimationFrame(animationFrame);
        signal?.removeEventListener('abort', aborted);
        document.removeEventListener('keydown', keydown, true);
        window.removeEventListener('resize', positionSpotlight);
        window.removeEventListener('scroll', positionSpotlight, true);
        window.removeEventListener('pagehide', pageHidden);
        window.removeEventListener('private-auth-blocked', authBlocked);
        background.forEach(({ node, inert }) => { if (node.isConnected) node.inert = inert; });
        root.remove();
        const focus = trigger?.isConnected ? trigger : previousFocus;
        if (restoreFocus && focus?.isConnected && !document.body.inert && !document.body.hidden) focus.focus?.();
    };
    const keydown = event => {
        if (!live) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
        }
        if (event.key !== 'Tab') return;
        const available = [exit, previous, next].filter(node => !node.disabled);
        const first = available[0];
        const last = available.at(-1);
        if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
            event.preventDefault();
            first?.focus();
        }
    };
    const aborted = () => close({ restoreFocus: false });
    const pageHidden = () => close({ restoreFocus: false });
    const authBlocked = () => close({ restoreFocus: false });
    exit.addEventListener('click', () => close());
    previous.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
    next.addEventListener('click', () => {
        if (index >= guide.steps.length - 1) close();
        else { index += 1; render(); }
    });
    background.forEach(({ node }) => { node.inert = true; });
    document.body.append(root);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('resize', positionSpotlight);
    window.addEventListener('scroll', positionSpotlight, true);
    window.addEventListener('pagehide', pageHidden);
    window.addEventListener('private-auth-blocked', authBlocked);
    signal?.addEventListener('abort', aborted, { once: true });
    render();
    exit.focus();
    return Object.freeze({ isOpen: () => live, destroy: () => close({ restoreFocus: false }) });
}

export default openDocumentationWalkthrough;
