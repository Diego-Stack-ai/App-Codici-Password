# Registrazione HTML

**Data:** 07/09/2026

## Promemoria lavoro eseguito

È stato corretto il problema di scroll verticale nella pagina `registrati.html` su mobile. La pagina non permetteva di scorrere correttamente il form perché la struttura delle pagine di accesso non usa `.base-main`, mentre il CSS globale blocca lo scroll su mobile.

La correzione è stata isolata in un CSS dedicato alla pagina di registrazione, evitando modifiche globali che potessero influire sulle altre pagine dell'app.

La password richiesta nella registrazione resta la password dell'account/username con policy account a 12 caratteri; non è la Master Password del Vault.

Durante il collaudo è stata mantenuta anche `prova.html` come pagina sperimentale pubblicabile. La pagina di prova è stata esclusa dai controlli delle 29 pagine canoniche e i suoi stili sono stati separati in un CSS dedicato per rispettare gli audit automatici.

Dopo le correzioni, la pipeline GitHub Actions è risultata verde e il deploy Firebase è stato completato.

## Aggiornamento 08/09/2026 — Ripristino notifiche Push

### Problema osservato

Nella pagina `impostazioni.html`, entrambi gli interruttori **Notifiche scadenze** e **Notifiche inviti condivisi** non rimanevano attivi e mostravano il messaggio “Configurazione notifiche non riuscita su questo dispositivo”.

La diagnosi nel browser ha evidenziato, in sequenza:

- richiesta di `/firebase-messaging-sw.js` con risposta HTTP 200 ma MIME type `text/html`, perché il file non esisteva e il server restituiva la pagina HTML di fallback;
- numerosi tentativi di installazione del Service Worker Firebase Messaging;
- errore `TypeError: Cannot read properties of undefined (reading 'name')`;
- dopo un primo tentativo di compatibilità, errore IndexedDB `VersionError: The requested version (1) is less than the existing version (2)`.

I due pulsanti utilizzano la stessa infrastruttura Push e differiscono soltanto per lo scope salvato (`deadlines` oppure `sharing`). Il guasto era quindi nel livello comune Firebase Messaging/Service Worker e non nei singoli interruttori.

### Causa individuata

La regressione era collegata alle modifiche offline introdotte il 05/09/2026: il flusso Firebase Messaging era stato spostato sul runtime Firebase locale 12.18.0, ma il relativo bundle non funzionava correttamente per questa inizializzazione Push.

Inoltre mancava il file convenzionale `firebase-messaging-sw.js`. Un tentativo con Firebase Messaging 11.1.0 ha poi rivelato un'incompatibilità con il database IndexedDB già aggiornato alla versione 2 dal runtime più recente.

### Correzioni applicate

- Creato `Frontend/public/firebase-messaging-sw.js` come Service Worker dedicato esclusivamente alle notifiche Firebase.
- Il worker Push non importa `sw.js`: il Service Worker principale continua a gestire app e cache offline, mentre quello Firebase gestisce solo notifiche e relativi click.
- Creato `Frontend/public/assets/js/push-messaging-client.js` per isolare il client Messaging dal bundle Firebase generale.
- Allineato il client Push a Firebase 12.18.0, compatibile con la versione 2 del database IndexedDB esistente.
- Aggiornato `push-manager.js` per registrare esplicitamente il worker Firebase nello scope `/firebase-cloud-messaging-push-scope`, attenderne l'attivazione e conservare dettagli tecnici utili in caso di errore.
- Aggiornati controller, inizializzazione della pagina Impostazioni e parametri di cache-busting per distribuire senza ambiguità i nuovi moduli.
- Impedito al codice principale di cancellare automaticamente il Service Worker Firebase Messaging.
- Mantenuta un'eccezione molto circoscritta nell'audit offline per il solo client Messaging caricato da CDN: le notifiche Push richiedono comunque la rete e il Vault principale resta offline-first.

### Stato verificato

Dopo il deploy, entrambi gli interruttori **Notifiche scadenze** e **Notifiche inviti condivisi** risultano attivi.

È normale vedere contemporaneamente:

- `sw.js` attivo per applicazione e cache offline;
- `firebase-messaging-sw.js` attivo per Firebase Cloud Messaging;
- una vecchia versione del worker indicata temporaneamente come **ridondante**, perché è stata sostituita dalla versione nuova.

L'attivazione e la registrazione del dispositivo sono confermate. Resta opportuno eseguire un test end-to-end separato per confermare la ricezione di una nuova notifica e l'apertura della destinazione corretta facendo click sul Push.

### Indicazioni per il prossimo agente remoto

- Non importare `sw.js` dentro `firebase-messaging-sw.js`: causerebbe una seconda gestione completa della cache e nuovi cicli anomali di installazione.
- Non riunire il client Push al bundle Firebase locale senza avere prima individuato e corretto l'errore interno relativo alla proprietà `name`.
- Mantenere allineata la versione Firebase del client Push con lo schema IndexedDB già presente; un downgrade a Firebase 11.1.0 può riprodurre il `VersionError`.
- Non interpretare un worker **ridondante** come un errore: indica una versione sostituita.
- Non è necessario cancellare IndexedDB o tutti i dati del sito quando il flusso funziona; farlo può eliminare sessioni e dati locali non pertinenti.
- Conservare la catena di cache-busting della pagina Impostazioni quando vengono modificati i moduli Push.
- Prima di ulteriori modifiche, sincronizzare la copia locale con `origin/master`.

## Nota importante sulla copia locale

Questo lavoro è stato eseguito direttamente sul repository GitHub, saltando la normale lavorazione nella cartella locale del PC.

Di conseguenza, questa nota e le modifiche collegate potrebbero non essere ancora conosciute dallo Smartdown/Markdown presente nella cartella locale.

Alla prossima sessione di lavoro locale occorre verificare la sincronizzazione con `origin/master` e allineare la documentazione locale prima di proseguire con ulteriori modifiche.
