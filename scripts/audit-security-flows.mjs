import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [settings, setup, inactivity, security, webauthn, mfa, auth, login, settingsHtml, loginHtml, password, serviceWorker, firebaseConfig, vaultSession, env, components, homeHtml, packageJson, main] = await Promise.all([
    read('Frontend/public/assets/js/modules/settings/impostazioni.js'),
    read('Frontend/public/assets/js/modules/core/security-setup.js'),
    read('Frontend/public/assets/js/inactivity-timer.js'),
    read('Frontend/public/assets/js/modules/core/security-manager.js'),
    read('Frontend/public/assets/js/modules/core/webauthn-manager.js'),
    read('Frontend/public/assets/js/modules/core/mfa-manager.js'),
    read('Frontend/public/assets/js/auth.js'),
    read('Frontend/public/assets/js/modules/auth/login.js'),
    read('Frontend/public/impostazioni.html'),
    read('Frontend/public/login-v115.html'),
    read('Frontend/public/assets/js/modules/auth/imposta_nuova_password.js')
    ,read('Frontend/public/sw.js')
    ,read('Frontend/public/assets/js/firebase-config.js')
    ,read('Frontend/public/assets/js/modules/core/vault-session.js')
    ,read('Frontend/public/assets/js/env-v126.js')
    ,read('Frontend/public/assets/js/components-v129.js')
    ,read('Frontend/public/home_page.html')
    ,read('package.json')
    ,read('Frontend/public/assets/js/main-v129.js')
]);

