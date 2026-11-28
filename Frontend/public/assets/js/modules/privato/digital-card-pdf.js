import {auth} from '../../firebase-config.js?v=1.2.299';
import {onAuthStateChanged} from '/assets/js/vendor/firebase-runtime.js';
import {isVaultUnlocked} from '../core/security-manager.js';
import {executeFrameNativeAction} from '../core/vault-frame-client.js';
import {createCompanyPdfActions} from '../azienda/pdf/company-summary-browser.js';
import {loadContactPhoto, encodeContactPhoto} from '../shared/contact-card-photo.js';
import {buildDigitalCardPdfModel, isCardPhotoSelected} from './digital-card-pdf-model.js';
import {createElement} from '../../dom-utils.js';
import {t} from '../../translations.js';

// PDF della Tessera digitale: generato sul dispositivo dai soli campi selezionati,
// mai salvato dall'app. Scarica e Condividi invocano l'API nativa nel loro clic,
// senza attese intermedie, come richiesto dall'attivazione utente di Safari.
export function mountDigitalCardPdf(root, {getSource, events = window, getUser = () => auth.currentUser,
    subscribeAuth = callback => onAuthStateChanged(auth, callback), isUnlocked = isVaultUnlocked,
    createActions = createCompanyPdfActions, loadPhoto = loadContactPhoto, encodePhoto = encodeContactPhoto,
    nativeAction = (bytes, action) => executeFrameNativeAction({scope: 'profile-pdf', snapshotBytes: bytes}, action)}) {
    const uid = getUser()?.uid, abort = new AbortController();
    let disposed = false, busy = false, bytes = null, unsubscribe = () => {};
    const prepare = createElement('button', {type: 'button', className: 'btn-upload-trigger', textContent: t('digital_card_pdf_prepare')});
    const save = createElement('button', {type: 'button', className: 'btn-upload-trigger', textContent: t('digital_card_pdf_download'), disabled: true});
    const send = createElement('button', {type: 'button', className: 'btn-upload-trigger', textContent: t('digital_card_pdf_share'), disabled: true});
    const status = createElement('p', {className: 'data-value-sub', role: 'status'});
    const host = createElement('section', {className: 'form-card digital-card-pdf', 'data-digital-card-pdf': 'true'}, [
        createElement('h2', {className: 'form-section-title', textContent: t('digital_card_pdf_title')}),
        createElement('p', {className: 'digital-card-warning', textContent: t('digital_card_pdf_description')}),
        createElement('div', {className: 'digital-card-actions'}, [prepare, save, send]),
        status
    ]);
    const clear = () => {bytes?.fill(0); bytes = null; save.disabled = send.disabled = true;};
    const dispose = () => {
        if (disposed) return; disposed = true; abort.abort(); unsubscribe(); actions.dispose(); clear(); host.remove();
    };
    const check = () => {
        if (disposed || abort.signal.aborted || !uid || getUser()?.uid !== uid) throw Error('CARD_PDF_SESSION_CHANGED');
        if (!isUnlocked()) {dispose(); throw Error('CARD_PDF_VAULT_LOCKED');}
    };
    const actions = createActions({assertActive: check, nativeAction, fileName: 'tessera-digitale.pdf',
        shareTitle: 'Tessera digitale', generatorName: 'generateDigitalCardPdf'});
    events.addEventListener('pagehide', dispose, {signal: abort.signal});
    events.addEventListener('private-auth-blocked', dispose, {signal: abort.signal});
    events.addEventListener('vault-session-locked', dispose, {signal: abort.signal});
    events.addEventListener('vault-state-changed', () => {if (!isUnlocked()) dispose();}, {signal: abort.signal});
    unsubscribe = subscribeAuth(user => {if (user?.uid !== uid) dispose();});

    const messageFor = error => ({
        CARD_PDF_EMPTY: 'digital_card_pdf_empty',
        CARD_PDF_PHOTO: 'digital_card_pdf_photo_error',
        PDF_UNSUPPORTED_CHARACTER: 'digital_card_pdf_unsupported'
    })[error?.message] || 'digital_card_pdf_error';

    prepare.addEventListener('click', () => {void (async () => {
        if (busy || disposed) return;
        busy = true; prepare.disabled = true; clear(); status.textContent = t('digital_card_pdf_preparing');
        let generated;
        try {
            check();
            const {userData, inclusions, options} = getSource();
            let photo = null;
            if (isCardPhotoSelected(userData, inclusions)) {
                try {photo = await encodePhoto(await loadPhoto(userData.photoURL));} catch {throw Error('CARD_PDF_PHOTO');}
                check();
            }
            const model = buildDigitalCardPdfModel(userData, inclusions, options, photo);
            generated = await actions.generate(model); check();
            if (!(generated instanceof Uint8Array) || !generated.length || generated.length > 10000000) throw Error('INVALID_PDF');
            bytes = generated; generated = null;
            save.disabled = false; send.disabled = !actions.canShare(bytes);
            status.textContent = t(send.disabled ? 'digital_card_pdf_ready_download' : 'digital_card_pdf_ready_share');
        } catch (error) {
            generated?.fill?.(0);
            if (!disposed) {clear(); status.textContent = t(messageFor(error));}
        } finally {
            busy = false; if (!disposed) prepare.disabled = false;
        }
    })();}, {signal: abort.signal});
    const act = action => {
        try {
            check(); if (!bytes) return;
            // Nessun await prima dell'API nativa: Safari richiede il gesto di questo clic.
            Promise.resolve(action(bytes)).catch(error => {
                if (!disposed) status.textContent = t(error?.name === 'AbortError' ? 'digital_card_pdf_share_cancelled' : 'digital_card_pdf_unavailable');
            });
        } catch {if (!disposed) status.textContent = t('digital_card_pdf_unavailable');}
    };
    save.addEventListener('click', () => act(actions.download), {signal: abort.signal});
    send.addEventListener('click', () => act(actions.share), {signal: abort.signal});
    if (!uid) {dispose(); return dispose;}
    root.append(host);
    return dispose;
}
