# Guida

## Lingua e prima configurazione

Alla prima apertura il selettore lingua compare prima dell'identificazione. Se possiedi già un account puoi chiuderlo e accedere: quando il profilo viene riconosciuto, l'app applica la lingua associata. Per creare un nuovo account devi invece scegliere una lingua. Puoi cambiarla in seguito da **Impostazioni → Lingua App**; il cambio riguarda pulsanti, intestazioni, istruzioni, messaggi e voce dell'Assistente, non nomi, note o altri dati che hai inserito.

Dopo il primo accesso la Home propone di aprire le Impostazioni oppure esplorare l'app. La conferma della lingua è obbligatoria prima di creare o modificare dati. Tema, area Azienda, Assistente base, notifiche, MFA, biometria e backup restano scelte facoltative e possono essere completate in seguito. I requisiti autonomi di accesso e sblocco del Vault continuano comunque a valere.

## Documenti personali e relative Scadenze

In **Profilo → Documenti**, salva prima il Documento con una data di scadenza valida. Se non esiste ancora il collegamento, premi **Configura scadenza**: l’editor riepiloga intestatario, tipo, numero, ente di rilascio e Data di scadenza senza chiederti di sceglierli di nuovo. In italiano la data appare `GG/MM/AAAA`; per cambiarla devi modificare il Documento nel Profilo. Puoi personalizzare il testo proposto per email e notifica, impostare preavviso, frequenza e nota, gestire gli allegati, aggiungere i destinatari e scegliere separatamente per ciascuno Email, Push e **Può gestire**. Dopo il salvataggio il pulsante diventa **Apri scadenza del documento**.

Su iPhone le notifiche Push richiedono l’app aggiunta alla schermata Home. In **Impostazioni → Notifiche scadenze**, attiva l’interruttore e usa **Invia notifica di prova su questo dispositivo**. Se Firebase comunica che la vecchia registrazione del telefono non è più valida, l’app la sostituisce conservando le preferenze e ritenta una sola volta; se anche il secondo tentativo non riesce, verifica connessione e autorizzazione alle notifiche prima di riprovare.

Il comando **Gestisci destinatari** apre la stessa rubrica disponibile in **Impostazioni → Destinatari email**. Da questa pagina si può aggiungere o modificare un contatto e poi usare **Torna al modulo precedente**: preavviso, frequenza, nota, campi della Scadenza e destinatari già selezionati vengono ripristinati. Se erano stati scelti nuovi file dal dispositivo, l'app chiede conferma prima di cambiare pagina perché tali file dovranno essere selezionati nuovamente.

La stessa situazione è visibile in **Impostazioni → Regole scadenze → Documenti personali**. Ogni scheda riassume direttamente il Documento, il testo dell’email/notifica e i parametri della sua Scadenza; non è una seconda copia e le modifiche riguardano gli stessi record. Le vecchie Scadenze non vengono eliminate automaticamente e vanno gestite dalla normale lista Scadenze. Il conteggio allegati indica i file consultabili in modo protetto nell'app: non significa che i file vengano spediti come allegati dell'email.

> Stato di implementazione, verifiche e distribuzione: [STATO](../progetto/STATO.md). Le fonti storiche conservate sotto hanno la propria data; per nuovi aiuti valgono i contratti e il riesame delle schede della guida.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

## Guida pagina per pagina e aiuto contestuale

