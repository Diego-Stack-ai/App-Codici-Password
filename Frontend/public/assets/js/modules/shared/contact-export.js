import {auth} from '../../firebase-config.js?v=1.2.292';
import {onAuthStateChanged} from '/assets/js/vendor/firebase-runtime.js';
import {authSessionFence} from '../../auth-session-fence.js';
import {executeFrameNativeAction} from '../core/vault-frame-client.js';
import {isVaultUnlocked} from '../core/security-manager.js';
import {createElement} from '../../dom-utils.js';
import {t, tf} from '../../translations.js';
import {contactVCardFileName, createContactFileActions} from './contact-export-model.js';

let activeDialog;

// Lazy entry prepares the immutable file before a new trusted native click.
export async function openContactExport({value, holder, target, isCurrent, signal, opener = document.activeElement}) {
    const uid = auth.currentUser?.uid;
    const current = () => Boolean(uid && auth.currentUser?.uid === uid && !signal?.aborted && isCurrent() && isVaultUnlocked());
    if (!current()) return;
    const permit = await authSessionFence.readPermit();
    if (!permit || !current() || !await authSessionFence.isCurrent(permit) || !current()) throw Error('CONTACT_EXPORT_SESSION_CHANGED');
    activeDialog?.();
    const filename = contactVCardFileName(holder);
    const snapshotBytes = new TextEncoder().encode(value);
    return new Promise(resolve => {
        let disposed = false, phase = 'preparing', unsubscribe, attempt, serial = 0;
        const local = () => {
            if (disposed || !current() || !authSessionFence.isLocallyCurrent(permit)) throw Error('CONTACT_EXPORT_SESSION_CHANGED');
        };
        const actions = createContactFileActions({value, filename, assertActive: local,
            checkCurrent: async () => {local(); if (!await authSessionFence.isCurrent(permit)) throw Error('CONTACT_EXPORT_SESSION_CHANGED'); local();}});
        value = null;
        const overlay = createElement('div', {className: 'modal-overlay active', id: 'contact-export-modal', 'data-export-state': 'preparing'});
        const title = createElement('h3', {className: 'modal-title', id: 'contact-export-title', textContent: t('contact_export_title')});
        const status = createElement('p', {className: 'modal-description', role: 'status', 'aria-live': 'polite'});
        const help = createElement('p', {className: 'modal-description contact-export-download-help'});
        const close = createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: t('close')});
        const primary = createElement('button', {type: 'button', className: 'btn-modal btn-primary contact-export-primary', disabled: true});
        const method = createElement('select', {id: 'contact-export-method', disabled: true});
        const options = createElement('details', {className: 'contact-export-options'}, [
            createElement('summary', {textContent: t('contact_export_options')}),
            createElement('label', {htmlFor: method.id, textContent: t('contact_export_method')}), method
        ]);
        const box = createElement('div', {className: 'modal-box contact-export-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title.id}, [
            title,
            createElement('p', {className: 'modal-description', textContent: t('contact_export_file')}),
            createElement('p', {className: 'data-value contact-export-name', textContent: filename}),
            createElement('p', {className: 'modal-description', textContent: t('contact_export_hint')}),
            status, options, help,
            createElement('div', {className: 'modal-actions contact-export-actions'}, [primary, close])
        ]);
        const labels = {share: 'contact_export_share_save', save: 'contact_export_save', download: 'contact_export_download'};
        const capabilities = () => {
            const native = ['share', 'save'].filter(name => name === 'share' ? actions.canShare() : actions.canSave());
            return native.length ? native : ['download'];
        };
        let selected;
        const updateSelection = () => {
            selected = method.value;
            primary.textContent = t(phase === 'result' ? 'contact_export_retry' : labels[selected]);
            help.textContent = selected === 'download' ? t('contact_export_download_hint') : '';
        };
        const updateCapabilities = () => {
            const available = capabilities();
            method.replaceChildren(...available.map(name => createElement('option', {value: name, textContent: t(labels[name])})));
            selected = available.includes(selected) ? selected : available[0];
            method.value = selected;
            options.hidden = available.length < 2;
            updateSelection();
        };
        const focus = () => {if (!disposed && current()) (primary.disabled ? close : primary).focus({preventScroll: true});};
        const cleanup = () => {
            if (disposed) return;
            disposed = true; serial++; attempt?.abort(); actions.dispose(); snapshotBytes.fill(0); unsubscribe?.();
            signal?.removeEventListener('abort', cleanup); document.removeEventListener('focusin', containFocus);
            overlay.remove();
            if (activeDialog === cleanup) activeDialog = null;
            if (current() && opener?.isConnected) opener.focus({preventScroll: true});
            resolve();
        };
        const containFocus = event => {
            if (disposed || overlay.contains(event.target)) return;
            if (phase === 'preparing' && event.target.closest?.('.modal-overlay.active')) return;
            focus();
        };
        const arm = () => {
            try {local();} catch {cleanup(); return;}
            attempt?.abort(); attempt = new AbortController();
            const turn = ++serial;
            let launched = null;
            phase = 'preparing'; overlay.dataset.exportState = phase; primary.disabled = method.disabled = true;
            updateCapabilities(); status.textContent = t('contact_export_preparing'); focus();
            void Promise.resolve(executeFrameNativeAction({...target, snapshotBytes}, name => {launched = name; return actions[name]();}, {
                kind: 'contact', signal: attempt.signal,
                connect: ({launch}) => {
                    local();
                    if (turn !== serial || attempt.signal.aborted) throw Error('CONTACT_EXPORT_SESSION_CHANGED');
                    phase = 'ready'; overlay.dataset.exportState = phase; primary.disabled = method.disabled = false; status.textContent = '';
                    updateSelection(); focus();
                    const click = event => {
                        if (!event.isTrusted || phase !== 'ready') return;
                        try {local();} catch {cleanup(); return;}
                        phase = 'performing'; overlay.dataset.exportState = phase; primary.disabled = method.disabled = true;
                        status.textContent = t('contact_export_pending'); close.focus({preventScroll: true});
                        launch(event, selected);
                    };
                    primary.addEventListener('click', click);
                    return () => primary.removeEventListener('click', click);
                }
            })).then(result => {
                if (disposed || turn !== serial || !current()) return;
                local();
                const key = result?.kind === 'saved' ? 'contact_export_saved' : result?.kind === 'shared' ? 'contact_export_shared'
                    : result?.kind === 'download-started' ? 'contact_export_started' : 'contact_export_cancelled';
                status.textContent = tf(key, {name: result?.name || filename});
            }).catch(error => {
                if (disposed || turn !== serial || !current()) return;
                status.textContent = t(error?.name === 'AbortError' ? 'contact_export_cancelled'
                    : error?.name === 'NotSupportedError' && launched === 'share' ? 'contact_export_share_unavailable' : 'contact_export_failed');
            }).finally(() => {
                if (disposed || turn !== serial) return;
                if (!current() || !authSessionFence.isLocallyCurrent(permit)) {cleanup(); return;}
                phase = 'result'; overlay.dataset.exportState = phase; primary.disabled = method.disabled = false; updateCapabilities(); focus();
            });
        };
        primary.addEventListener('click', event => {if (event.isTrusted && phase === 'result') arm();});
        method.onchange = updateSelection; options.ontoggle = updateSelection;
        close.onclick = cleanup;
        overlay.onclick = event => {if (event.target === overlay) cleanup();};
        box.onkeydown = event => {
            if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); cleanup();}
            if (event.key === 'Tab') {
                const controls = [...box.querySelectorAll('button,summary,select')].filter(control => !control.disabled && control.getClientRects().length);
                event.preventDefault(); const index = controls.indexOf(document.activeElement);
                controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
            }
        };
        activeDialog = cleanup; overlay.append(box); document.body.append(overlay);
        document.addEventListener('focusin', containFocus); signal?.addEventListener('abort', cleanup, {once: true});
        unsubscribe = onAuthStateChanged(auth, user => {if (user?.uid !== uid) cleanup();});
        if (disposed) unsubscribe?.();
        if (!current()) cleanup(); else arm();
    });
}
