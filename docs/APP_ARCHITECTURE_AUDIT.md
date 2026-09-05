# Audit architettura e inventario — Codici & Password

> Stato: revisione sorgente completata sul branch di audit. Collaudo automatico superato; pubblicazione non eseguita.

## Obiettivi e invarianti

- Conservare comportamento, dati, sicurezza, UI e funzionamento offline.
- Ridurre richieste, file duplicati, codice morto e responsabilità sovrapposte.
- Non rimuovere alias o pagine storiche finché ogni riferimento interno, cache e compatibilità non è verificato.
- Eseguire la suite completa dopo ogni gruppo di modifiche.

## Architettura verificata

L'applicazione è una PWA multipagina ospitata da Firebase Hosting. Le pagine protette caricano
`main-v129.js`, che inizializza componenti condivisi, autenticazione, Vault, timer di inattività,
notifiche/inviti e poi importa dinamicamente il modulo della pagina tramite `pages-init.js`.
La pagina di accesso usa il bootstrap più piccolo `login-entry.js`.

Firestore usa come radice `users/{uid}`. I dati personali sono nelle sottocollezioni `accounts`,
`aziende`, `scadenze`, `contacts` e `settings`; gli account aziendali sono sotto
`users/{uid}/aziende/{aziendaId}/accounts`. Gli inviti sono documenti top-level in `invites` e
la loro accettazione è convalidata dalla Cloud Function `respondToInvitation`. Allegati e avatar
sono in Storage sotto `users/{uid}/...`. Gli allegati della Vault vengono cifrati lato client.

Il service worker precarica una shell minima e mette in cache a runtime le pagine visitate e gli
asset same-origin. Firestore mantiene inoltre una cache locale persistente multi-tab. Le due cache
sono complementari: la prima rende disponibile l'interfaccia, la seconda i dati già sincronizzati.

## Flussi principali verificati

1. Login: `login-v115.html` → `login-entry.js` → `modules/auth/login.js` → `auth.js`.
2. Avvio protetto: pagina HTML → `main-v129.js` → auth observer → `pages-init.js` → modulo pagina.
3. Vault: `security-manager.js` coordina verifier, envelope, WebAuthn e `vault-session.js`.
4. Privato: area/lista → dettaglio → form; dati in `users/{uid}/accounts`.
5. Azienda: lista → dati azienda → account/dettaglio/form; dati sotto `aziende/{aziendaId}`.
6. Scadenze: lista/dettaglio/form + configurazioni; notifiche generate dalle Cloud Functions.
7. Condivisione: invito top-level → validazione server → UID destinatario aggiunto all'account.
8. Push: device registrato in `pushDevices`; service worker gestisce messaggi e deep link.

## Evidenze e decisioni conservative

- Nessuna dipendenza circolare: il grafo è passato da 90 a 82 moduli analizzati.
- Il font Material Symbols pesa circa 3,7 MB ed è il maggiore asset applicativo.
- I CSS delle tre configurazioni scadenze e quelli degli account condividono molte regole, ma
  unirli ora aumenterebbe la superficie di cascade e potrebbe caricare regole inutili sulle singole
  pagine. La duplicazione è quindi documentata e rinviata alla futura revisione UI, quando potrà
  essere verificata visivamente senza alterare la livrea corrente.
- Gli entry point segnalati come “orfani” dal grafo non sono automaticamente codice morto: molti
  sono caricati direttamente dall'HTML o tramite import dinamico.
- L'unico duplicato byte-per-byte rimasto è intenzionale: `home-v126.html` e `home-v127.html`
  conservano due URL storici già distribuiti, ma ora effettuano entrambi un solo redirect diretto.

## Ottimizzazioni applicate

- Rimossa la vecchia API generica `db.js` (18 export, 16 inutilizzati). Le sole due operazioni
  ancora necessarie, lettura ed eliminazione di una scadenza, sono ora locali al relativo modulo
  e mantengono esattamente gli stessi percorsi Firestore.
- Rimossa la classe `VaultSearchIndex`, mai caricata dal runtime e sostituita dal più completo
  `VaultConversationEngine`; il test ora esercita soltanto il motore realmente usato dall'app.
- Corretto il deep link dell'assistente per le aziende da una pagina inesistente alla pagina
  canonica `dati_azienda.html`.
- Eliminati quattro moduli alias privi di logica (`components.js`, `components-v126.js`,
  `ui-core.js`, `env.js`) dopo avere convertito tutti gli import ai moduli canonici.
- Accorciati i redirect storici `home-v126.html` e `home-v127.html`: ora raggiungono direttamente
  `home_page.html` senza scaricare due documenti intermedi.
- Rimossa `googleapis` dalle Cloud Functions: non era importata; email e notifiche usano
  rispettivamente `nodemailer` e Firebase Admin Messaging.
- Rimosse le dipendenze Playwright: il progetto non contiene test che le importino e il browser
  non veniva installato né usato dalla pipeline. Il collaudo locale è stato eseguito con Edge già
  presente sul sistema, senza aggiungere peso alle installazioni npm.
- Attivati nella suite i controlli sulle dipendenze circolari e un lint CSS conservativo che
  rileva errori strutturali senza imporre modifiche stilistiche.
- Rimossi l'onboarding `security-setup.js`, mai importato dal runtime e superato dal flusso Vault
  canonico, e `scadenza_templates.js`, sostituito dalle configurazioni Firestore e dal compositore
  effettivo in `aggiungi_scadenza.js`.
- Rimossi helper ed export senza consumatori da UI, crittografia, profilo e sicurezza; non erano
  raggiungibili da pagine, import dinamici o test di comportamento.
- Rimosse due condizioni di navigazione relative alla pagina inesistente `notifiche_storia.html`.
- Aggiunto un audit dei riferimenti statici: verifica import, asset, pagine e impedisce il ritorno
  degli alias storici eliminati.

## Impatto misurato

- File JavaScript pubblici: da 91 a 83 file fisici; grafo applicativo da 90 a 82 moduli.
- Diff funzionale del frontend: circa 800 righe eliminate e meno di 150 aggiunte, incluse le
  sostituzioni locali necessarie e i commenti aggiornati.
- Dipendenze: rimossi `googleapis` dalle Functions e il `playwright` dichiarato due volte alla
  radice; i lockfile restano riproducibili.
- Nessun asset visivo, schema Firestore, regola di autorizzazione o formato dati è stato cambiato.

## Verifiche completate

- 77 controlli di sicurezza e offline.
- 32 HTML senza stile, script o eventi inline, ID duplicati o Tailwind runtime.
- 148 file testuali pubblici con riferimenti statici validi.
- Lint CSS, navigazione post-salvataggio, assistente Vault e grafo senza cicli.
- Test crittografia, allegati, Cloud Functions e regole Storage.
- Smoke test locale dei redirect di ingresso e degli alias Home storici con Edge headless; le
  chiamate Firebase esterne restano volutamente non verificabili nel server locale isolato.

## Stato inventario

- Configurazione Firebase, manifest, regole Firestore/Storage: letti e classificati.
- Service worker, bootstrap, router e dipendenze globali: letti e mappati.
- 32 HTML: struttura, fogli stile, entry point, form e redirect censiti.
- JavaScript di dominio, CSS, traduzioni, test e documentazione: letti, classificati e verificati.
- Il dettaglio file per file è rigenerabile con `npm run audit:inventory` in `FILE_INVENTORY.md`.