La guida descrive come orientarsi e quali comandi usare; lo stato di implementazione, delle verifiche e della distribuzione è soltanto in [STATO](../progetto/STATO.md). La matrice seguente è l’inventario della superficie canonica, derivato dal [registro delle pagine](../regole/INTERFACCIA.md#fonte-docs-canonical-page-registry-md-l1), dagli HTML e dai moduli, riesaminato sulla base `14c61754` (`1.2.183`) e integrato nella candidata `1.2.184`. Non certifica dispositivi, recapito di notifiche o ambienti distribuiti. I walkthrough e i video indicano il formato progettato; non implicano pulsanti di aiuto già disponibili nell’app.

| pageId | Obiettivo dell’utente | Aiuto per funzioni e controlli | Formato previsto |
|---|---|---|---|
| `index` | Ingresso: Raggiungi la pagina di accesso all’app. | Collegamento all’accesso | Testo |
| `login-v115` | Accesso: Accedi con l’identità del tuo account; lo sblocco del Vault è un passaggio distinto. | Distinzione password/Vault, MFA e recupero | Testo + walkthrough breve |
| `registrati` | Registrazione: Crea l’account di accesso e segui la verifica dell’email. | Requisiti, conferma e verifica email | Checklist + walkthrough |
| `reset_password` | Recupero dell’accesso: Richiedi l’email per cambiare la password di accesso. | Email di recupero e collegamento riservato | Testo |
| `imposta_nuova_password` | Nuova password di accesso: Scegli la nuova password di accesso dal percorso autorizzato. | Requisiti e conferma password accesso | Checklist |
| `home_page` | Home: Scegli l’area in cui lavorare e controlla i riepiloghi delle scadenze. | Aree, riepiloghi e presentazione facoltativa | Testo + walkthrough |
| `area_privata` | Area privata: Scegli fra Account, Account condivisi, memorandum privati e memorandum condivisi. | Quattro categorie, più usati, statistiche | Testo + walkthrough |
| `account_privati` | Account privati: Cerca e consulta gli Account della categoria scelta. | Ricerca, ordinamento, azioni e permessi | Testo + walkthrough |
| `form_account_privato` | Crea o modifica Account privato: Prepara un Account o memorandum e controlla i dati prima di salvarli. | Tipi, banking, Widget, comuni, destinatari, Salva | Checklist + walkthrough |
| `dettaglio_account_privato` | Dettaglio Account privato: Consulta credenziali, note, Widget e allegati dell’Account selezionato. | Mostra/copia, banking, note, allegati e condivisione | Testo + walkthrough; video allegati opzionale |
| `profilo_privato` | Profilo utente: Organizza identità, contatti, indirizzi, documenti e tessera digitale. | Tab, foto, contatti, indirizzi, documenti, collegamenti, Configura/Apri scadenza del documento, QR | Checklist + walkthrough; video QR/allegati opzionale |
| `lista_aziende` | Aziende: Scegli l’azienda e accedi ai suoi dati e Account. | Elenco, creazione e scelta contesto | Testo + walkthrough |
| `dati_azienda` | Dati azienda: Consulta il profilo aziendale, i contatti e le proiezioni condivisibili. | Riepilogo, tessera/QR, PDF e sedi | Testo + walkthrough; video PDF/QR opzionale |
| `modifica_azienda` | Crea o modifica azienda: Aggiorna anagrafica, referente, sedi, contatti e note aziendali. | Anagrafica, fiscale, referente, sedi, email, note/allegati | Checklist + walkthrough |
| `account_azienda` | Account azienda: Cerca gli Account nel contesto dell’azienda scelta. | Ricerca e categoria nel contesto aziendale | Testo + walkthrough |
| `form_account_azienda` | Crea o modifica Account aziendale: Prepara un Account o memorandum dell’azienda selezionata. | Tipi, banking, Widget, comuni, destinatari, Salva | Checklist + walkthrough |
| `dettaglio_account_azienda` | Dettaglio Account aziendale: Consulta le informazioni dell’Account nell’azienda corrente. | Mostra/copia, note, Widget, allegati e permessi | Testo + walkthrough; video allegati condiviso |
| `scadenze` | Scadenze: Cerca le date da seguire e distingui scadenze proprie e ricevute. | Filtro, ricerca, ordinamento, proprie/ricevute | Testo + walkthrough |
| `aggiungi_scadenza` | Crea o modifica scadenza: Imposta data, categoria, preavviso, destinatari e contenuti della scadenza. | Categoria, data, preavviso, frequenza, destinatari e allegati | Checklist + walkthrough |
| `dettaglio_scadenza` | Dettaglio scadenza: Controlla data, pianificazione, contenuti e azioni della scadenza scelta. | Pianificazione, fonte, allegati e azioni autorizzate | Testo + walkthrough |
| `regole_scadenze` | Regole delle scadenze: Consulta gli ambiti e configura le scadenze dei Documenti personali. | Riepilogo diretto dei Documenti personali, parametri e accesso alla Scadenza; configurazioni storiche separate | Testo + walkthrough breve |
| `configurazione_automezzi` | Configurazione Automezzi: Gestisci tipi, modelli e testi per le scadenze dei veicoli. | Tipi, modelli, testi e assenza di riscrittura retroattiva | Checklist + walkthrough |
| `configurazione_documenti` | Configurazione Documenti: Gestisci tipi, modelli e testi per le scadenze dei documenti. | Tipi, modelli e testi | Checklist + walkthrough |
| `configurazione_generali` | Configurazione Generali: Gestisci tipi e testi delle scadenze generali. | Tipi e testi separati dagli altri domini | Checklist + walkthrough |
| `impostazioni` | Impostazioni: Configura aspetto, servizi, sicurezza e gestione dei dati dal centro di controllo. | Lingua/tema, Assistente, Azienda, Archivio, comuni, backup, salute, campi, regole, sicurezza, push, diagnostica e logout | Indice ricercabile + walkthrough per gruppo; video backup opzionale |
| `gestione_destinatari` | Gestione destinatari: Prepara i contatti da selezionare nei flussi di condivisione. | Rubrica, email, ritorno e distinzione da inviti/permessi | Checklist + walkthrough |
| `archivio_account` | Archivio Account: Trova gli Account archiviati e scegli fra ripristino ed eliminazione definitiva. | Contesto, ricerca, ripristino e cancellazione definitiva | Testo + conferme applicative; walkthrough solo descrittivo |
| `contatto_condiviso` | Contatto condiviso: Consulta soltanto il contatto reso disponibile tramite il QR. | Contatto ricevuto, vCard e recupero errore | Testo; nessun contesto Vault |
| `privacy` | Privacy: Leggi l’informativa privacy dell’app. | Accesso all’informativa senza parafrasi legali autonome | Testo |
| `termini` | Termini: Leggi le condizioni d’uso del servizio. | Accesso alle condizioni pubblicate | Testo |

### Primi passi e percorsi completi

L’onboarding proposto è facoltativo, interrompibile e riapribile: accesso → distinzione fra password di accesso e Master Password → Home → Profilo essenziale → primo Account → Impostazioni. Spiega subito che la guida non richiede né riceve password, PIN, codici o Recovery Key. Non impone di compilare il Profilo completo, attivare l’Assistente, installare un modello, concedere notifiche o creare dati per terminare il percorso.

Il catalogo collega anche cinque percorsi: primo Account privato; prima azienda con Account; prima Scadenza; condivisione consapevole; sicurezza e recupero. Sono sequenze di schede leggibili: il passaggio fra schede della guida non naviga, salva o invia alcunché. Aprire un record reale richiederà il router dell’app e i suoi normali permessi, mai un URL generato dal testo della guida.

### Impostazioni come centro dell’aiuto

Il catalogo conserva «Guida e primi passi» e le schede «Aiuto su questa pagina». Sulle pagine di accesso e sul ricevitore pubblico resta un ingresso dedicato, senza caricare la shell privata. Nelle pagine private non viene montato un secondo `?` nel footer: l'unico aiuto visibile è quello dentro l'Agente Codex, che dovrà riusare le stesse schede statiche quando l'integrazione sarà completata. La ricerca nei propri dati resta un percorso separato dopo sblocco.

Le Impostazioni richiedono schede brevi distinte per: lingua; luminosità e palette; Assistente base; area Azienda; Archivio; Credenziali comuni; backup e ripristino; salute credenziali; uso dei campi; regole Scadenze; password accesso; MFA e codici recupero; Master Password e biometria; timer blocco; reset Vault; revoca sessioni; push Scadenze/Condivisioni; diagnostica; informative e logout. Preparazione offline, allegati offline e AI locale facoltativa hanno spiegazioni separate quando i rispettivi incrementi sono integrati. La presenza della guida non certifica l’integrazione di queste funzioni future.

### Come consultare la prima guida testuale

Negli ingressi pubblici il comando apre la scheda della pagina corrente. «Pagina da conoscere» permette di leggere una qualsiasi delle 30 schede; «Primi passi» mostra il percorso introduttivo; «Questa pagina» ritorna al contesto iniziale. Le schede correlate aprono altre istruzioni dentro il dialogo: non navigano l'app e non creano, aprono o modificano record. Nelle pagine private il catalogo non espone un comando separato finché non sarà collegato al `?` interno dell'Agente.

Chiudi con il pulsante, Escape o il fondale. Il focus ritorna al comando di apertura quando ancora disponibile; Tab e Shift-Tab restano dentro il dialogo. Le istruzioni sono leggibili anche quando il Vault è bloccato o l'Assistente è disattivato; sulle pagine private resta necessario superare il normale gate di identità, e un eventuale altro dialogo dell'app deve essere chiuso prima dell'apertura. Se un dialogo dell'app compare mentre consulti la guida, la guida si chiude e può essere riaperta dopo averlo gestito. Non inserire segreti per usare la guida. Per la consultazione senza rete prepara prima la shell PWA mentre sei online; la disponibilità delle istruzioni non implica quella dei dati personali.

Questa prima vista usa testo e selezione delle schede. Evidenziazione dei comandi, avanzamento dei walkthrough, video e traduzioni aggiuntive mantengono i gate sotto riportati. Per implementazione/verifica/distribuzione vedere soltanto [STATO](../progetto/STATO.md).

### Regole per l’uso degli aiuti

Ogni scheda mostra scopo, istruzioni numerate, limiti e pagine correlate. I nomi di Account, aziende, note, Widget e documenti creati dall’utente restano invariati; vengono tradotti soltanto titolo, spiegazioni, comandi della guida, ARIA ed errori statici. Una traduzione mancante usa l’italiano e deve dichiarare il fallback; non usare un modello per tradurre i contenuti personali.

Il walkthrough mostra un’istruzione alla volta con Avanti, Indietro, Esci e contatore dei passi. Un controllo può essere evidenziato soltanto se univoco, visibile, abilitato e appartenente alla vista corrente. Altrimenti resta l’istruzione testuale completa. Il tour non preme pulsanti, non apre lucchetti, non legge valori dei campi, non concede permessi e non accetta conferme. Foto, allegati, inviti, condivisioni, copie negli appunti, reset, backup e cancellazioni restano azioni dell’utente nei flussi dell’app.

Aiuto e video devono avere equivalenti testuali; la lettura e l’uscita funzionano da tastiera e screen reader. Evidenziazione e animazione non sono l’unico modo di spiegare un passo; rispettare movimento ridotto, zoom e safe area. Un cambio pagina, logout o smontaggio termina il tour; dopo chiusura il focus ritorna al comando che lo ha aperto, se ancora presente.

### Video: selezione e manutenzione

Non occorre un video per ogni HTML. I primi candidati sono i flussi visuali riutilizzabili: acquisizione Tessera/Carta e ritaglio/originale; Profilo e QR; Account con Widget e Credenziali comuni; Scadenza con destinatari; backup e ripristino. Le pagine di sola lettura, accesso, informative e configurazioni semplici beneficiano soprattutto di testo e walkthrough. Un video condiviso fra Account privati e aziendali evita due registrazioni quasi uguali.

Ogni clip deve usare soltanto fixture sintetiche, mostrare versione e data di revisione, avere durata, peso, sottotitoli, trascrizione e capitoli. Non registrare schermate di dati reali, campi rivelati, chiavi o notifiche personali; per illustrare un segreto usare un segnaposto dichiarato. Riproduzione e download restano volontari, senza autoplay, analytics esterni o precache obbligatoria. Il video Home mantiene il proprio trasporto protetto; la guida non ne copia token o URL.

Budget proposto da validare: 30–60 secondi e 2–5 MiB per clip, con stop della produzione editoriale se un compito risulta più chiaro in testo. A titolo di calcolo, una clip da 4 MiB riprodotta 1.000 volte trasferisce circa 3,9 GiB; cinque clip simili riprodotte 1.000 volte ciascuna trasferiscono circa 19,5 GiB. Sono esempi aritmetici, non una stima di traffico o una tariffa corrente. I costi reali dipendono dal trasporto scelto e dalle tariffe da verificare prima di pubblicare.

La manutenzione include registrazione, montaggio, sottotitoli/traduzioni, verifica visiva e sostituzione dopo cambi di UI. Preferire sovrimpressioni traducibili e audio facoltativo a una registrazione distinta per lingua. Una clip non riesaminata per la release corrente va segnalata come da aggiornare o rimossa dalla scheda, mantenendo testo e walkthrough.

### Aggiornamento per release e gate d’integrazione

Ogni cambiamento a pagina, controllo o flusso deve aggiornare la relativa scheda e la matrice nello stesso lavoro. Il catalogo ha versione del contenuto indipendente dalla versione dell’app e indica la base applicativa riesaminata. I controlli automatici verificano copertura delle 30 route, chiavi, link interni e target statici; non dimostrano che le istruzioni siano corrette o che un controllo sia effettivamente disponibile su ogni dispositivo.

Prima di integrare la UI: riesame editoriale funzione per funzione; identificatori stabili per i controlli dinamici; owner di apertura/smontaggio e focus; prove sintetiche con Vault bloccato, AI disattivata, pagina vuota, permessi diversi, offline dopo preparazione, target mancante e cambio pagina durante tour; prova tastiera/screen reader/zoom/movimento ridotto; budget e CSP; traduzioni dei controlli della guida e fallback esplicito; policy di progresso locale minimale senza dati personali. Verificare separatamente mobile fisico e PWA.

La fonte tecnica e le API del primo nucleo sono in [ASSISTENTE_APP](../sviluppo/ASSISTENTE_APP.md#catalogo-d0-e-risolutore-della-guida). Stato, test eseguiti e limiti restano in [STATO](../progetto/STATO.md); i testi storici sotto conservano la loro data e non prevalgono sui contratti o sulle schede riesaminate.

## Indice delle fonti conservate

- [M10_GUIDA_UTENTE_BOZZA.md](#fonte-docs-m10-guida-utente-bozza-md-l1)

<a id="fonte-docs-m10-guida-utente-bozza-md-l1"></a>

## Fonte: M10_GUIDA_UTENTE_BOZZA.md — righe originali 1–144

> Provenienza: `docs/M10_GUIDA_UTENTE_BOZZA.md` a `2900ccc0`.

<a id="fonte-docs-m10-guida-utente-bozza-md-m10-4--bozza-della-guida-utente-funzioni-effettivamente-presenti"></a>

## M10-4 — Bozza della guida utente (funzioni effettivamente presenti)

> **Stato:** **BOZZA di laboratorio** per la revisione di Diego. **Non** è una guida pubblicabile, **non**
> dichiara conclusi M6–M10, **non** sostituisce la revisione privacy/legale finale e **non** autorizza un
> go-live. M10-4 resta **aperto** (`docs/CENSIMENTO_GATE_M6_M10.md`, riga M10-4;
> `docs/PIANO_MATURITA_PROFESSIONALE.md:425`).
> **Base:** ramo `integration/vault-shell-v127-security`, HEAD `30b38835`, versione `1.2.127`.
> **Metodo:** solo fonti del repository, lette e citate; nessun dato reale; nessuna modifica a codice,
> test, Rules o Functions. Le informazioni organizzative sono **segnaposto** (nessun nome, impegno o
> termine inventato).

<a id="fonte-docs-m10-guida-utente-bozza-md-0-come-leggere-questa-bozza"></a>

### 0. Come leggere questa bozza

Ogni voce porta tre etichette:

- **[V] comportamento verificato** — provato da test/banchi presenti nel repository (con la fonte);
- **[C] comportamento candidato non distribuito** — esiste nel ramo di laboratorio, **non** è in
  produzione;
- **[E] prova esterna mancante** — richiede dispositivo fisico, console del progetto o audit esterno.

Le pagine canoniche sono **30** (`docs/CANONICAL_PAGE_REGISTRY.md`): ogni funzione visibile ha una sola
pagina e un solo modulo inizializzatore.

<a id="fonte-docs-m10-guida-utente-bozza-md-1-accesso-e-sicurezza-dellaccount"></a>

### 1. Accesso e sicurezza dell'account

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Registrazione, accesso, reset password | creazione account, accesso e recupero via Firebase Auth | `registrati.html`, `reset_password.html`, `imposta_nuova_password.html`, `login-v115.html` | [V] nei test di autenticazione; [E] matrice fisica |
| Sblocco del Vault con Master Password | deriva la chiave (KEK) e apre la chiave del Vault | `modules/core/crypto-utils.js` (PBKDF2-SHA256 600 000 per verificatore/KEK) | [V] |
| Sblocco biometrico (passkey/WebAuthn PRF) | secondo fattore locale con estensione PRF; fail-closed se il PRF non c'è | `modules/core/webauthn-manager.js`, `security-manager.js` | [V] nei test di laboratorio; [E] su dispositivo |
| Recupero MFA con codice | password + codice di recupero **monouso**, limite per email+IP, codice conservato per hash | `functions/index.js` (`recoverMfaWithCode`) | [V] lettura del codice e test Functions; [E] prova reale |
| Blocco, logout e pulizia | blocco del Vault e logout; viene cancellata la **sessione Vault in `sessionStorage`** (payload incapsulato, chiave di wrapping e due chiavi storiche), mentre bozze, cache IndexedDB, coda offline, `localStorage` e shell PWA **restano sul dispositivo** | `logout-session.js`, `vault-session.js:94-99` | [V] |
| Sessione cifrata nella scheda | la chiave del Vault è incapsulata; **la chiave di wrapping vive in `sessionStorage`** | `vault-session.js:3` (`getSessionKey`) | [V] come comportamento attuale; **[C]/[E]** la bonifica è il P0 noto (`AUDIT_VAULT_SESSION_P0.md`) |

> **Nota di trasparenza:** il P0 della chiave di wrapping in `sessionStorage` è **aperto** e va dichiarato
> all'utente nella versione finale, con il testo approvato dal proprietario (segnaposto Q1 in
> `docs/M10_DOMANDE_GUIDA_E_PRIVACY.md`).

<a id="fonte-docs-m10-guida-utente-bozza-md-2-dati-personali-profilo-contatti-indirizzi-documenti"></a>

### 2. Dati personali: Profilo, contatti, indirizzi, documenti

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Profilo | anagrafica e contatti del proprietario, con valori sensibili protetti | `profilo_privato.html` → `modules/privato/profilo_privato.js` | [V] (include i banchi a freddo `--cold-browser`) |
| Contatti, telefoni, indirizzi, utenze | voci collegate o autonome, con campi cifrati | `modules/privato/*`, `modules/core/vault-repository.js` | [V] |
| Documenti privati con allegati immagine | metadato in Firestore, byte in Storage, protocollo di cancellazione non atomico | `docs/M7_RETENTION_CENSIMENTO.md` §5.1-5.3 | [V] comportamento attuale; **[E]** collaudo fisico |
| Widget di profilo | campi personalizzati, anche sensibili, con anteprima nascosta | `docs/M7_RETENTION_CENSIMENTO.md`, banchi `--cold-browser` | [V] |
| Card digitale, QR e PDF riepilogativo | proiezione scelta dall'utente; esclusioni verificate (nessun segreto nel QR aziendale) | banchi a freddo, `docs/M7_RETENTION_CENSIMENTO.md` §6.6 | [V] |

<a id="fonte-docs-m10-guida-utente-bozza-md-3-account-privati-e-aziendali"></a>

### 3. Account privati e aziendali

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Account privati | credenziali cifrate, note, URL, archiviazione, revisione per la coda offline | `area_privata.html`, `account_privati.html`, `form_account_privato.html`, `dettaglio_account_privato.html` | [V] |
| Credenziali bancarie nei record | più banche/carte per record, PIN e CCV su richiesta | `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` (matrice bancaria) | [V] in laboratorio; [E] su dispositivo |
| Aziende e Account aziendali | stesso modello con contesto aziendale, collegamenti e widget | `lista_aziende.html`, `dati_azienda.html`, `modifica_azienda.html`, `account_azienda.html`, `form_account_azienda.html`, `dettaglio_account_azienda.html` | [V] |
| Widget e credenziali comuni | campi aggiuntivi collegati a un Account o condivisi fra i record del proprietario | `accountWidgets`, `sharedVaultData` (`functions/index.js`) | [V] |
| Campi protetti (lucchetto) | valore nascosto all'apertura, mostrato su richiesta e riazzerato all'uscita | banchi a freddo (`COLD_*_CLEAR`) | [V] |

<a id="fonte-docs-m10-guida-utente-bozza-md-4-scadenze-promemoria-e-destinatari"></a>

### 4. Scadenze, promemoria e destinatari

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Scadenze e regole | scadenze con configurazioni dedicate | `scadenze.html`, `aggiungi_scadenza.html`, `dettaglio_scadenza.html`, `regole_scadenze.html` e le tre pagine di configurazione | [V] |
| Notifica tecnica pianificata | una sola schedulazione backend per le scadenze | `functions/index.js` (`checkDeadlines`), `docs/M7_RETENTION_CENSIMENTO.md` §7 | [V] come codice; **[E]** push reale su dispositivo |
| Destinatari e inviti | invio a destinatari con permesso di gestione, revoca e sospensione | `gestione_destinatari.html`, `functions/index.js` (`respondToInvitation`, `manageReceivedDeadline`) | [V] |
| Push del browser | notifiche push con service worker dedicato | `push-messaging-client.js`, `firebase-messaging-sw.js` | [V] come codice; **[E]** prova su dispositivo |

<a id="fonte-docs-m10-guida-utente-bozza-md-5-condivisione-fra-persone"></a>

### 5. Condivisione fra persone

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Condivisione di un Account con un altro utente | il destinatario legge i dati condivisi tramite `sharedWith`; letture vincolate dallo UID | `docs/DATA_ACCESS_CONTRACT.md`, `firestore.rules`, prove di condivisione (38 test) | [V] |
| Revoca e reinvito | revoca, sospensione inviti, reinvito dopo ripristino | test di condivisione e ciclo di revoca | [V] comportamento attuale |
| Copie residue del destinatario | il purge del proprietario **non** tocca inviti e copie condivise: il destinatario può ancora vedere nome e id dell'Account eliminato | `docs/M7_RETENTION_CENSIMENTO.md` §3.6 (D14 aperta) | [V] come comportamento attuale; **decisione aperta** |
| Ricevitore pubblico del contatto | pagina di sola visualizzazione per un contatto condiviso | `contatto_condiviso.html` → `contact-card-receiver.js` | [V] |

<a id="fonte-docs-m10-guida-utente-bozza-md-6-archivio-cancellazione-e-cronologia"></a>

### 6. Archivio, cancellazione e cronologia

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Archivio Account (cestino) | archiviazione, ripristino e cancellazione definitiva con conferma forte; **nessuna scadenza automatica** | `archivio_account.html`, `functions/index.js` (`purgeArchivedAccount`) | [V] |
| Cosa resta dopo il purge | il purge elimina solo gli allegati elencati; restano widget, copie condivise, inviti, prefissi non coperti e le **copie locali** (cache, bozze, coda, shell) | `docs/M7_RETENTION_CENSIMENTO.md` §3.4, §3.6, §3.7, §6.5; T-08/T-09/T-16/T-21/T-27 | [V] come comportamento attuale; **decisioni aperte** (D4, D10, D11, D14) |
| Cronologia e audit tecnico | eventi tecnici per UID, senza interfaccia utente; retention a **24 mesi** decisa dal proprietario e implementata **solo nel ramo** | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:114-171` | [C] implementato non distribuito; [E] rilascio e monitoraggio |
| Vista utente della cronologia | **non esiste** | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md` (censimento in sola lettura) | [V] assenza verificata |

<a id="fonte-docs-m10-guida-utente-bozza-md-7-backup-cifrato-e-ripristino"></a>

### 7. Backup cifrato e ripristino

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Esportazione `.cpbackup` | file cifrato con Recovery Key a visualizzazione singola; la **prima riga è in chiaro** (formato, versione, UID proprietario, identificatore, data, parametri KDF, cifrario) | `docs/M7_RETENTION_CENSIMENTO.md` §6.7 (T-17) | [V] |
| Ripristino con anteprima | confronto record per record, sostituzione selettiva confermata, controllo di versione per blocco | `docs/M8_BACKUP_RECUPERO.md`; banchi M8/M8-bis/M8-ter/M8-quater | [V] |
| Interruzione fra record e byte | un upload fallito lascia un **riferimento senza byte**; una nuova sessione non riprova nulla; il CAS per blocco può lasciare applicati i blocchi precedenti | `docs/M8_BACKUP_RECUPERO.md` (gate **NON CHIUSA**) | [V] difetto osservato; gate **aperto** |
| Ripristino di un Account già purgato | il ripristino lo **ricrea** con byte e riferimenti | `docs/M7_RETENTION_CENSIMENTO.md` §6.8 (T-21, D16 aperta) | [V] |
| Compatibilità delle copie PWA già installate | ordine di aggiornamento di client e backend, messaggio in caso di incompatibilità temporanea | `docs/M10_HARDENING_RILASCIO.md:59-70` | [E] prova sulle copie reali |

<a id="fonte-docs-m10-guida-utente-bozza-md-8-uso-offline-e-dati-sul-dispositivo"></a>

### 8. Uso offline e dati sul dispositivo

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Consultazione offline dei dati già preparati | la shell è in cache; i dati testuali preparati sono leggibili senza rete dopo lo sblocco | `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` (banchi `--cold-browser`, 33 esiti) | [V] in laboratorio; [E] dispositivo fisico |
| Scritture offline in coda cifrata | coda cifrata con lease, idempotenza e conflitti espliciti; soli domini abilitati | `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` | [V] per il perimetro; [C] fallback senza Web Locks non adottato |
| Browser senza Web Locks | oggi il percorso della coda **rifiuta** (`OFFLINE_QUEUE_LOCKS_UNAVAILABLE`); il fallback di laboratorio non è attivo | `docs/M6_DOMANDE_FALLBACK_WEB_LOCKS.md` | [C] candidato; decisione aperta |
| Cache del dispositivo espulsa | con la cache applicativa espulsa l'identità non si ripristina, il Vault resta chiuso e la consultazione è rifiutata | `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` (M6-1-LAB) | [V] in laboratorio; **[E]** su dispositivo, con limiti dichiarati |

<a id="fonte-docs-m10-guida-utente-bozza-md-9-salute-delle-credenziali-e-integrazioni"></a>

### 9. Salute delle credenziali e integrazioni

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Analisi locale di password deboli, duplicate e datate | analisi in memoria dopo lo sblocco; nessuna password o impronta persistita | `docs/M9_SALUTE_CREDENZIALI.md` | [V]; [E] collaudo Windows |
| Controllo violazioni con k-anonimato | contratto definito e testato **senza rete**; integrazione **disattivata** | `docs/M9_SALUTE_CREDENZIALI.md:14,30` | [C] non attivo; decisione e verifica provider mancanti |
| Passkey di servizio nei record | è un dato del record, non sblocca il Vault | `docs/M9_SALUTE_CREDENZIALI.md:16` | [V] |
| Autofill/estensione browser | progetto separato, non nel bootstrap | `docs/M9_SALUTE_CREDENZIALI.md:18` | [C] non implementato |

<a id="fonte-docs-m10-guida-utente-bozza-md-10-funzioni-non-presenti-o-non-distribuite"></a>

### 10. Funzioni **non** presenti o non distribuite

- **Interfaccia della cronologia/audit**: non esiste (vedi §6).
- **Vista utente delle ricevute di idempotenza**: non esiste.
- **Excel**: presente solo su un ramo separato, **non** montato nella shell (`docs/PASSAGGIO_CONSEGNE_2026-09-16.md:90`).
- **Integrazione violazioni password**: disattivata (§9).
- **Fallback senza Web Locks**: candidato di laboratorio (§8).
- **Rollout della shell persistente**: sperimentale; la produzione è `1.2.127`.

<a id="fonte-docs-m10-guida-utente-bozza-md-11-segnaposto-per-le-informazioni-organizzative-da-compilare"></a>

### 11. Segnaposto per le informazioni organizzative (da compilare)

Nessun nome, contatto, termine o impegno è inventato qui: ogni voce è un **segnaposto** con la domanda
corrispondente in `docs/M10_DOMANDE_GUIDA_E_PRIVACY.md`.

| Voce | Segnaposto |
|---|---|
| Chi approva la guida utente | `[DA COMPILARE — Q1]` |
| Canale di assistenza e tempi di risposta | `[DA COMPILARE — Q2]` |
| Referente privacy/legale e modalità di contatto | `[DA COMPILARE — Q3]` |
| Incident commander, referente Firebase, canale di emergenza, accesso break-glass | `[DA COMPILARE — Q4]` (`docs/RISPOSTA_INCIDENTI_E_RECUPERO.md`, «Informazioni organizzative da completare») |
| Comunicazioni in caso di incidente o interruzione | `[DA COMPILARE — Q5]` |
| Informativa privacy e termini pubblicati | `privacy.html`, `termini.html` **esistono**; il contenuto non è stato riesaminato in questa bozza (`[DA COMPILARE — Q6]`) |

<a id="fonte-docs-m10-guida-utente-bozza-md-12-limiti-di-questa-bozza"></a>

### 12. Limiti di questa bozza

- È una **bozza documentale di laboratorio**: nessuna approvazione, nessun uso pubblico, nessuna
  traduzione, nessuna verifica su dispositivo fisico.
- Le fonti sono **il repository** a questo commit: dove la prova è solo di laboratorio (emulatori,
  browser headless, dati sintetici) è indicato; dove serve un dispositivo o la console è indicato [E].
- **Non** chiude M6–M10, **non** sostituisce l'audit indipendente, **non** è una revisione legale o
  privacy finale e **non** autorizza un go-live.
