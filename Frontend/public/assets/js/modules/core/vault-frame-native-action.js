import {createElement} from '../../dom-utils.js';
import {t} from '../../translations.js';

// A new explicit click after the fresh proof preserves native share activation.
// The consumed authorization remains local, single-use and bounded by its expiry.
export function executeFrameNativeAction(target, action, {vaultFrameClient, confirmFrameAction}, presentation) {
  if (presentation) {
    if (presentation.kind !== 'contact' || typeof presentation.connect !== 'function') throw TypeError('INVALID_NATIVE_PRESENTATION');
    return connectContactAction(target, action, {vaultFrameClient, confirmFrameAction}, presentation);
  }
  if (!vaultFrameClient.isChild()) return action();
  return (async () => {
    const {snapshotBytes, ...scope} = target;
    let fingerprint;
    if (snapshotBytes) {
      const digest = await crypto.subtle.digest('SHA-256', snapshotBytes);
      fingerprint = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    }
    const check = await confirmFrameAction('backup-export', {...scope, fingerprint});
    return new Promise((resolve, reject) => {
      let done = false, timer, removeClear;
      const overlay = createElement('div', {className: 'modal-overlay active'});
      const cancel = createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: t('cancel')});
      const confirm = createElement('button', {type: 'button', className: 'btn-modal btn-primary', textContent: t('confirm')});
      const box = createElement('div', {className: 'modal-box', role: 'dialog', ariaModal: 'true'}, [
        createElement('h3', {className: 'modal-title', textContent: t('frame_export_ready')}),
        createElement('p', {className: 'modal-description', textContent: t('frame_export_action_hint')}), cancel, confirm]);
      overlay.append(box);
      box.addEventListener('keydown', event => {
        if (event.key === 'Escape') {event.preventDefault(); stop();}
        if (event.key === 'Tab') {event.preventDefault(); (document.activeElement === confirm ? cancel : confirm).focus();}
      });
      const cleanup = () => {
        clearTimeout(timer); removeClear?.(); overlay.remove();
        window.removeEventListener('pagehide', stop); document.removeEventListener('visibilitychange', visibility);
      };
      const stop = () => {if (done) return; done = true; cleanup(); resolve(undefined);};
      const visibility = () => {if (document.hidden) stop();};
      cancel.addEventListener('click', stop);
      confirm.addEventListener('click', event => {
        if (!event.isTrusted || done) return;
        try {
          check.assertLocal();
          if (Date.now() >= check.expiresAt) throw Error('FRAME_CONFIRMATION_REQUIRED');
          done = true; cleanup();
          // Do not add an await between this click and the native API.
          resolve(action());
        } catch (error) {done = true; cleanup(); reject(error);}
      });
      removeClear = vaultFrameClient.onClear(stop);
      window.addEventListener('pagehide', stop); document.addEventListener('visibilitychange', visibility);
      timer = setTimeout(stop, Math.max(0, check.expiresAt - Date.now()));
      document.body.append(overlay); confirm.focus();
    });
  })().catch(error => {
    if (error?.name === 'AbortError' || String(error?.message || '').startsWith('FRAME_')) return undefined;
    throw error;
  });
}

// The contact controller owns the only panel. Authorization and the final
// trusted launch stay here; these presentation callbacks never enter the target.
async function connectContactAction(target, action, {vaultFrameClient, confirmFrameAction}, presentation) {
  const {signal, connect} = presentation;
  if (signal?.aborted) return undefined;
  let check;
  try {
    if (vaultFrameClient.isChild()) {
      const {snapshotBytes, ...scope} = target;
      let fingerprint;
      if (snapshotBytes) {
        const digest = await crypto.subtle.digest('SHA-256', snapshotBytes);
        fingerprint = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      }
      if (signal?.aborted) return undefined;
      check = await confirmFrameAction('backup-export', {...scope, fingerprint});
      if (signal?.aborted) return undefined;
      check.assertLocal();
    }
    return await new Promise((resolve, reject) => {
      let done = false, timer, removeClear, disconnect;
      const cleanup = () => {
        clearTimeout(timer); removeClear?.(); disconnect?.();
        signal?.removeEventListener('abort', stop);
        window.removeEventListener('pagehide', stop); document.removeEventListener('visibilitychange', visibility);
      };
      const stop = () => {if (done) return; done = true; cleanup(); resolve(undefined);};
      const visibility = () => {if (document.hidden) stop();};
      const launch = (event, method) => {
        if (!(event instanceof Event) || event.type !== 'click' || !event.isTrusted || done || signal?.aborted || !['save', 'share', 'download'].includes(method)) return;
        try {
          check?.assertLocal();
          if (check && Date.now() >= check.expiresAt) throw Error('FRAME_CONFIRMATION_REQUIRED');
          done = true; cleanup();
          // Keep the native API inside this click. Expiry bounds authorization
          // before launch, not the duration of the OS picker already opened.
          resolve(action(method));
        } catch (error) {done = true; cleanup(); reject(error);}
      };
      signal?.addEventListener('abort', stop, {once: true});
      window.addEventListener('pagehide', stop); document.addEventListener('visibilitychange', visibility);
      removeClear = vaultFrameClient.onClear(stop);
      if (check) timer = setTimeout(stop, Math.max(0, check.expiresAt - Date.now()));
      try {
        if (signal?.aborted) {stop(); return;}
        disconnect = connect({launch, cancel: stop});
        if (done) disconnect?.();
      } catch (error) {done = true; cleanup(); reject(error);}
    });
  } catch (error) {
    if (error?.name === 'AbortError' || String(error?.message || '').startsWith('FRAME_')) return undefined;
    throw error;
  }
}
