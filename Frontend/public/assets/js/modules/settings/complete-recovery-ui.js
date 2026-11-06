import {createElement, setChildren} from '../../dom-utils.js';
import {t, tf} from '../../translations.js';
import {evaluatePassword} from '../core/password-policy.js';
import {prepareCompleteRecovery, releaseCompleteRecovery} from './full-recovery-service.js';
import {executeCompleteRecovery} from './complete-recovery-client.js';
import {COMPLETE_RECOVERY_ENABLED, COMPLETE_RECOVERY_REAUTH_PATH} from './complete-recovery-config.js';

// Counts-only UI. Credentials/file material remain transient; the separately
// injected locator is the sole persistence interface, limited to technical IDs.
export function mountCompleteRecoveryUi({root, uid, invoke, getCurrentUid, subscribeToAuth, locator,
    enabled = COMPLETE_RECOVERY_ENABLED, signal, isActive = () => true,
    discoverOperation,
    prepare = prepareCompleteRecovery, execute = executeCompleteRecovery, release = releaseCompleteRecovery,
    translate = t, format = tf} = {}) {
    if (enabled !== true) return {dispose() {}};
    if (!root || !uid || typeof invoke !== 'function' || typeof getCurrentUid !== 'function') throw new Error('RECOVERY_UI_NOT_CONFIGURED');
    let alive = true, busy = false, completed = false, plan = null, master = '', controller = null, closeDialog = null, unsubscribe = () => {};
    let pendingMayWrite = false, abortedOperationId = null, homeLink = null;
    const t = translate; const tf = format;
    const status = createElement('p', {role: 'status', 'aria-live': 'polite', className: 'modal-text', tabIndex: -1});
    const file = createElement('input', {id: 'complete-recovery-file', type: 'file', accept: '.cpbackup,application/x-codici-password-backup', required: true, className: 'glass-field modal-input-glass'});
    const key = createElement('input', {id: 'complete-recovery-key', type: 'password', autocomplete: 'off', required: true, className: 'glass-field modal-input-glass', spellcheck: false});
    const password = createElement('input', {id: 'complete-recovery-password', type: 'password', autocomplete: 'new-password', required: true, className: 'glass-field modal-input-glass'});
    const repeated = createElement('input', {id: 'complete-recovery-repeat', type: 'password', autocomplete: 'new-password', required: true, className: 'glass-field modal-input-glass'});
    const verify = createElement('button', {type: 'submit', className: 'btn-modal btn-primary', textContent: t('recovery_verify')});
    const cancel = createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: t('cancel')});
    const clearFields = () => { key.value = ''; password.value = ''; repeated.value = ''; file.value = ''; master = ''; };
    const active = () => alive && !signal?.aborted && getCurrentUid() === uid && isActive();
    const check = () => { if (!active()) { dispose(); throw new Error('RECOVERY_SESSION_INVALIDATED'); } };
    const clearPlan = () => { if (plan) release(plan); plan = null; };
    const controls = disabled => { for (const input of [file, key, password, repeated, verify]) input.disabled = disabled; };
    const showStatus = message => { if (alive) { status.textContent = message; status.focus(); } };
    function dispose() {
        if (!alive) return;
        alive = false; controller?.abort(); clearFields(); clearPlan(); closeDialog?.(false); closeDialog = null; abortedOperationId = null;
        unsubscribe(); signal?.removeEventListener('abort', dispose);
        globalThis.removeEventListener?.('vault-session-locked', dispose);
        globalThis.removeEventListener?.('pagehide', dispose);
        controls(true); cancel.disabled = true; status.textContent = t('recovery_locked');
    }
    const askConfirmation = ({title, message, counts, acknowledge = false, startKey = 'recovery_start'}) => new Promise(resolve => {
        if (!active()) return resolve(false);
        let settled = false;
        const previous = document.activeElement;
        const accept = createElement('button', {type: 'button', className: 'btn-modal btn-primary', textContent: t(startKey), disabled: acknowledge});
        const reject = createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: t('cancel')});
        const finish = accepted => {
            if (settled) return; settled = true; modal.remove(); closeDialog = null;
            if (active() && previous?.isConnected) previous.focus(); resolve(accepted === true);
        };
        accept.addEventListener('click', () => { if (active() && !accept.disabled) finish(true); });
        reject.addEventListener('click', () => finish(false));
        const items = [createElement('h2', {id: 'complete-recovery-confirm-title', className: 'modal-title', textContent: title}),
            createElement('p', {className: 'modal-text', textContent: message}),
            createElement('p', {className: 'modal-text complete-recovery-counts', textContent: counts})];
        if (acknowledge) {
            const checkbox = createElement('input', {type: 'checkbox'});
            checkbox.addEventListener('change', () => { accept.disabled = !checkbox.checked; });
            items.push(createElement('label', {className: 'backup-key-confirmation'}, [checkbox,
                createElement('span', {textContent: t('recovery_acknowledge')})]));
        }
        items.push(createElement('div', {className: 'modal-actions'}, [reject, accept]));
        const modal = createElement('div', {className: 'modal-overlay active'}, [createElement('section', {
            className: 'modal-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'complete-recovery-confirm-title'}, items)]);
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); finish(false); }
            if (event.key === 'Tab') {
                const focusable = [...modal.querySelectorAll('button,input')].filter(node => !node.disabled);
                const next = event.shiftKey ? focusable.at(-1) : focusable[0];
                if ((event.shiftKey && document.activeElement === focusable[0]) || (!event.shiftKey && document.activeElement === focusable.at(-1))) {
                    event.preventDefault(); next?.focus();
                }
            }
        });
        closeDialog = finish; document.body.appendChild(modal); reject.focus();
    });
    const countsText = counts => {
        const summary = tf('recovery_counts', {records: counts.records, assets: counts.assets});
        return Number.isSafeInteger(counts.externalReferences) && counts.externalReferences > 0 ?
            `${summary}\n${tf('recovery_external_notice', {count: counts.externalReferences})}` : summary;
    };
    const errorText = (error, uncertain) => {
        const code = error?.code || error?.message;
        if (['RECOVERY_TRANSPORT_CAPACITY_EXCEEDED', 'FULL_RECOVERY_TRANSPORT_CAPACITY_EXCEEDED'].includes(code)) return t('recovery_transport_capacity');
        if (code === 'RECOVERY_COMPLETED_PASSWORD_MISMATCH') return t('recovery_completed_mismatch');
        if (code === 'RECOVERY_PLAN_REPREVIEW_REQUIRED') return t('recovery_expired_declined');
        if (code === 'RECOVERY_LOCATOR_UNAVAILABLE') return t('recovery_storage_unavailable');
        if (code === 'RECOVERY_RESUME_LOOKUP_FAILED') return t('recovery_resume_lookup_failed');
        if (['FULL_RECOVERY_RECENT_AUTH_REQUIRED', 'RECOVERY_ASSET_RECENT_AUTH_REQUIRED'].includes(code)) return t('recovery_reauth_needed');
        if (['FULL_RECOVERY_TARGET_NONEMPTY', 'FULL_RECOVERY_STORAGE_NONEMPTY'].includes(code) || /NOT_EMPTY/.test(code || '')) return t('recovery_target_not_empty');
        if (uncertain) return t('recovery_unconfirmed');
        if (/OWNER/.test(code || '')) return t('recovery_owner_mismatch');
        return t('recovery_invalid_backup');
    };
    const form = createElement('form', {className: 'modal-box complete-recovery-form', 'aria-label': t('recovery_title')}, [
        createElement('h1', {className: 'modal-title', textContent: t('recovery_title')}),
        createElement('p', {className: 'modal-text', textContent: t('recovery_intro')}),
        createElement('p', {className: 'modal-text', textContent: t('recovery_key_warning')}),
        ...[[file, 'recovery_file'], [key, 'recovery_key'], [password, 'recovery_new_password'], [repeated, 'recovery_repeat_password']]
            .flatMap(([input, label]) => [createElement('label', {htmlFor: input.id, textContent: t(label)}), input]),
        createElement('p', {className: 'modal-text', textContent: t('recovery_password_rules')}), status,
        createElement('div', {className: 'modal-actions'}, [cancel, verify])
    ]);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !active()) return;
        let selected = file.files?.[0];
        if (!selected || !key.value) { showStatus(t('recovery_missing')); return; }
        if (!evaluatePassword(password.value, 'master').valid) { showStatus(t('recovery_password_rules')); return; }
        if (password.value !== repeated.value) { showStatus(t('recovery_password_mismatch')); return; }
        busy = true; completed = false; pendingMayWrite = false; homeLink?.remove(); homeLink = null; controls(true); controller = new AbortController();
        const currentController = controller;
        try {
            master = password.value; showStatus(t('recovery_working'));
            const preparation = prepare(selected, uid, key.value, {signal: currentController.signal, getCurrentUid,
                isActive: () => active() && !currentController.signal.aborted});
            selected = null;
            key.value = ''; password.value = ''; repeated.value = '';
            const candidate = await preparation;
            if (!active() || currentController.signal.aborted) { release(candidate); check(); return; }
            plan = candidate; check(); file.value = '';
            const previous = locator?.load();
            if (previous && (previous.backupId !== plan.backupId || previous.contentDigest !== plan.contentDigest)) {
                showStatus(t('recovery_resume_mismatch')); return;
            }
            const discovered = await discoverOperation?.(); check();
            if (currentController.signal.aborted) return;
            if (previous && discovered && previous.operationId !== discovered.operationId) {
                showStatus(t('recovery_resume_mismatch')); return;
            }
            const accepted = await askConfirmation({title: t('recovery_confirm_title'), message: t('recovery_confirm_warning'),
                counts: countsText(plan.counts), acknowledge: true}); check();
            if (!accepted || currentController.signal.aborted) { showStatus(t('recovery_cancelled')); return; }
            const ownedPlan = plan; plan = null;
            // Only a coordinator-confirmed terminal abort can retire this exact
            // discovered ID, and only after a new manual preview confirmation.
            const operationId = previous?.operationId || (discovered?.operationId === abortedOperationId ? undefined : discovered?.operationId);
            const pending = execute(ownedPlan, master, {uid, getCurrentUid, signal: currentController.signal,
                isActive: () => active() && !currentController.signal.aborted, operationId,
                confirmation: 'RECOVER_EMPTY_VAULT',
                invoke: data => { check(); pendingMayWrite = true; return invoke(data); },
                rememberOperation: value => { check(); locator.remember(value); },
                clearRememberedOperation: value => { check(); locator.clear(value); },
                onProgress: progress => {
                    check(); showStatus(tf(progress.phase === 'assets' ? 'recovery_progress_assets' : 'recovery_progress_records', progress));
                },
                confirmExpiredPlan: async counts => {
                    check(); const accepted = await askConfirmation({title: t('recovery_expired_title'), message: t('recovery_expired_body'),
                        counts: countsText({records: counts.recordCount, assets: counts.assetCount}), startKey: 'recovery_expired_accept'});
                    check(); return accepted;
                }});
            master = ''; showStatus(t('recovery_working'));
            const result = await pending; check(); if (currentController.signal.aborted) return;
            if (result?.status === 'not-started') {
                abortedOperationId = result.operationId;
                pendingMayWrite = false;
                const restriction = ['FULL_RECOVERY_TARGET_NONEMPTY', 'FULL_RECOVERY_STORAGE_NONEMPTY'].includes(result.reason) ? ` ${t('recovery_target_not_empty')}` : '';
                showStatus(`${t('recovery_not_started')}${restriction}`);
                return;
            }
            if (result?.status !== 'complete') throw new Error('RECOVERY_OPERATION_UNCONFIRMED');
            completed = true;
            showStatus(t(result.cleanupPending ? 'recovery_complete_cleanup_pending' : 'recovery_complete'));
            homeLink = createElement('a', {href: '/home_page.html', className: 'btn-modal btn-primary', textContent: t('recovery_home')});
            form.appendChild(homeLink);
        } catch (error) {
            if (active() && !currentController.signal.aborted) {
                showStatus(errorText(error, pendingMayWrite || error?.canResume === true));
                if (['FULL_RECOVERY_RECENT_AUTH_REQUIRED', 'RECOVERY_ASSET_RECENT_AUTH_REQUIRED'].includes(error?.code || error?.message)) {
                    form.appendChild(createElement('a', {href: COMPLETE_RECOVERY_REAUTH_PATH, className: 'btn-modal btn-secondary', textContent: t('recovery_reauthenticate')}));
                }
            }
        } finally {
            clearFields(); clearPlan(); closeDialog?.(false);
            if (controller === currentController) controller = null;
            busy = false; if (active()) controls(false);
        }
    });
    cancel.addEventListener('click', () => {
        if (!active()) return;
        if (completed && !busy) { clearFields(); return; }
        controller?.abort(); closeDialog?.(false); clearFields(); clearPlan();
        showStatus(t(pendingMayWrite ? 'recovery_unconfirmed' : 'recovery_cancelled'));
    });
    signal?.addEventListener('abort', dispose, {once: true});
    globalThis.addEventListener?.('vault-session-locked', dispose, {once: true});
    globalThis.addEventListener?.('pagehide', dispose, {once: true});
    if (typeof subscribeToAuth === 'function') unsubscribe = subscribeToAuth(user => { if (user?.uid !== uid) dispose(); });
    if (!alive) unsubscribe();
    if (locator?.load()) status.textContent = t('recovery_resume_notice');
    setChildren(root, [form]); if (!active()) dispose(); else file.focus();
    return {dispose};
}

