import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [settings, setup, inactivity, security, webauthn, mfa, auth, login, settingsHtml, loginHtml, password, serviceWorker, firebaseConfig, vaultSession, env, components, homeHtml, packageJson] = await Promise.all([
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
    ,read('Frontend/public/assets/js/modules/core/vault-session.js')
    ,read('Frontend/public/assets/js/env.js')
    ,read('Frontend/public/assets/js/components.js')
    ,read('Frontend/public/home_page.html')
    ,read('package.json')
]);

const configuredVersion = env.match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1];
assert.equal(configuredVersion, `v${JSON.parse(packageJson).version}`, 'La versione UI non coincide con package.json');
assert.match(homeHtml, /data-app-version/, 'La home non usa la versione applicativa centrale');
assert.match(homeHtml, /data-app-version>v1\.1\.3</, 'La home non mostra una versione di fallback durante l’aggiornamento cache');
assert.match(homeHtml, /\.app-version-badge \{ display: none !important; \}/, 'Il vecchio badge header non è neutralizzato durante l’aggiornamento cache');
assert.match(homeHtml, /main\.js\?v=1\.1\.3/, 'La home non forza il caricamento della release corrente');
assert.match(homeHtml, /data-i18n="ready"/, 'La home può restare invisibile se il bootstrap JavaScript fallisce');
assert.doesNotMatch(homeHtml, /app-version-label">V8\.0/, 'La home contiene ancora la vecchia versione hardcoded');
assert.doesNotMatch(components, /app-version-badge/, 'La versione è ancora visualizzata nell’header');
assert.match(components, /dataset\.appVersion = APP_VERSION/, 'La versione non viene propagata al documento di ogni pagina');

assert.match(security, /restoreVaultSession\(uid\)/, 'La chiave Vault non viene ripristinata tra le pagine');
assert.match(security, /saveVaultSession\(_masterKey, uid\)/, 'Lo sblocco Vault non viene conservato nella sessione');
assert.match(inactivity, /getVaultSessionExpiry\(\)/, 'Il timeout non verifica la scadenza condivisa tra pagine');
assert.match(inactivity, /if \(!expired\) startMonitoring\(\)/, 'La nuova pagina resetta il timer prima di verificarne la scadenza');
assert.match(vaultSession, /AES-GCM/, 'Il segreto della sessione Vault non è cifrato');
assert.doesNotMatch(vaultSession, /indexedDB/, 'La sessione Vault dipende ancora da CryptoKey in IndexedDB');
assert.match(vaultSession, /crypto\.subtle\.importKey\('raw'/, 'La chiave di sessione compatibile non viene importata con Web Crypto');
assert.doesNotMatch(vaultSession, /localStorage\.getItem\(WRAPPING_KEY\)|localStorage\.setItem\(WRAPPING_KEY/, 'La chiave di sessione non deve persistere dopo la chiusura della scheda');
assert.match(vaultSession, /sessionStorage\.removeItem\(WRAPPING_KEY\)/, 'Blocco e logout non eliminano la chiave di sessione');
assert.match(security, /if \(_unlockPromise && !forceReload\) return _unlockPromise/, 'Le richieste concorrenti possono ancora aprire più sblocchi');
assert.match(serviceWorker, /modules\/core\/vault-session\.js/, 'Il supporto sessione Vault non è disponibile offline');
assert.match(serviceWorker, /url\.pathname\.endsWith\('\.js'\).*url\.pathname\.endsWith\('\.css'\)/s, 'Gli asset applicativi non usano una strategia network-first coerente');
assert.match(serviceWorker, /caches\.match\(event\.request, \{ ignoreSearch: true \}\)/, 'Il fallback PWA non recupera asset con query-versione differenti');
assert.match(serviceWorker, /assets\/css\/home_page\.css\?v=5\.0/, 'Lo stile della home non è precaricato per l’avvio PWA');
assert.match(serviceWorker, /assets\/css\/accesso\.css\?v=5\.0/, 'Lo stile del login non è precaricato per l’avvio PWA');
assert.match(loginHtml, /main\.js\?v=1\.1\.3/, 'Il login non forza la release JavaScript corrente');
assert.match(loginHtml, /data-i18n="ready"/, 'Il login può restare invisibile se il bootstrap JavaScript fallisce');

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

console.log('Audit sicurezza e offline: 48 controlli superati.');
