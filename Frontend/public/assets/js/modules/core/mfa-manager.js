import { auth, functions, enableAppCheck } from '../../firebase-config.js?v=1.2.39';
import {
    multiFactor,
    TotpMultiFactorGenerator
} from "/assets/js/vendor/firebase-runtime.js";
import { httpsCallable } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren } from '../../dom-utils.js';
import { ensureQRCodeLib, renderQRCode } from '../shared/qr_code_utils.js';

export function getTotpEnrollment(user = auth.currentUser) {
    if (!user) return null;
    return multiFactor(user).enrolledFactors.find(
        factor => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID
    ) || null;
}

function requestEnrollmentCode(qrUri, secretKey) {
    return new Promise(async (resolve) => {
        const qrTarget = createElement('div', { className: 'mfa-qr', id: 'mfa-qr-target' });
        const codeInput = createElement('input', {
            className: 'input',
            id: 'mfa-enrollment-code',
            type: 'text',
            inputMode: 'numeric',
            autoComplete: 'one-time-code',
            maxLength: 6,
            placeholder: '000000'
        });
        const modal = createElement('div', { className: 'modal-overlay active', id: 'mfa-enrollment-modal' });

        const finish = (value) => {
            modal.remove();
            resolve(value);
        };

        const card = createElement('div', { className: 'modal-box' }, [
            createElement('h3', { className: 'modal-title', textContent: 'Configura app Authenticator' }),
            createElement('p', { className: 'modal-text', textContent: 'Scansiona il QR con Google Authenticator, Microsoft Authenticator, Password di Apple o un’altra app TOTP.' }),
            qrTarget,
            createElement('p', { className: 'mfa-secret-label', textContent: 'Chiave manuale' }),
            createElement('code', { className: 'mfa-secret', textContent: secretKey }),
            createElement('label', { className: 'label', htmlFor: 'mfa-enrollment-code', textContent: 'Codice di verifica' }),
            codeInput,
            createElement('div', { className: 'modal-actions' }, [
                createElement('button', { className: 'btn-modal btn-secondary', textContent: 'Annulla', onclick: () => finish(null) }),
                createElement('button', {
                    className: 'btn-modal btn-primary',
                    textContent: 'Attiva 2FA',
                    onclick: () => {
                        const code = codeInput.value.trim();
                        if (/^\d{6}$/.test(code)) finish(code);
                        else codeInput.setCustomValidity('Inserisci 6 cifre');
                    }
                })
            ])
        ]);

        setChildren(modal, card);
        document.body.appendChild(modal);
        await ensureQRCodeLib();
        renderQRCode(qrTarget, qrUri, { width: 210, height: 210, colorDark: '#000000', colorLight: '#ffffff', correctLevel: 2 });
        codeInput.focus();
    });
}

export async function enrollTotp(user = auth.currentUser) {
    if (!user) throw new Error('Utente non autenticato.');
    if (!user.emailVerified) throw new Error('Verifica prima il tuo indirizzo email.');
    if (getTotpEnrollment(user)) return true;

    const session = await multiFactor(user).getSession();
    const secret = await TotpMultiFactorGenerator.generateSecret(session);
    const qrUri = secret.generateQrCodeUrl(user.email, 'Codici & Password');
    const code = await requestEnrollmentCode(qrUri, secret.secretKey);
    if (!code) return false;

    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
    await multiFactor(user).enroll(assertion, 'App Authenticator');
    await user.getIdToken(true);
    return true;
}

export async function unenrollTotp(user = auth.currentUser) {
    if (!user) throw new Error('Utente non autenticato.');
    const enrollment = getTotpEnrollment(user);
    if (!enrollment) return true;
    await multiFactor(user).unenroll(enrollment);
    return true;
}

export async function createRecoveryCodes() {
    const result = await httpsCallable(functions, 'createMfaRecoveryCodes')();
    return result.data?.codes || [];
}

export async function recoverTotpAccess(email, password, recoveryCode) {
    // Il login mantiene App Check lazy per evitare regressioni all'avvio; viene
    // attivato solo quando l'utente richiede questa funzione server sensibile.
    enableAppCheck();
    await httpsCallable(functions, 'recoverMfaWithCode')({ email, password, recoveryCode });
    return true;
}

export async function revokeAllSessions() {
    await httpsCallable(functions, 'revokeAllSessions')();
    return true;
}
