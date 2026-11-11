// Parent-only UI isolation. Admission, key lifetime and lock state stay with the owner.
const activeScopes = new WeakMap();
export function beginFrameModalFocus({modal, dialog, onCancel, signal, window: win = window}) {
    const doc = win.document, frame = doc.getElementById('vault-frame');
    if (win.parent !== win || !frame || typeof win.vaultFrameNavigation?.holdModal !== 'function') return null;
    activeScopes.get(doc)?.cancel();
    const previous = doc.activeElement;
    const release = win.vaultFrameNavigation.holdModal(modal);
    if (typeof release !== 'function') return null;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.tabIndex = -1;
    const title = dialog.querySelector('h3');
    if (title) {title.id = `${modal.id}-title`; dialog.setAttribute('aria-labelledby', title.id);}
    let done = false;
    const siblings = [...doc.body.children].filter(node => node !== modal && node !== frame)
        .map(node => ({node, inert: node.inert}));
    for (const item of siblings) item.node.inert = true;
    const controls = () => [...dialog.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
        .filter(node => !node.disabled && node.tabIndex >= 0 && !node.closest('[inert]') &&
            node.getClientRects().length && win.getComputedStyle(node).visibility !== 'hidden');
    const focus = () => {if (!done && modal.isConnected) (controls()[0] || dialog).focus({preventScroll: true});};
    const keydown = event => {
        if (done) return;
        if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); onCancel(); return;}
        if (event.key !== 'Tab') return;
        event.preventDefault(); event.stopPropagation();
        const list = controls(), current = list.indexOf(doc.activeElement);
        if (!list.length) {dialog.focus({preventScroll: true}); return;}
        const next = current < 0 ? (event.shiftKey ? list.length - 1 : 0)
            : (current + (event.shiftKey ? -1 : 1) + list.length) % list.length;
        list[next].focus({preventScroll: true});
    };
    const focusin = event => {if (!done && !modal.contains(event.target)) focus();};
    // Focusing a descendant document can blur the parent without parent focusin.
    const blur = () => {if (!done && !doc.hidden && doc.activeElement === frame) win.queueMicrotask(focus);};
    const cancel = () => {if (!done) onCancel();};
    const visibility = () => {if (doc.hidden) cancel();};
    doc.addEventListener('keydown', keydown, true);
    doc.addEventListener('focusin', focusin, true);
    doc.addEventListener('visibilitychange', visibility);
    doc.addEventListener('freeze', cancel);
    win.addEventListener('pagehide', cancel);
    win.addEventListener('blur', blur);
    const scope = Object.freeze({cancel, close() {
        if (done) return;
        done = true;
        if (activeScopes.get(doc) === scope) activeScopes.delete(doc);
        doc.removeEventListener('keydown', keydown, true);
        doc.removeEventListener('focusin', focusin, true);
        doc.removeEventListener('visibilitychange', visibility);
        doc.removeEventListener('freeze', cancel);
        win.removeEventListener('pagehide', cancel);
        win.removeEventListener('blur', blur);
        for (const item of siblings) if (item.node.isConnected) item.node.inert = item.inert;
        release();
        // Never put focus back into the child, especially after cancellation/revocation.
        if (!signal?.aborted && !doc.hidden && previous?.isConnected && previous !== frame &&
            !previous.closest?.('[inert]') && previous.getClientRects().length &&
            win.getComputedStyle(previous).visibility !== 'hidden') previous.focus({preventScroll: true});
    }});
    activeScopes.set(doc, scope);
    return scope;
}
