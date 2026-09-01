import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [settings, setup, inactivity, security, webauthn, mfa, auth, login, settingsHtml, loginHtml, password, serviceWorker, firebaseConfig] = await Promise.all([
    read('Frontend/public/assets/js/modules/settings/impostazioni.js'),
    read('Frontend/public/assets/js/modules/core/security-setup.js'),
    read('Frontend/public/assets/js/inactivity-timer.js'),
    read('Frontend/public/assets/js/modules/core/security-manager.js'),
    read('Frontend/public/assets/js/modules/core/webauthn-manager.js'),
    read('Frontend/public/assets/js/modules/core/mfa-manager.js'),
    read('Frontend/public/assets/js/auth.js'),
    read('Frontend/public/assets/js/modules/auth/login.js'),
    read('Frontend/public/impostazioni.html'),
    read('Frontend/public/index.html'),
    read('Frontend/public/assets/js/modules/auth/imposta_nuova_password.js')
    ,read('Frontend/public/sw.js')
    ,read('Frontend/public/assets/js/firebase-config.js')
]);

assert.doesNotMatch(settings, /settings_2fa\s*:/, 'Il client non deve simulare enrollment 2FA');
assert.match(settings, /enrollTotp\(\)/, 'Il toggle 2FA non avvia un enrollment TOTP reale');
assert.match(mfa, /TotpMultiFactorGenerator\.assertionForEnrollment/, 'Enrollment TOTP Firebase mancante');
assert.match(auth, /getMultiFactorResolver/, 'Risoluzione login MFA mancante');
assert.match(auth, /browserSessionPersistence/, 'Persistenza di sessione non disponibile');
assert.match(auth, /browserLocalPersistence/, 'Persistenza ricordata non disponibile');
assert.match(login, /completeTotpLogin/, 'Secondo passaggio TOTP assente dalla pagina login');
assert.match(loginHtml, /autocomplete="one-time-code"/, 'Campo TOTP non predisposto per OTP/autofill');
assert.match(loginHtml, /id="remember-device"/, 'Scelta Ricordami assente');
assert.match(setup, /enableBiometricUnlock\(masterKey\)/, 'Onboarding biometrico senza registrazione WebAuthn');
assert.doesNotMatch(setup, /biometric_lock\s*:/, 'Campo biometrico legacy ancora scritto');
assert.match(setup, /settings_biometric\s*:/, 'Preferenza biometrica canonica mancante');
assert.doesNotMatch(inactivity, /disableVaultAutoUnlock|signOut/, 'L\'inattività non deve revocare la biometria o cambiare la sessione Auth');
assert.match(inactivity, /setTimeout\(lockVaultForInactivity, lockTimerMs\)/, 'Il timeout selezionato non governa il blocco Vault');
assert.match(security, /settings_biometric: false/, 'La rimozione biometrica non viene sincronizzata');
assert.match(webauthn, /capabilities\?\.\['extension:prf'\] === true/, 'La compatibilità biometrica deve verificare PRF in modo fail-closed');
assert.match(settingsHtml, /non la Master Password della Vault/, 'Il cambio password non distingue login e Vault');
assert.match(settingsHtml, /app Authenticator \(TOTP\)/, 'Lo stato reale della 2FA non è visibile');
assert.match(password, /Master Password della Vault non è cambiata/, 'Conferma cambio password ambigua');
assert.match(firebaseConfig, /persistentLocalCache/, 'Cache Firestore persistente mancante');
assert.match(serviceWorker, /cache\.put\(event\.request, copy\)/, 'Le pagine visitate non vengono conservate per navigazione offline');

console.log('Audit sicurezza e offline: 22 controlli superati.');
