import {auth} from '../../firebase-config.js?v=1.2.280';
import {onAuthStateChanged} from '/assets/js/vendor/firebase-runtime.js';
import {authSessionFence} from '../../auth-session-fence.js';
import {executeFrameNativeAction} from '../core/vault-frame-client.js';
import {isVaultUnlocked} from '../core/security-manager.js';
import {createElement} from '../../dom-utils.js';
import {t, tf} from '../../translations.js';
import {contactVCardFileName, createContactFileActions} from './contact-export-model.js';

let activeDialog;

// Loaded only after an explicit contact-export command, before the native click.
export async function openContactExport({value, holder, mode = 'save', target, isCurrent, signal, opener = document.activeElement}) {
    const uid = auth.currentUser?.uid;
    const current = () => Boolean(uid && auth.currentUser?.uid === uid && !signal?.aborted && isCurrent() && isVaultUnlocked());
    if (!current()) return;
    const permit = await authSessionFence.readPermit();
    if (!permit || !current() || !await authSessionFence.isCurrent(permit) || !current()) throw Error('CONTACT_EXPORT_SESSION_CHANGED');
    activeDialog?.();
    const filename = contactVCardFileName(holder);
    const snapshotBytes = new TextEncoder().encode(value);
    return new Promise(resolve => {
        let disposed = false, pending = false, unsubscribe;
        const local = () => {
            if (disposed || !current() || !authSessionFence.isLocallyCurrent(permit)) throw Error('CONTACT_EXPORT_SESSION_CHANGED');
        };
        const actions = createContactFileActions({value, filename, assertActive: local,
            checkCurrent: async () => {local(); if (!await authSessionFence.isCurrent(permit)) throw Error('CONTACT_EXPORT_SESSION_CHANGED'); local();}});
        value = null;
        const overlay = createElement('div', {className: 'modal-overlay active', id: 'contact-export-modal'});
        const title = createElement('h3', {className: 'modal-title', id: 'contact-export-title', textContent: t('contact_export_title')});
        const status = createElement('p', {className: 'modal-description', role: 'status', 'aria-live': 'polite'});
        const close = createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: t('close')});
        const save = createElement('button', {type: 'button', className: 'btn-modal btn-primary', textContent: t('contact_export_save'), hidden: !actions.canSave()});
        const share = createElement('button', {type: 'button', className: 'btn-modal btn-primary',
            textContent: t('contact_export_share_save'), disabled: !actions.canShare()});
        const download = createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: t('contact_export_download')});
        const box = createElement('div', {className: 'modal-box contact-export-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title.id}, [
            title,
            createElement('p', {className: 'modal-description', textContent: t('contact_export_file')}),
            createElement('p', {className: 'data-value contact-export-name', textContent: filename}),
            createElement('p', {className: 'modal-description', textContent: t('contact_export_hint')}),
            createElement('p', {className: 'modal-description', textContent: t('contact_export_download_hint')}),
            status,
            createElement('div', {className: 'modal-actions contact-export-actions'}, [save, share, download, close])
        ]);
        const controls = () => [save, share, download, close].filter(button => !button.hidden && !button.disabled);
        const focus = () => {
            if (!disposed && current()) (pending ? close : mode === 'share' && !share.disabled ? share : controls()[0])?.focus();
        };
        const cleanup = () => {
            if (disposed) return;
            disposed = true; actions.dispose(); snapshotBytes.fill(0); unsubscribe?.();
            signal?.removeEventListener('abort', cleanup);
            document.removeEventListener('focusin', containFocus);
            overlay.remove();
            if (activeDialog === cleanup) activeDialog = null;
            if (current() && opener?.isConnected) opener.focus({preventScroll: true});
            resolve();
        };
        const containFocus = event => {
            if (disposed || overlay.contains(event.target)) return;
            if (pending && event.target.closest?.('.modal-overlay.active')) return;
            focus();
        };
        const run = action => {
            if (pending || disposed) return;
            try {local();} catch {cleanup(); return;}
            pending = true;
            save.disabled = share.disabled = download.disabled = true;
            status.textContent = t('contact_export_pending');
            close.focus({preventScroll: true});
            void Promise.resolve(executeFrameNativeAction({...target, snapshotBytes}, () => actions[action]()))
                .then(result => {
                    if (disposed || !current()) return;
                    local();
                    const key = result?.kind === 'saved' ? 'contact_export_saved' : result?.kind === 'shared' ? 'contact_export_shared'
                        : result?.kind === 'download-started' ? 'contact_export_started' : 'contact_export_cancelled';
                    status.textContent = tf(key, {name: result?.name || filename});
                }).catch(error => {
                    if (disposed || !current()) return;
                    status.textContent = t(error?.name === 'AbortError' ? 'contact_export_cancelled'
                        : error?.name === 'NotSupportedError' && action === 'share' ? 'contact_export_share_unavailable' : 'contact_export_failed');
                }).finally(() => {
                    if (disposed) return;
                    if (!current() || !authSessionFence.isLocallyCurrent(permit)) {cleanup(); return;}
                    pending = false;
                    save.disabled = download.disabled = false;
                    share.disabled = !actions.canShare();
                    focus();
                });
        };
        save.onclick = () => run('save'); share.onclick = () => run('share'); download.onclick = () => run('download');
        close.onclick = cleanup;
        overlay.onclick = event => {if (event.target === overlay) cleanup();};
        box.onkeydown = event => {
            if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); cleanup();}
            if (event.key === 'Tab') {
                event.preventDefault(); const list = controls(), index = list.indexOf(document.activeElement);
                list[(index + (event.shiftKey ? -1 : 1) + list.length) % list.length]?.focus();
            }
        };
        if (!actions.canShare()) status.textContent = t('contact_export_share_unavailable');
        activeDialog = cleanup;
        overlay.append(box); document.body.append(overlay);
        document.addEventListener('focusin', containFocus);
        signal?.addEventListener('abort', cleanup, {once: true});
        unsubscribe = onAuthStateChanged(auth, user => {if (user?.uid !== uid) cleanup();});
        if (disposed) unsubscribe?.();
        if (!current()) cleanup(); else focus();
    });
}
