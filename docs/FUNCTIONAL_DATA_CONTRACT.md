# Contratto funzionale e dati — baseline M0

> Fotografia dell'app alla versione 1.2.49. Questo documento descrive il comportamento da preservare; non dichiara ideale l'accesso diretto a Firebase presente in alcune pagine.

## Regole trasversali

- L'identità remota è Firebase Auth; la Master Password sblocca localmente la Vault Key e non coincide con la password Firebase.
- I dati sensibili devono arrivare alla UI soltanto dopo lo sblocco della Vault e passare dalle API crittografiche condivise.
- L'email è l'identificatore umano di destinatari e invitati; la risoluzione email → UID avviene nel backend quando necessaria.
- La consultazione offline riguarda shell e dati già sincronizzati. Gli allegati non sono garantiti offline; Push, email e risoluzione inviti richiedono rete.
- Logout, cambio utente e blocco devono eliminare dalla sessione il materiale crittografico previsto.

## Mappa delle aree

| Area visibile | Entrata/modulo principale | Dati remoti attuali | Contratto da preservare |
|---|---|---|---|
| Login, registrazione, recupero | `login-v115.html`, `registrati.html`, `reset_password.html`, moduli `auth/*` | Firebase Auth; `users/{uid}`; funzioni MFA | Login, 2FA, recupero e rotazione password senza esporre Master Password o codici |
| Sblocco Vault | `modules/core/security-manager.js`, `vault-session.js` | `users/{uid}/settings/security`; campi compatibili in `users/{uid}` | verifier, envelope, WebAuthn/PRF e fallback legacy controllato |
| Home | `home_page.html`, `modules/home/home.js` | profilo, `aziende`, `scadenze`, `deadlineNotifications` | accesso rapido, conteggi, avvisi pendenti e Agente locale senza bloccare il primo contenuto |
| Area privata | `area_privata.html`, `modules/privato/area_privata.js` | `users/{uid}/accounts`, `contacts`, inviti top-level | riepilogo, account frequenti, contatti e inviti |
| Account privati | lista/form/dettaglio in `modules/privato/*account*` | `users/{uid}/accounts/{accountId}` e sotto-collezione `attachments` | card consultabili, segreti su richiesta, memorandum, archivio e condivisione |
| Aziende | `lista_aziende.html`, `dati_azienda.html`, `modifica_azienda.html` | `users/{uid}/aziende/{aziendaId}` | anagrafica, contatti, dati bancari, note e allegati cifrati |
| Account aziendali | lista/form/dettaglio in `modules/azienda/*account*` | `users/{uid}/aziende/{aziendaId}/accounts/{accountId}` e `attachments` | stesso contratto Account, mantenendo il contesto aziendale |
| Profilo personale | `profilo_privato.html`, `modules/privato/profilo_privato.js` e moduli `profilo-*` | `users/{uid}`, `profileWidgets`, `settings/profileLabels`, `settings/qrCodeInclusions` | identità, recapiti, documenti, indirizzi, widget, QR e collegamenti ad Account/Scadenze |
| Scadenze | lista/form/dettaglio in `modules/scadenze/*` | `users/{uid}/scadenze/{deadlineId}` | categorie, intestatario, veicolo/documento, data, URL, note, allegati e reminder |
| Regole Scadenze | configurazioni `scadenze/configurazione_*` | `settings/deadlineConfig`, `deadlineConfigDocuments`, `generalConfig` | anticipo, frequenza, tipi, modelli e template senza alterare le scadenze esistenti |
| Destinatari | `gestione_destinatari.html`, `modules/shared/gestione-destinatari.js` | `users/{uid}/contacts/{contactId}` | rubrica unica riusabile; email normalizzata e cancellazione bloccata se in uso |
| Condivisioni | form/dettagli Account, `main-v129.js`, callable `respondToInvitation` | `invites/{inviteId}`; `sharedWith`, `sharedWithUids`; notifiche utente | pending/accetta/rifiuta/revoca; nessuna enumerazione utenti; record accessibile solo nell'app |
| Notifiche Scadenze | Home, service worker, backend | `deadlineNotifications`, `pushDevices`, log di consegna | proprietario retrocompatibile; destinatari con Email/Push indipendenti; errori di un canale non bloccano l'altro |
| Archivio | `archivio_account.html`, `modules/settings/archivio_account.js` | Account privati e aziendali con `isArchived` | consultazione e ripristino senza confondere archivio con cancellazione definitiva |
| Impostazioni | `impostazioni.html`, `modules/settings/impostazioni.js` | `users/{uid}` e documenti `settings/*` | preferenze UI, area Azienda, 2FA, biometria, Push e sicurezza |
| Ricerca/Agente Codex | `modules/assistant/*` | profilo, Account, Aziende e Scadenze dell'utente | ricerca locale dopo sblocco, nessun invio di segreti a servizi AI remoti |
| Allegati | moduli dettaglio/form e Firebase Storage | `users/{uid}/.../attachments/*`; oggetti Storage sotto `users/{uid}` | upload/download cifrato, limiti tipo/dimensione; non inclusi automaticamente nell'offline |
| OCR sperimentale | `experiments/card-importer` | nessun dato produttivo richiesto | prototipo isolato; estrazione proposta all'utente, mai salvataggio automatico di segreti |

