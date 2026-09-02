import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

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
const storageRules = await read('storage.rules');
const firebaseJson = JSON.parse(await read('firebase.json'));
const deployWorkflow = await read('.github/workflows/firebase-deploy.yml');
const cloudFunctions = await read('functions/index.js');
const manifest = JSON.parse(await read('Frontend/public/manifest.json'));
const resetPasswordModule = await read('Frontend/public/assets/js/modules/auth/reset_password.js');
const pushManager = await read('Frontend/public/assets/js/modules/shared/push-manager.js');
const cryptoUtils = await read('Frontend/public/assets/js/modules/core/crypto-utils.js');
const coreUi = await read('Frontend/public/assets/js/ui-core-v129.js');
const attachmentSecurity = await read('Frontend/public/assets/js/modules/shared/attachment-security.js');
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
assert.doesNotMatch(security, /LEGACY_STORAGE_KEY|atob\(storedSecret\)|getItem\(['"]codex_vault_secret['"]\)/, 'Il vecchio segreto locale può ancora essere letto o decodificato');
assert.match(security, /removeItem\(['"]codex_vault_secret['"]\)/, 'Il vecchio segreto locale non viene eliminato in modo fail-closed');
assert.match(security, /scopedValue[\s\S]+!scopedValue\.startsWith\(['"]\{['"]\)[\s\S]+removeItem\(scopedKey\)/, 'Un contenitore UID nel vecchio formato non viene eliminato');
assert.match(webauthn, /capabilities\?\.\['extension:prf'\] === true/, 'La compatibilità biometrica deve verificare PRF in modo fail-closed');
assert.match(webauthn, /credentialRpId && credentialRpId !== rpId/, 'Lo sblocco WebAuthn non verifica il RP ID registrato');
assert.match(security, /rpId: setup\.rpId/, 'Il contenitore biometrico non conserva il RP ID');
assert.match(settingsHtml, /non la Master Password della Vault/, 'Il cambio password non distingue login e Vault');
assert.match(settingsHtml, /app Authenticator \(TOTP\)/, 'Lo stato reale della 2FA non è visibile');
assert.match(password, /Master Password della Vault non è cambiata/, 'Conferma cambio password ambigua');
assert.match(firebaseConfig, /persistentLocalCache/, 'Cache Firestore persistente mancante');
assert.match(firebaseConfig, /firebaseapp\.com[\s\S]*?location\.replace[\s\S]*?CANONICAL_HOST/, 'Il dominio Firebase alternativo non viene ricondotto all origin canonico');
assert.match(serviceWorker, /cache\.put\(request, response\.clone\(\)\)/, 'Le pagine visitate non vengono conservate per navigazione offline');

assert.doesNotMatch(firestoreRules, /visibility[^\n]+==\s*['"]shared['"]/, 'La visibilità shared concede ancora accesso generico');
assert.doesNotMatch(firestoreRules, /allow\s+read,\s*update/, 'Un ospite può ancora modificare account altrui');
assert.match(firestoreRules, /request\.auth\.uid in resource\.data\.get\('sharedWithUids', \[\]\)/, 'La lettura condivisa non richiede un UID accettato');
assert.doesNotMatch(firestoreRules, /request\.query\.filters\.size/, 'Gli inviti accettano ancora una query con filtro arbitrario');
assert.match(firestoreRules, /allow update, delete: if isInviteOwner\(\)/, 'Il destinatario può modificare direttamente un invito');
assert.match(cloudFunctions, /exports\.respondToInvitation = onCall/, 'La risposta sicura agli inviti non è gestita dal server');
assert.match(cloudFunctions, /invite\.recipientEmail[\s\S]*!== email/, 'La funzione non verifica l’identità del destinatario');
assert.match(cloudFunctions, /sharedWithUids/, 'La funzione non registra gli UID autorizzati alla lettura');
assert.ok(manifest.icons.some(icon => icon.src.endsWith('app-icon-192.png') && icon.sizes === '192x192' && icon.type === 'image/png'), 'Manifest privo dell\'icona PNG 192x192');
assert.ok(manifest.icons.some(icon => icon.src.endsWith('app-icon-512.png') && icon.sizes === '512x512' && icon.type === 'image/png'), 'Manifest privo dell\'icona PNG 512x512');
assert.ok(manifest.icons.some(icon => icon.src.endsWith('app-icon-maskable-512.png') && icon.purpose === 'maskable'), 'Manifest privo della variante maskable');
assert.match(homeHtml, /apple-touch-icon-180\.png/, 'La home non usa l\'icona Apple dedicata');
assert.match(serviceWorker, /app-icon-maskable-512\.png/, 'La variante maskable non è disponibile nella shell offline');

const publicHtmlNames = (await readdir(new URL('../Frontend/public/', import.meta.url))).filter(name => name.endsWith('.html'));
const publicHtmlFiles = await Promise.all(publicHtmlNames.map(name => read(`Frontend/public/${name}`)));
assert.ok(publicHtmlFiles.every(html => /name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/.test(html)), 'Le pagine non condividono la viewport responsive canonica');
assert.ok(publicHtmlFiles.every(html => !/user-scalable=no|maximum-scale=1/.test(html)), 'Una pagina impedisce ancora lo zoom');
assert.ok(publicHtmlFiles.every(html => /name="mobile-web-app-capable"/.test(html) && /name="apple-mobile-web-app-capable"/.test(html)), 'Metadati PWA non uniformi tra le pagine');
assert.equal(manifest.orientation, 'any', 'La PWA forza ancora un orientamento specifico');
const cssNames = (await readdir(new URL('../Frontend/public/assets/css/', import.meta.url))).filter(name => name.endsWith('.css'));
const cssFiles = await Promise.all(cssNames.map(name => read(`Frontend/public/assets/css/${name}`)));
assert.ok(cssFiles.every(css => !/@media \((?:max-width:\s*(?:480|640)|min-width:\s*(?:481|640))px\)/.test(css)), 'Breakpoint responsive legacy ancora presente');
assert.match(await read('Frontend/public/assets/css/core_fascie.css'), /\.btn-icon-header\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/, 'Controlli header sotto la dimensione tattile minima');
const coreCss = await read('Frontend/public/assets/css/core.css');
const pagesCss = await read('Frontend/public/assets/css/core_pagine.css');
const settingsCss = await read('Frontend/public/assets/css/impostazioni.css');
assert.match(coreCss, /\.base-container\s*\{[\s\S]*?max-width:\s*75rem;/, 'Il desktop resta limitato alla vecchia larghezza mobile-first');
assert.match(pagesCss, /@media \(min-width:\s*1025px\)[\s\S]*?\.home-page \.matrix-grid[\s\S]*?"scadenze urgenze"/, 'La Home desktop non usa una matrice bilanciata');
assert.match(settingsCss, /\.settings-container\s*\{[\s\S]*?max-width:\s*760px;/, 'Le impostazioni restano eccessivamente strette su desktop');
assert.match(await read('Frontend/public/assets/css/account_privati.css'), /@media \(min-width:\s*1025px\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/, 'La lista account privati non sfrutta il desktop');
assert.doesNotMatch(await read('Frontend/public/assets/js/ui-core-v129.js'), /autocomplete:\s*['"]current-password['"]/, 'Il popup Vault viene ancora associato alla password di login');
assert.match(await read('Frontend/public/assets/js/ui-core-v129.js'), /options\.vaultSecret[\s\S]*?data-form-type[\s\S]*?data-1p-ignore/, 'La Master Password non è esclusa dai password manager');
assert.match(security, /vaultSecret:\s*true/, 'Lo sblocco Vault non identifica il campo come segreto locale');
assert.match(await read('Frontend/public/assets/css/core_fascie.css'), /@media \(max-width:\s*600px\)[\s\S]*?\.base-header,[\s\S]*?backdrop-filter:\s*none;[\s\S]*?mask-image:\s*none;/, 'Le fasce mobili usano ancora la composizione che causa sfarfallio');
assert.match(auth, /async function resetPassword\(email\)[\s\S]*?await sendPasswordResetEmail\(auth, email\);[\s\S]*?return true;/, 'Il reset password non propaga correttamente gli errori Firebase');
assert.doesNotMatch(auth, /async function resetPassword\(email\)\s*\{\s*try\s*\{/, 'Il reset password intercetta ancora gli errori prima della UI');
assert.match(password, /verifyPasswordResetCode[\s\S]*?codex_password_reset_policy_v1/, 'Il reset completato non prepara la sincronizzazione della policy');
assert.match(auth, /consumePasswordResetPolicyMarker\(updatedUser\)/, 'Il login non completa la policy dopo un reset password');
assert.match(resetPasswordModule, /auth\/network-request-failed[\s\S]*?Connessione assente/, 'Il recupero password non distingue un errore di rete reale');
assert.match(settings, /auth\/user-token-expired[\s\S]*?requireSecurityReauthentication/, 'La disattivazione 2FA non gestisce il token scaduto');
assert.match(auth, /reauthFlow === 'security-settings'[\s\S]*?impostazioni\.html/, 'La riautenticazione 2FA non torna alle Impostazioni');
assert.match(pushManager, /getToken\(messaging[\s\S]*?serviceWorkerRegistration/, 'La correzione sicurezza ha rimosso la registrazione push');
assert.match(serviceWorker, /onBackgroundMessage[\s\S]*?eventType !== 'deadline'/, 'La correzione sicurezza ha alterato le notifiche push di scadenza');

assert.match(cloudFunctions, /exports\.createMfaRecoveryCodes = onCall/, 'Generazione server dei codici recupero 2FA mancante');
assert.match(cloudFunctions, /exports\.recoverMfaWithCode = onCall/, 'Recupero 2FA server mancante');
assert.match(cloudFunctions, /mfaRecoveryAttempts[\s\S]*?nextRecoveryAttemptState/, 'Il recupero MFA non applica un limite server');
assert.match(cloudFunctions, /runTransaction[\s\S]*?remainingHashes/, 'Il recovery code non viene consumato atomicamente');
assert.match(cloudFunctions, /updateUser\(user\.uid, \{ multiFactor: \{ enrolledFactors: null \} \}\)/, 'Il recupero non rimuove realmente il fattore Firebase');
assert.match(cloudFunctions, /revokeRefreshTokens\(user\.uid\)/, 'Il recupero 2FA non revoca le sessioni esistenti');
assert.match(firestoreRules, /match \/mfaRecovery\/\{userId\}[\s\S]*?allow read, write: if false;/, 'I codici recupero sono accessibili direttamente dal client');
assert.match(firestoreRules, /match \/mfaRecoveryAttempts\/\{attemptId\}[\s\S]*?allow read, write: if false;/, 'I contatori recupero sono accessibili direttamente dal client');
assert.equal(firebaseJson.storage?.rules, 'storage.rules', 'Le regole Storage non sono collegate a firebase.json');
assert.match(storageRules, /match \/users\/\{userId\}\/\{allPaths=\*\*\}/, 'Storage non confina gli oggetti nello spazio UID');
assert.match(storageRules, /request\.auth\.uid == userId/, 'Storage non verifica la proprietà tramite UID');
assert.match(storageRules, /request\.resource\.size <= 25 \* 1024 \* 1024/, 'Storage non impone il limite di 25 MB');
assert.match(storageRules, /request\.resource\.contentType\.matches/, 'Storage non applica una allowlist dei MIME type');
assert.match(attachmentSecurity, /MAX_ATTACHMENT_BYTES = 25 \* 1024 \* 1024/, 'Il client non applica lo stesso limite Storage');
assert.match(attachmentSecurity, /\['https:', 'http:'\]/, 'Gli URL esterni non usano una allowlist di protocolli');
assert.match(attachmentSecurity, /noopener,noreferrer/, 'Le nuove schede possono controllare la pagina di origine');
assert.match(attachmentSecurity, /export async function encryptAttachmentFile/, 'Gli allegati nuovi non dispongono di cifratura client');
assert.match(attachmentSecurity, /additionalData: ATTACHMENT_AAD/, 'La cifratura allegati non autentica il contesto del formato');
assert.match(attachmentSecurity, /crypto\.getRandomValues\(new Uint8Array\(32\)\)/, 'La chiave casuale per-file degli allegati non è presente');
assert.match(attachmentSecurity, /HKDF[\s\S]*?SHA-256/, 'La chiave per-file non è protetta con derivazione HKDF');
assert.match(storageRules, /application\/octet-stream/, 'Storage non accetta il formato cifrato degli allegati');
assert.match(storageRules, /match \/\{allPaths=\*\*\}[\s\S]*?allow read, write: if false;/, 'Storage non usa una chiusura predefinita');
assert.match(deployWorkflow, /npm ci[\s\S]*?npm test[\s\S]*?firebase\.js deploy/, 'Il deploy non è preceduto dai test del repository');
assert.equal(JSON.parse(packageJson).devDependencies?.['firebase-tools'], '15.28.2', 'La Firebase CLI non è fissata a una versione');
assert.match(loginHtml, /id="recovery-code"[^>]+autocomplete="off"/, 'Campo codice recupero assente o esposto ad autofill');
assert.match(login, /recoverTotpAccess\(pendingEmail, password, recoveryCode\)/, 'Flusso recupero 2FA non collegato al login');
assert.match(settingsHtml, /id="btn-revoke-all-sessions"/, 'Comando disconnessione postazioni assente');
assert.match(settings, /await revokeAllSessions\(\)[\s\S]*?await signOut\(auth\)/, 'La revoca postazioni non termina la sessione corrente');
assert.match(cryptoUtils, /const KEK_ITERATIONS = 600000/, 'Derivazione KEK insufficiente o non centralizzata');
assert.match(cryptoUtils, /VERIFIER_ITERATIONS = 600000/, 'Il verifier v2 non usa il costo KDF rinforzato');
assert.match(cryptoUtils, /export async function createVaultVerifier/, 'Creazione verifier v2 mancante');
assert.match(cryptoUtils, /iterations < VERIFIER_ITERATIONS/, 'Il verifier accetta ancora un downgrade del costo KDF');
assert.match(security, /verifier\.version === 1[\s\S]*?migrateVerifierV1\(masterPassword, uid, verifier\)/, 'Il verifier legacy non viene migrato automaticamente');
assert.match(security, /runTransaction[\s\S]*?remote\?\.version === 1[\s\S]*?remote\.ciphertext === legacyVerifier\.ciphertext/, 'La migrazione verifier può sovrascrivere uno stato remoto più recente');
assert.match(cryptoUtils, /export async function wrapVaultKey/, 'Envelope della Vault Key mancante');
assert.match(cryptoUtils, /export async function unwrapVaultKey/, 'Apertura envelope della Vault Key mancante');
assert.match(cryptoUtils, /createVaultKeyring[\s\S]*?legacyKey[\s\S]*?encryptionKeyCandidates/, 'La migrazione Vault non conserva un fallback leggibile per i record legacy');
assert.match(security, /generateVaultKey\(\)[\s\S]*?wrapVaultKey/, 'I nuovi Vault non ricevono una chiave casuale separata');
assert.match(security, /export async function changeMasterPassword/, 'Cambio Master Password non implementato');
assert.match(settingsHtml, /id="btn-change-master-password"/, 'Cambio Master Password non esposto in Impostazioni');
assert.match(coreUi, /passwordType[\s\S]*?bindPasswordChecklist/, 'Il cambio Master Password non mostra i requisiti dinamici');

console.log('Audit sicurezza e offline: 77 controlli superati.');
