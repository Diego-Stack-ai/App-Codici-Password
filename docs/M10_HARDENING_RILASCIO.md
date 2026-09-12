# M10 — Hardening e rilascio maturo

> **Stato:** gate automatico superato per le versioni indicate; verifica reale e certificazione ancora aperte  
> **Autorità:** contratto di rilascio ed evidenza, subordinato ad [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md)  
> **Ultima revisione documentale:** 11 settembre 2026

## Stato verificabile

> “Verificabile” indica l’esecuzione dei controlli documentati nel repository. Non dimostra da solo il deploy effettivo, l’enforcement della Firebase Console, i dati reali, la resistenza crittografica o tutti i dispositivi.

Il gate automatico controlla header di sicurezza Hosting, assenza di `unsafe-eval`, protezione anti-framing, vincoli UID nelle Rules, App Check obbligatorio su tutte le callable e lockfile moderno. La suite completa comprende inoltre sintassi, dipendenze circolari, CSP/riferimenti statici, sicurezza dei dati, emulatori Firestore e Storage e tutti i laboratori M5–M9.

L'audit del 08/09/2026 rileva zero vulnerabilità note nelle dipendenze di produzione. Le pagine non contengono script inline e la CSP non concede più `unsafe-inline` a `script-src`; sono inoltre vincolati `base-uri`, `object-src` e `form-action`. `unsafe-inline` resta per i soli stili perché alcuni componenti runtime impostano ancora proprietà visive dinamiche: è un debito esplicito da eliminare componente per componente, senza una rimozione globale non collaudata.

## Gate che richiedono ambiente reale

- verificare App Check Enforcement, Firestore Rules e Storage Rules dalla console del progetto pubblicato;
- eseguire la matrice su iPhone, Windows e browser supportati, inclusi rete lenta, offline, riapertura e overscroll;
- provare backup, cancellazione e ripristino esclusivamente su una copia non produttiva;
- sottoporre crittografia e condivisione a un audit indipendente prima di dichiararle mature;
- ottenere approvazione esplicita prima di modificare Rules, Functions o dati di produzione.

Finché questi punti non sono firmati, la build è una candidata tecnica e non una release professionale definitiva.

## Collaudo esplorativo v1.2.64

L'8 settembre 2026 il product owner ha navigato nell'app pubblicata e nelle sue pagine senza rilevare malfunzionamenti. Questo costituisce un esito positivo di smoke test generale e conferma l'assenza di regressioni evidenti dopo il rilascio M0–M10. Non sostituisce la matrice M10: dispositivo, sistema, browser, tema, rete offline, riapertura, tastiera e modali non sono stati registrati come singoli casi verificati.

## Gate automatico v1.2.90

Il 10 settembre 2026 la suite M0–M10 è stata rieseguita integralmente con esito positivo. Sono risultati verdi shell offline, 88 controlli di sicurezza, contratto Vault, repository dati, navigazione, 29 pagine canoniche, fondazioni UI, purezza HTML, riferimenti statici, budget prestazionali, sintassi, CSS, dipendenze, crittografia, allegati, condivisione, coda offline, cronologia, backup, Salute credenziali, hardening di rilascio, Functions e Rules Firestore/Storage tramite emulatori.

Questo chiude il gate automatico della candidata v1.2.90. Restano separati e non mascherati: matrice fisica Windows, audit indipendente e consultazione offline reale già registrata in `M6_SINCRONIZZAZIONE_OFFLINE.md`.

La successiva evoluzione dell'Agente Codex è stata sottoposta ad audit prima dell'implementazione. Architettura, confini D0–D4 e nuovo ordine operativo post M0–M10 sono registrati in `AGENTE_CODEX_EVOLUZIONE.md`; modelli locali e servizi remoti non sono stati abilitati.

Prima di implementare tale evoluzione è stato aggiunto il blocco di coerenza Profilo/Account/Widget/Cache, descritto in `PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md`. Il lavoro parte dall'audit dei dati e assegna priorità alla proprietà read-your-writes; nessuna migrazione o modifica strutturale dei dati legacy è autorizzata dalla sola registrazione della roadmap.

## Checklist operativa di rilascio

1. working tree pulita, versione unica e suite completa verde;
2. inventario e budget prestazionali aggiornati;
3. backup cifrato della copia di collaudo e prova di ripristino riuscita;
4. deploy Preview e matrice fisica firmata;
5. controllo manuale di CSP, App Check, Rules, indici e log privi di dati sensibili;
6. piano di rollback identificato prima del deploy produzione;
7. monitoraggio errori tecnici senza contenuti del Vault;
8. chiusura o rollback immediato se autenticazione, cifratura, sync o recupero regrediscono.

## Gate aggiuntivo Auth/Vault — 12/09/2026

`npm run test:vault-emulators` verifica il collegamento SDK Authentication/Firestore e lettore v2 su progetto demo locale, con una copia identica delle Rules correnti. Undici test superati. Integrato nella suite completa; non modifica il canale pubblicato né dimostra enforcement remoto, MFA/PRF, App Check o recupero completo. [Audit §20](./AUDIT_VAULT_SESSION_P0.md#20-sdk-firebase-e-sessione-protetta-in-emulatore--12092026).