const configuredVersion = env.match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1];
const passwordPolicy = await read('Frontend/public/assets/js/modules/core/password-policy.js');
const registration = await read('Frontend/public/assets/js/modules/auth/registrati.js');
const registrationHtml = await read('Frontend/public/registrati.html');
const firestoreRules = await read('firestore.rules');
const cloudFunctions = await read('functions/index.js');
assert.equal(configuredVersion, `v${JSON.parse(packageJson).version}`, 'La versione UI non coincide con package.json');
assert.match(serviceWorker, new RegExp(`CACHE_NAME = 'codex-shell-${configuredVersion}'`), 'La cache PWA non coincide con la versione applicativa');
assert.match(homeHtml, /data-app-version/, 'La home non usa la versione applicativa centrale');
assert.match(homeHtml, new RegExp(`data-app-version>${configuredVersion.replace(/\./g, '\\.') }<`), 'La home non mostra una versione di fallback coerente');
assert.match(homeHtml, /\.app-version-badge \{ display: none !important; \}/, 'Il vecchio badge header non è neutralizzato durante l’aggiornamento cache');
assert.match(homeHtml, /main-v129\.js/, 'La home non forza il caricamento della release corrente');
assert.match(homeHtml, /data-i18n="ready"/, 'La home può restare invisibile se il bootstrap JavaScript fallisce');
assert.match(homeHtml, /Object\.defineProperty\(root, 'textContent'/, 'La home non è protetta dai componenti rimasti nella vecchia cache');
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
assert.doesNotMatch(serviceWorker, /ignoreSearch:\s*true/, 'Il fallback PWA può mescolare release con query-versione differenti');
assert.match(serviceWorker, /assets\/css\/home_page\.css\?v=5\.0/, 'Lo stile della home non è precaricato per l’avvio PWA');
assert.match(serviceWorker, /assets\/css\/accesso\.css\?v=5\.0/, 'Lo stile del login non è precaricato per l’avvio PWA');
assert.match(loginHtml, /login-entry\.js\?v=1\.3\.2/, 'Il login non usa il bootstrap Auth dedicato');
assert.match(loginHtml, /<form id="login-form">/, 'Il campo password non è contenuto in un form semantico');
assert.match(loginHtml, /type="submit" id="login-submit-btn"/, 'Il pulsante Accedi non invia il form in modo nativo');
assert.doesNotMatch(loginHtml, /assets\/js\/main\.js/, 'Il login carica ancora il router completo dell’app privata');
assert.doesNotMatch(firebaseConfig, /const appCheck = initializeAppCheck/, 'App Check viene ancora avviato durante il login');
assert.match(firebaseConfig, /export function enableAppCheck/, 'App Check non è disponibile in modalità lazy');
assert.match(main, /firebaseRuntime\.enableAppCheck\?\.\(\)/, 'App Check lazy non è compatibile con una configurazione precedente in cache');
assert.match(main, /firebase-config\.js\?v=1\.1\.8/, 'Il bootstrap non bypassa la vecchia configurazione Firebase in cache');
assert.match(firebaseConfig, /getApps\(\)\.length \? getApp\(\)/, 'Firebase App non viene riutilizzata tra moduli versionati');
assert.match(firebaseConfig, /db = getFirestore\(app\)/, 'Firestore già inizializzato non viene riutilizzato');
assert.doesNotMatch(loginHtml, /caches\.keys|registration\?\.update/, 'Il login modifica ancora cache o Service Worker durante il caricamento');
assert.doesNotMatch(loginHtml, /serviceWorker|getRegistrations|unregister\(/, 'Il login esegue ancora operazioni PWA durante il caricamento');
assert.match(main, /const serviceWorkerEnabled = true/, 'Il Service Worker ricostruito non è stato riattivato');
assert.doesNotMatch(main, /controllerchange[\s\S]{0,300}window\.location\.reload/, 'Il Service Worker può ancora innescare un ciclo di ricaricamento');
assert.match(serviceWorker, /login-v115\.html/, 'La shell offline non usa il nuovo percorso di login');
assert.match(auth, /login-v115\.html/, 'I redirect Auth non usano il nuovo percorso di login');
assert.match(loginHtml, /data-i18n="ready"/, 'Il login può restare invisibile se il bootstrap JavaScript fallisce');

assert.match(passwordPolicy, /account:[\s\S]*minLength:\s*12/, 'La policy account non richiede almeno 12 caratteri');
assert.match(passwordPolicy, /master:[\s\S]*minLength:\s*16/, 'La policy Master Password non richiede almeno 16 caratteri');
assert.match(passwordPolicy, /lowercase:[\s\S]*uppercase:[\s\S]*number:[\s\S]*symbol:/, 'La policy non verifica minuscole, maiuscole, numeri e simboli');
assert.match(registration, /evaluatePassword\(password, 'account'\)/, 'La registrazione non applica la policy account centralizzata');
assert.match(password, /evaluatePassword\(newPassword, 'account'\)/, 'Cambio e reset password non applicano la policy account centralizzata');
assert.match(security, /evaluatePassword\(cleanPass, 'master'\)/, 'La prima Master Password non applica la policy dedicata');
assert.match(security, /CONFERMA MASTER PASSWORD/, 'La prima Master Password non richiede conferma');
assert.match(security, /if \(await isNewVault\(uid\)\)/, 'La policy Master Password può bloccare utenti Vault esistenti');
assert.match(registrationHtml, /id="account-password-requirements"/, 'La registrazione non mostra i requisiti password');
assert.doesNotMatch(registrationHtml, /user_login_trap|password_trap/, 'La registrazione ostacola i suggerimenti password del dispositivo');
assert.match(registrationHtml, /name="new-password"[^>]+autocomplete="new-password"/, 'Il password manager non riconosce la nuova password');
assert.match(password, /auth\/requires-recent-login[\s\S]+signOut\(auth\)[\s\S]+login-v115\.html\?reauth=password-change/, 'Il cambio password non avvia una riautenticazione reale');
assert.match(auth, /reauthFlow\s*===\s*['"]password-change['"][\s\S]+imposta_nuova_password\.html\?reauthenticated=1/, 'Il login non ritorna al cambio password dopo la riautenticazione');
assert.match(password, /isRequiredPolicyUpdate[\s\S]+cancelBtn\.textContent\s*=\s*['"]Esci['"][\s\S]+signOut\(auth\)/, 'L\'annullamento dell\'aggiornamento obbligatorio crea ancora un ciclo con la home');
assert.match(passwordPolicy, /crypto\.getRandomValues/, 'Il generatore password non usa casualità crittografica locale');
assert.match(registration, /generateSecurePassword\(\)/, 'La registrazione non offre una password sicura');
assert.match(password, /passwordPolicyVersion:\s*ACCOUNT_PASSWORD_POLICY_VERSION/, 'Il cambio password non registra la policy applicata');
assert.match(main, /passwordPolicyVersion[\s\S]*imposta_nuova_password\.html\?policyUpdate=1/, 'Gli account precedenti non vengono guidati nell\'aggiornamento una tantum');
assert.match(security, /suggestPassword:\s*true/, 'La prima Master Password non offre un suggerimento sicuro locale');

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
assert.match(serviceWorker, /cache\.put\(request, response\.clone\(\)\)/, 'Le pagine visitate non vengono conservate per navigazione offline');

assert.doesNotMatch(firestoreRules, /visibility[^\n]+==\s*['"]shared['"]/, 'La visibilità shared concede ancora accesso generico');
assert.doesNotMatch(firestoreRules, /allow\s+read,\s*update/, 'Un ospite può ancora modificare account altrui');
assert.match(firestoreRules, /request\.auth\.uid in resource\.data\.get\('sharedWithUids', \[\]\)/, 'La lettura condivisa non richiede un UID accettato');
assert.doesNotMatch(firestoreRules, /request\.query\.filters\.size/, 'Gli inviti accettano ancora una query con filtro arbitrario');
assert.match(firestoreRules, /allow update, delete: if isInviteOwner\(\)/, 'Il destinatario può modificare direttamente un invito');
assert.match(cloudFunctions, /exports\.respondToInvitation = onCall/, 'La risposta sicura agli inviti non è gestita dal server');
assert.match(cloudFunctions, /invite\.recipientEmail[\s\S]*!== email/, 'La funzione non verifica l’identità del destinatario');
assert.match(cloudFunctions, /sharedWithUids/, 'La funzione non registra gli UID autorizzati alla lettura');

console.log('Audit sicurezza e offline: 60 controlli superati.');