export function promptCompleteRecoveryMasterPassword({signal, isActive = () => true, translate = t} = {}) {
    const t = translate;
    return new Promise(resolve => {
        if (signal?.aborted || !isActive()) return resolve(null);
        let settled = false;
        const previous = document.activeElement;
        const input = createElement('input', {type: 'password', autocomplete: 'current-password', required: true,
            className: 'glass-field modal-input-glass', 'aria-label': t('recovery_current_master')});
        const finish = value => {
            if (settled) return; settled = true; input.value = ''; modal.remove();
            signal?.removeEventListener('abort', cancel);
            globalThis.removeEventListener?.('vault-session-locked', cancel);
            globalThis.removeEventListener?.('pagehide', cancel);
            if (isActive() && previous?.isConnected) previous.focus();
            resolve(value);
        };
        const cancel = () => finish(null);
        const modal = createElement('div', {className: 'modal-overlay active'}, [createElement('form', {
            className: 'modal-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('recovery_current_master'),
            onsubmit: event => { event.preventDefault(); if (isActive() && !signal?.aborted) finish(input.value); else cancel(); }
        }, [createElement('h2', {className: 'modal-title', textContent: t('recovery_current_master')}),
            createElement('p', {className: 'modal-text', textContent: t('recovery_current_master_help')}), input,
            createElement('div', {className: 'modal-actions'}, [
                createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: t('cancel'), onclick: cancel}),
                createElement('button', {type: 'submit', className: 'btn-modal btn-primary', textContent: t('confirm')})])])]);
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); cancel(); }
            if (event.key === 'Tab') {
                const fields = [...modal.querySelectorAll('input,button')];
                if ((event.shiftKey && document.activeElement === fields[0]) || (!event.shiftKey && document.activeElement === fields.at(-1))) {
                    event.preventDefault(); (event.shiftKey ? fields.at(-1) : fields[0]).focus();
                }
            }
        });
        signal?.addEventListener('abort', cancel, {once: true});
        globalThis.addEventListener?.('vault-session-locked', cancel, {once: true});
        globalThis.addEventListener?.('pagehide', cancel, {once: true});
        document.body.appendChild(modal); input.focus();
    });
}
