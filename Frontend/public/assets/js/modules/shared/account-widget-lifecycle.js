import {auth} from '../../firebase-config.js?v=1.2.110';
import {onAuthStateChanged} from '/assets/js/vendor/firebase-runtime.js';
import {createElement, clearElement} from '../../dom-utils.js';

const mounts = new WeakMap();
let promptId = 0;

export function destroyAccountWidgetMount(section) { mounts.get(section)?.destroy(); }

export function clearWidgetValues(root) {
    for (const input of root?.querySelectorAll?.('input, textarea, select') || []) input.value = '';
    for (const value of root?.querySelectorAll?.('.shared-account-value') || []) value.textContent = '';
}

export function createAccountWidgetLifecycle(context, {section, list, add}) {
    mounts.get(section)?.destroy();
    let destroyed = false, unsubscribe = () => {};
    const cleanups = new Set();
    const registerCleanup = cleanup => {
        if (destroyed) { cleanup(); return () => {}; }
        cleanups.add(cleanup);
        return () => cleanups.delete(cleanup);
    };
    const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        unsubscribe();
        context.signal?.removeEventListener('abort', destroy);
        globalThis.removeEventListener?.('pagehide', destroy);
        globalThis.removeEventListener?.('vault-session-locked', destroy);
        for (const cleanup of cleanups) { try { cleanup(); } catch {} }
        cleanups.clear();
        if (mounts.get(section) === lifecycle) {
            clearWidgetValues(list);
            clearElement(list);
            if (add) { add.onclick = null; add.classList.add('hidden'); }
            section.classList.add('hidden');
            mounts.delete(section);
        }
    };
    const active = () => {
        if (!destroyed && (context.signal?.aborted || section.isConnected === false ||
            auth.currentUser?.uid !== context.uid || (context.active && !context.active()))) destroy();
        return !destroyed;
    };
    const requestDecision = (title, message, confirmText = 'Conferma', cancelText = 'Annulla', inputOptions) => new Promise(resolve => {
        if (!active()) return resolve(inputOptions ? null : false);
        const previousFocus = document.activeElement;
        const titleId = `account-widget-prompt-${++promptId}`;
        let settled = false, unregister = () => {};
        const input = inputOptions ? createElement('input', {type: 'text', value: inputOptions.initialValue || '',
            placeholder: inputOptions.placeholder || '', autocomplete: 'off', className: 'shared-account-select-control'}) : null;
        const close = value => {
            if (settled) return;
            settled = true;
            if (input) input.value = '';
            overlay.remove();
            unregister();
            resolve(value);
            if (active() && previousFocus?.isConnected) previousFocus.focus();
        };
        const overlay = createElement('div', {className: 'modal-overlay active'}, [
            createElement('section', {className: 'modal-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId}, [
                createElement('h3', {id: titleId, className: 'modal-title', textContent: title}),
                createElement('p', {className: 'modal-text', textContent: message}), input,
                createElement('div', {className: 'modal-actions'}, [
                    createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: cancelText,
                        onclick: () => close(inputOptions ? null : false)}),
                    createElement('button', {type: 'button', className: 'btn-modal btn-primary', textContent: confirmText,
                        onclick: () => { if (active()) close(input ? input.value : true); }})
                ])
            ])
        ]);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(inputOptions ? null : false); }
        });
        unregister = registerCleanup(() => close(inputOptions ? null : false));
        document.body.appendChild(overlay);
        (input || overlay.querySelector('button'))?.focus();
    });
    const lifecycle = {active, destroy, registerCleanup, requestDecision};
    mounts.set(section, lifecycle);
    context.signal?.addEventListener('abort', destroy, {once: true});
    globalThis.addEventListener?.('pagehide', destroy, {once: true});
    globalThis.addEventListener?.('vault-session-locked', destroy, {once: true});
    if (active()) {
        unsubscribe = onAuthStateChanged(auth, user => { if (user?.uid !== context.uid) destroy(); });
        if (destroyed) unsubscribe();
    }
    return lifecycle;
}
