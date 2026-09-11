# Audit completo — Fase 1: fotografia iniziale

> **Stato:** completata  
> **Autorità:** evidenza read-only subordinata al [Piano di audit completo](./PIANO_AUDIT_COMPLETO_PROGETTO.md)  
> **Data:** 11 settembre 2026  
> **Repository:** `Diego-Stack-ai/App-Codici-Password`  
> **Commit congelato:** `2c8a9c2b28a3e4dc2429dd8d249f5b4ef468cdb3`  
> **Versione dichiarata:** `1.2.99`  
> **Limite:** fotografia del repository remoto. Non certifica codice, dati reali, Firebase Console o dispositivo.

## 1. Esito

La Fase 1 ha fissato un riferimento riproducibile per le analisi successive. Il commit congelato è quello immediatamente precedente a questo rapporto e comprende il consolidamento documentale.

Non sono stati eseguiti in questa fase:

- analisi semantica completa del codice;
- scansione segreti;
- audit delle dipendenze;
- test locali o emulatori;
- lettura dei dati Firestore;
- verifica della Firebase Console;
- prova su iPhone o Windows;
- modifica di codice, Rules, Functions o dati.

Il workflow GitHub associato al commit congelato è invece stato eseguito automaticamente dalla configurazione esistente e risulta concluso con successo.

## 2. Repository congelato

| Voce | Valore |
|---|---|
| Repository | `Diego-Stack-ai/App-Codici-Password` |
| Visibilità | **Pubblico** |
| Branch predefinito | `master` |
| Commit | `2c8a9c2b28a3e4dc2429dd8d249f5b4ef468cdb3` |
| Data commit | 11/09/2026 06:33:54 UTC |
| Messaggio | `docs: aggiunge stato al contratto UI` |
| Versione package | `1.2.99` |
| Progetto Firebase dichiarato | `appcodici-password` |
| Regione Function usata dal rewrite Hosting | `europe-west1` |
| Località Firestore dichiarata | `eur3` |
| Runtime Functions | Node.js 22 |

Il repository pubblico non è di per sé un errore, ma rende obbligatorio che nessuna chiave privata, service account, token, dato personale o contenuto del Vault sia mai versionato. Questo verrà verificato nella fase successiva.

## 3. Branch rilevati

Sono presenti 11 branch remoti:

1. `master`;
2. `archive/redesign-ui-typography-20260906`;
3. `codex/account-field-usage-audit-20260910`;
4. `codex/form-loading-placeholder-fix`;
5. `codex/full-app-audit-optimization`;
6. `codex/profile-dashboard-digital-card`;
7. `codex/redesign-ui-typography`;
8. `codex/shared-deadlines-20260908`;
9. `codex/widget-inline-edit-20260910`;
10. `codex/widget-mobile-fix-20260910`;
11. `fix/ios-footer-safe-area`.

Questa fase non stabilisce se siano già uniti, abbandonati o ancora necessari. La verifica della divergenza e dell’eventuale archiviazione appartiene alla fase repository/supply-chain.

## 4. Inventario del commit

L’albero GitHub è stato restituito integralmente (`truncated: false`).

| Area | File |
|---|---:|
| Radice | 10 |
| `.github` | 2 |
| `.vscode` | 2 |
| `Frontend` | 228 |
| `archive` | 9 |
| `docs` | 30 |
| `experiments` | 23 |
| `functions` | 21 |
| `scripts` | 29 |
| `tests` | 36 |
| **Totale file** | **390** |

### Tipologie principali

| Tipo | Conteggio |
|---|---:|
| JavaScript `.js` | 170 |
| Moduli/script `.mjs` | 78 |
| HTML | 37 |
| CSS | 37 |
| Markdown | 35 |
| JSON | 14 |
| Rules | 6 |
| Workflow YAML | 1 |
| Font WOFF2 | 2 |
| Immagini PNG/JPG | 7 |

Sono stati rilevati 51 file collocati in directory di test oppure nominati come test. Il valore è inventariale: non significa che tutti siano eseguiti dalla suite principale.

## 5. Versione

`package.json` dichiara `1.2.99`. La stessa versione compare nei riferimenti cache-busting delle principali pagine e moduli trovati dalla ricerca GitHub.

La Fase 1 registra quindi la versione come **apparentemente coerente**. La verifica completa di ogni riferimento, manifest, worker e cache appartiene alla fase statica successiva.

## 6. Struttura applicativa dichiarata

| Componente | Percorso/configurazione |
|---|---|
| Hosting pubblico | `Frontend/public` |
| Firestore Rules | `firestore.rules` |
| Firestore indici | `firestore.indexes.json` |
| Storage Rules | `storage.rules` |
| Functions | `functions/`, codebase `default` |
| Entry Functions | `functions/index.js` |
| Emulatori | Auth 9099, Firestore 8080, Functions 5001 |
| Service worker applicativo | `Frontend/public/sw.js` |
| Worker Firebase Messaging | `Frontend/public/firebase-messaging-sw.js` |
| Progetto Firebase predefinito | `appcodici-password` |

Il rewrite `/protected-media/presentation` chiama `getAppPresentation` in `europe-west1`; `/home` porta a `home_page.html`; il fallback generale porta a `login-v115.html`.

## 7. Hosting e header dichiarati

`firebase.json` configura:

- HTML, JavaScript, root, manifest e service worker con `no-cache, no-store, must-revalidate`;
- `X-Frame-Options: DENY`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- Permissions Policy con camera, microfono e geolocalizzazione disabilitati;
- CSP con `frame-ancestors 'none'`, `object-src 'none'` e `base-uri 'self'`;
- `unsafe-inline` ancora ammesso per gli stili;
- origini Firebase/Google/reCAPTCHA ammesse secondo configurazione.