## Strutture critiche attuali

```text
users/{uid}
users/{uid}/settings/{settingId}
users/{uid}/accounts/{accountId}
users/{uid}/accounts/{accountId}/attachments/{attachmentId}
users/{uid}/aziende/{aziendaId}
users/{uid}/aziende/{aziendaId}/accounts/{accountId}
users/{uid}/aziende/{aziendaId}/accounts/{accountId}/attachments/{attachmentId}
users/{uid}/scadenze/{deadlineId}
users/{uid}/contacts/{contactId}
users/{uid}/profileWidgets/{widgetId}
users/{uid}/notifications/{notificationId}
users/{uid}/deadlineNotifications/{notificationId}
users/{uid}/pushDevices/{deviceId}
invites/{inviteId}
```

Le Scadenze nuove usano `recipients[]` con `contactId?`, `displayName`, `email`, `sendEmail`, `sendPush`; `emails[]`, `email1` ed `email2` restano letti come formato legacy. Le condivisioni usano `sharedWith`, `sharedWithUids` e inviti con `recipientEmail`; gli UID accettati non sostituiscono l'email nell'interfaccia.

## Confini offline

| Operazione | Offline atteso |
|---|---|
| Aprire shell già installata e sessione conservata | sì |
| Consultare dati già sincronizzati e sbloccare la Vault | sì, se il metodo di sblocco locale è disponibile |
| Ricerca locale sui dati sincronizzati | sì |
| Scaricare un allegato mai aperto | no |
| Inviare email/Push, risolvere destinatari o accettare inviti | no; ripresa con rete |
| Scrivere/modificare record | non ancora garantito finché M6 non definisce coda e conflitti |

## Gate per le rifattorizzazioni

Ogni sostituzione deve conservare: percorso dati leggibile, schema legacy, Rules, cifratura, navigazione diretta, consultazione offline prevista e test. Un vecchio percorso può essere rimosso soltanto dopo confronto con questo catalogo e collaudo sul dataset M0.

I budget statici sono applicati da `npm run test:performance-budget`. Gli obiettivi runtime in `scripts/page-performance-budget.json` diventano bloccanti soltanto dopo una baseline ripetibile su dispositivi reali; fino ad allora non costituiscono una dichiarazione delle prestazioni correnti.

La diagnostica runtime è attivabile nelle Impostazioni del singolo dispositivo. Conserva localmente al massimo 80 campioni con nome della fase, durata, pagina, stato rete e conteggi tecnici ammessi da una lista chiusa. Non registra contenuti, identificativi utente, email, URL visitati, token, credenziali o valori decifrati; disattivandola vengono cancellati i campioni persistiti.