Sono configurazioni nel repository, non prova degli header effettivamente serviti dall’hosting.

## 8. Dipendenze dichiarate

### Applicazione e sviluppo

- Firebase SDK `12.18.0`;
- Firebase Tools `15.28.2`;
- Rules Unit Testing `5.0.2`;
- esbuild `0.28.2`;
- madge `8.0.0`;
- stylelint `17.1.0`;
- Tesseract.js `7.0.0`;
- ZXing browser `0.2.1`.

### Functions

- Node.js 22;
- `firebase-admin ^14.3.0`;
- `firebase-functions ^7.3.2`;
- `nodemailer ^9.1.1`;
- ESLint `^9.39.2`.

Versioni e lockfile sono stati registrati, ma vulnerabilità, dipendenze transitive, licenze e aggiornamenti non sono ancora stati valutati.

## 9. Suite dichiarata

`package.json` contiene:

- 41 script complessivi;
- 28 gruppi `test:*`;
- una suite `npm test` che concatena tutti i 28 gruppi;
- build preventiva del runtime offline.

Le aree dichiarate comprendono offline, sicurezza, Vault, dati, navigazione, shell, UI, riferimenti statici, prestazioni, sintassi, CSS, dipendenze, Agente, Profilo, crittografia, allegati, condivisione, conflitti offline, cronologia, backup, salute credenziali, hardening, Functions e Rules.

La presenza del comando non dimostra la copertura o la correttezza del test. La Fase 2 dovrà mappare ogni requisito alla prova effettiva.

## 10. Workflow e deploy

È presente un solo workflow: `.github/workflows/firebase-deploy.yml`.

### Comportamento configurato

A ogni push su `master`:

1. checkout;
2. Node.js 22;
3. Java 21;
4. `npm ci`;
5. `npm ci --prefix functions`;
6. `npm test`;
7. deploy di Hosting, Firestore Rules e Storage tramite `FIREBASE_TOKEN`.

Le Functions non vengono distribuite dal workflow: il commento dichiara deploy manuale finché `FIREBASE_TOKEN` non sarà sostituito da un’identità CI adeguata.

### Esecuzione del commit congelato

| Voce | Esito |
|---|---|
| Workflow | Validate and deploy Firebase |
| Run | 284 |
| Evento | push su `master` |
| Stato | completato |
| Conclusione | **success** |
| Inizio | 11/09/2026 06:33:56 UTC |
| Fine | 11/09/2026 06:35:15 UTC |
| Link | [GitHub Actions run 284](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/34570469816) |

Questo dimostra che il workflow ha dichiarato successo. Non dimostra ancora quali versioni siano attive nella Firebase Console oltre a ciò che il job ha tentato di distribuire.

### Conseguenza operativa

Anche un commit composto soltanto da Markdown su `master` avvia l’intera suite e, se verde, ridistribuisce Hosting, Firestore Rules e Storage.

Questa politica non viene modificata nella Fase 1, ma deve essere valutata nella fase supply-chain/deploy perché:

- produce deploy non necessari;
- rende ogni aggiornamento documentale un evento di produzione;
- ridistribuisce Rules anche quando non sono cambiate;
- usa un token CI dichiarato legacy;
- separa Functions dal resto, con possibile disallineamento delle versioni.

## 11. Elementi da non confondere con una conclusione

La fotografia registra, senza ancora giudicare:

- repository pubblico;
- 10 branch oltre a `master`;
- cartelle `archive` ed `experiments`;
- `prova.html` ancora presente dentro `Frontend/public`;
- un solo workflow automatico;
- Functions escluse dal deploy automatico;
- Rules e Storage inclusi in ogni deploy su `master`;
- `FIREBASE_TOKEN` ancora richiamato dal workflow;
- 35 Markdown;
- 51 file di test;
- versione `1.2.99`.

Questi elementi diventano finding soltanto dopo la verifica prevista nelle fasi successive.

## 12. Limiti di accesso

Da GitHub è stato possibile verificare repository, branch, commit, file, configurazioni dichiarate e GitHub Actions.

Non è stato possibile certificare in questa fase:

- working tree locale su PC;
- branch protection/ruleset amministrativo;
- segreti configurati in GitHub;
- Firebase Console;
- IAM e service account;
- App Check enforcement;
- versioni effettive delle Functions;
- dati Firestore/Storage reali;
- stato PWA sui dispositivi.

Questi controlli richiederanno gli accessi già autorizzati o la collaborazione del product owner. Non verranno aggirati.

## 13. Baseline per la Fase 2

La Fase 2 dovrà partire dal commit congelato e produrre una matrice:

| Documento/requisito | Codice | Test | Configurazione | Esito |
|---|---|---|---|---|
| Architettura Sicurezza V1 | percorso preciso | prova precisa | remoto se necessario | conforme/parziale/conflitto/non verificabile |

Priorità iniziali:

1. storage della Vault Key e `vault-session.js`;
2. inventario cifratura e metadati;
3. Rules generiche e Functions;
4. condivisione legacy/candidata;
5. allegati e URL legacy;
6. offline reale;
7. workflow e deploy;
8. backup e recupero.

## 14. Chiusura della Fase 1

La fotografia è sufficientemente definita per iniziare l’audit statico. Qualunque modifica successiva al commit congelato deve essere indicata nel rapporto della fase seguente, senza spostare silenziosamente il riferimento.
