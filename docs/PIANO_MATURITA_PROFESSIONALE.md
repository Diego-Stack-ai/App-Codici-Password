# Piano di maturità professionale — Codici & Password

> **Stato:** programma in corso; avanzamento riconciliato, gate aperti conservati.
> **Autorità:** piano subordinato alla baseline e ai contratti specialistici; prevale la baseline sicurezza.
> **Revisione:** 15/09/2026; incremento verificato `054b045d`, PR #67. Produzione 1.2.127; cronologia e gate specialistici conservati.
> **Area:** maturità M0–M10 e post-M10.
> **Dipendenze:** [Guida progetto](./GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

> Stato iniziale: versione locale 1.2.49. Documento di progetto, non autorizza migrazioni, cancellazioni, deploy o modifiche distruttive.

## 1. Obiettivo

### Proseguimento autonomo — stato 15/09/2026 dopo 17a1236a

La decisione dell'utente è proseguire tutte le attività autonome, lasciando aperti i soli gate che richiedono intervento e passando alle attività indipendenti. Questo stato aggiorna il checkpoint documentale sotto, senza chiudere M0–M10. Ramo unico `integration/vault-shell-v127-security`, bozza PR #67; produzione 1.2.127 invariata.

- Completato `2686b48e`: consultazione aziendale con la stessa vista del profilo privato, schema canonico e collegamenti distinti per origine/destinazione. CI GitHub 34948919828 superata.
- Completato `17a1236a`: preparazione offline automatica della shell, richieste separate per UID e stato UI invalidabile. Prima visita ai profili dopo riavvio offline verificata senza probe preliminare. CI GitHub 34949481504 superata.
- Incremento successivo verificato: utenze personali e credenziali collegate; documenti collegati provati nel browser. Suite completa, 253 test shell e 146 verifiche browser superati. Dettagli nella roadmap profili; il commit dell'incremento è riportato nella PR.

Ordine dei prossimi blocchi autonomi, verificando ogni volta gli ultimi commit per evitare duplicazioni:

Editor dei flag QR aziendali montato dopo `81cc50d6`: stessa vista privata, sorgente separata senza decifratura, controller con retry idempotente, bridge e overlay Rules solo laboratorio. Otto nuove prove unitarie; suite completa npm test superata (422 test shell) e 90 verifiche Chrome online/offline e dopo riavvio superate; Edge/iPhone restano aperti. **Proseguire con editor profili/collegamenti e selezione delle righe aggiuntive**, che il blocco dei quattordici flag non modifica. Gate callable/App Check e transizione writer, foto aziendale, Widget aziendali, Excel e M5–M10 restano aperti. Stato più recente dettagliato nella roadmap profili; nessun deploy.

Selezione QR aziendale dopo `a2a0252a`: contratto dei quattordici flag fissi, transazione con ricevuta e confronto completo della configurazione precedente preparati. Dieci prove unitarie ed emulatori superati; suite completa npm test superata (414 test shell). Non montato nel browser né esportato dalle Functions; overlay Rules solo laboratorio. **Riprendere sorgente/editor e montaggio dei flag fissi aziendali**; selezione righe aggiuntive e transizione writer restano aperte. Dettagli nella roadmap profili. Checkpoint precedente conservato come cronologia. Nessun deploy.

Scheda PDF richiesta in `45110a0e` implementata nella candidata dopo `d62e74d8`: scelta gruppi, generazione locale, anteprima testuale, download/condivisione file. Suite completa (404 shell), 90 verifiche Chrome e ispezione integrale PDF sintetico multipagina superati. iPhone/condivisione reale, Edge e limiti font restano aperti; perimetro nella roadmap profili. **Riprendere gli editor profili/collegamenti e la selezione aziendale**, mantenendo il gate produttivo QR (callable/App Check e writer legacy), Widget aziendali, Excel e M5–M10. Nessun deploy.

Editor QR montato dopo `fb207a4e`: trasporto locale limitato alle fixture, overlay Rules e prove di selezione/salvataggio/rilettura riusciti. Suite completa (388 shell), 90 verifiche Chrome online/offline e dopo riavvio superate. **Riprendere dalla scheda PDF aziendale richiesta sotto.** Callable produttivo/App Check reale, transizione writer legacy, Edge/iPhone e parità restante restano aperti; il montaggio del laboratorio non li chiude. Dettagli nella roadmap profili, nessun deploy.

**Richiesta aggiuntiva Diego — 15/09/2026: scheda PDF aziendale.** Dopo il consolidamento del montaggio editor QR attualmente in verifica, realizzare nel profilo aziendale una scheda riepilogativa PDF con scelta dei dati: ragione sociale, dati fiscali, sede legale/altre sedi, referente, email e telefoni. Generazione locale su azione esplicita, download e condivisione del file attraverso il selettore del dispositivo (WhatsApp/email se disponibili), con alternativa di download. Nessun invio automatico. Escludere password, PIN, PUK, credenziali collegate, chiavi, note riservate e byte allegati. Proiezione dedicata con UID/revoca, anteprima leggibile, testo lungo/accenti e più pagine verificati su fixture; browser/iPhone fisico e disponibilità della condivisione file sono gate distinti. Nessuna necessità di leggere dati reali per implementare e collaudare. La richiesta si aggiunge al programma, non sostituisce gli altri residui e non autorizza deploy.

Editor QR dopo `686b1f1c`: sorgente, controller revocabile, vista e provider preparati; sedici nuove prove, suite completa (386 shell), percorso sorgente-controller-servizio su Firestore demo con risposta persa e retry superati. **Prossimo: adapter attendibile e montaggio browser**, con transizione Rules/writer legacy già richiesta; provider non montato né attivato in produzione. Dettagli nella roadmap profili. Restanti parità e gate invariati.

Selezione QR dopo `5fc9c8f2`: contratto privato e transazione backend con ricevuta verificati nel laboratorio. Suite completa (370 shell), concorrenza/retry e overlay Rules negli emulatori superati. Non ancora collegati alla shell né esportati dalle Functions: Rules produttive legacy non modificate, enforcement HTTP/App Check da verificare. **Proseguire con controller/editor revocabili e adapter**, predisponendo migrazione dei writer legacy prima dell'attivazione. Dettagli e limiti nella roadmap profili; nessun deploy.

Parità QR dopo `e7f70061`: telefono aziendale ora supportato dal generatore e dal lettore shell solo con selezione esplicita, senza ampliare le selezioni salvate. Suite completa superata (363 shell), due regressioni; nessuna nuova prova browser. **Prossimo blocco: editor della selezione nella shell**, con preferenze tipizzate e Rules ristrette secondo la matrice; non riusare il writer legacy permissivo. Foto aziendale e restante parità rimangono aperte.

Tessera aziendale successiva a `104aefc9`: stessa vista privata, lettore e generatore aziendali separati, selezione salvata e revoca. Suite completa (362 shell) e 90 verifiche Chrome superate. **Proseguire con editor selezione/profili e parità dei campi QR**; il generatore aziendale canonico non include ancora telefono aziendale generico/foto. Widget aziendali con schema/Rules dedicati, Edge/iPhone e restante programma conservati aperti. Perimetro nella roadmap profili; nessun deploy.

Tessera privata successiva a `f439cb61`: QR e vCard dalla selezione salvata, letture revocabili e pulizia anteprima. Suite completa superata (355 shell), 90 verifiche Chrome online/offline e dopo riavvio. **Proseguire con tessera aziendale**, poi editor della selezione/profili e Widget aziendali con schema/Rules dedicati. Collaudi Edge/iPhone conservati; dettagli nella roadmap profili. Nessun deploy o chiusura del programma.

Aggiornamento dopo `16dae6f1`: Widget personali consultabili nelle linguette con lettore revocabile, anteprima protetta e collasso locale. Suite completa, 343 shell finali e 90 verifiche Chrome superati; [perimetro e test](./PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md#widget-del-profilo-nella-shell--candidata-15092026). **Prossimo blocco: tessera digitale.** Estensione dei Widget al profilo aziendale ancora aperta: il modello canonico verificato non ha raccolta equivalente, quindi definire schema/Rules e copertura offline prima di abilitarla; nessun riuso dei Widget privati in azienda. Editor e ordine/collasso persistenti restano nel punto 3. Gate Edge/iPhone conservati.

Aggiornamento profili successivo a `530c991a`: note anagrafiche e Panoramica consultabili nella shell, con modello canonico e navigazione interna. Suite completa, 329 shell e 90 verifiche Chrome superati; gate Edge/iPhone conservati. [Perimetro di Panoramica](./PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md#panoramica-dei-profili-nella-shell--candidata-15092026). **Proseguire ora con Widget del profilo e parità aziendale**, poi tessera digitale e gli editor del punto 3. Le note sono consultabili, non ancora modificabili nel profilo della shell.

Aggiornamento operativo dopo `33e4b1b1`: montata la consultazione bancaria con Widget nel rispettivo conto prima delle carte, due conti per dominio e prove di pulizia dei valori. Suite completa, 317 shell e 90 verifiche Chrome (58 entry + 32 arresto/riapertura) superati. Edge resta aperto per uscita del browser locale prima di DevTools; il risultato Chrome non lo sostituisce. [Perimetro della vista bancaria](./PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md#vista-bancaria-della-shell--candidata-15092026). **Riprendere dal punto 3, parità profili**, senza rifare il lettore o la vista bancaria. Editing/collasso restano nel successivo blocco editor; mantenere il gate Edge fino a prova effettiva.

Integrazione aggiuntiva richiesta da Diego il 15/09/2026: includere nel percorso di pubblicazione anche il piccolo progetto Excel del ramo `codex/real-excel-export-preview`. Ramo recuperato dalla cartella locale `C:/Users/Diego/Documents/Progetti/Codici&Password` e pubblicato su origin al commit verificato `40052515dd493279c0f49118205b9405eef05376` (precedenti incrementi `4bb23696`, `55283ad8`). È un candidato separato, non integrato né distribuito. Prima del rilascio confrontare i tre commit con la shell corrente, adattare la sessione legacy, verificare mascheramento/esportazione esplicita dei segreti, compatibilità XLSX e test; integrare selettivamente evitando regressioni nei file Impostazioni e dipendenze. Le modifiche non registrate della cartella d'origine (`PIANO_MATURITA_PROFESSIONALE.md`, `.qwen/`, `outputs/`) non sono incluse nel push e non vanno inglobate implicitamente. Questa aggiunta non chiude alcun gate del programma.

1. Completata nella candidata successiva a `b3b07769`: directory aziende con ricerca, scelta del profilo o lista Account e contesto mantenuto nel dettaglio/ritorno. Suite completa, 263 test shell e 156 verifiche browser superati. Vedi [roadmap profili](./PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md#selezione-aziende-nella-shell--candidata-15092026).

   Excel, verifica e primo adeguamento successivo a `45deb058`: proiezione revocabile e mascheramento PUK/Widget pronti, 12 test mirati e suite completa (290 shell) superati. Restano generatore XLSX, UI/consenso/download, selettori e allegati; [risultati e limiti in M8](./M8_BACKUP_RECUPERO.md#esportazione-excel-separata-dal-backup--candidata-15092026). Il ramo originale non va unito senza queste correzioni. La prosecuzione principale resta il punto 2; riprendere l'Excel nel blocco Impostazioni/esportazioni, senza perdere le attività qui registrate.
2. Completata dopo `0d31c777` la prima UI di consultazione Widget Account/credenziali comuni, con lettore revocabile, fixture browser non vuote e prove offline anche dopo arresto forzato: suite completa, 296 shell e 170 verifiche browser. [Perimetro e prossimi passi](./PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md#consultazione-widget-nella-shell--candidata-15092026). Restano parità editor, ordine/collasso e montaggio nei moduli bancari. **Prossimo sottoblocco:** lettore bancario e host dei Widget per `bankId`, tra dati del conto e carte; non appiattire i Widget bancari tra quelli generici. La composizione di consultazione evita i renderer legacy con `ensureVaultKeyMaterial`; nessuna chiave va consegnata alla UI. Poi proseguire i punti 3–5.
3. Parità profili: panoramica, note, Widget e tessera digitale; editor e creazione/cambio/dissociazione dei collegamenti tramite percorso conforme alla matrice di autorizzazione. Le scritture multi-documento non vanno copiate implicitamente in un nuovo writer client.

   Stato del sottoblocco bancario dopo `5f17a9a2`: lettore dedicato pronto, modello canonico e compatibilità legacy verificati, 13 nuove prove e 312 shell nel contratto Vault superate. **Riprendere dal montaggio della vista bancaria e degli host Widget**, non ricreare il lettore. Vedi [perimetro e test](./PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md#lettore-bancario-della-shell--candidata-15092026). Questo aggiornamento precede operativamente la parità profili sopra.
4. Parità dei dettagli/editor Account, moduli bancari e altri percorsi canonici; integrare poi scadenze, impostazioni, archivio, backup e salute credenziali nel bootstrap unico.
5. Gate tecnici ancora aperti nei contratti M5–M10, compresi staging/ripresa del ripristino M8, retry e riferimenti orfani su copie sintetiche. I collaudi fisici, audit indipendente e configurazioni esterne non verificabili restano separati.
6. Solo a parità e collaudi completati: preparare sostituzione del percorso multipagina, rimozione della persistenza legacy e piano di rilascio/rollback. Nessun deploy, bump o merge master autorizzato da questa prosecuzione.

Foto e byte allegati restano esclusi dall'offline. La completezza automatica è provata sui domini sintetici indicati in M6; eviction, disco e iPhone fisico del nuovo ramo rimangono da verificare. VS-P0-01 resta aperto sul runtime produttivo legacy.

### Chiusura documentale dell'incremento 054b045d — 15/09/2026

Questo riepilogo chiude il lavoro verificato dell'incremento, non l'intero programma M0–M10. Sostituisce i precedenti riepiloghi operativi per lo stato della candidata; audit e collaudi storici restano riferiti alle proprie basi. Baseline sicurezza e contratti specialistici invariati.

| Voce | Stato verificato | Evidenza o condizione di chiusura |
|---|---|---|
| Scelta della shell persistente | Decisione chiusa, già approvata | Chiave nella memoria della shell, navigazione interna senza reload; non richiedere nuovamente questa scelta |
| Riallineamento alla sicurezza 1.2.127 | Completato nella candidata | Merge `1089cde8`; confine browser e pulizia residui legacy `0fc581a0` |
| Consultazione profilo | Incremento completato nella candidata | `3fff87bc`: Anagrafica, Contatti, Indirizzi, Documenti; non equivale alla parità completa |
| Consultazione degli Account collegati | Incremento completato nella candidata | `054b045d`: apri/ritorna, mostra/nascondi/copia; stesso Account per più contatti, personale o aziendale |
| Verifica dell'incremento | Completata | Suite locale completa, 232 test shell finali, 126 verifiche Chrome/Edge; CI GitHub/Linux [run 34947029981](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/34947029981) riuscita su `054b045d` |
| Registrazione e pubblicazione Git | Completate per il codice | `054b045d` pubblicato in `integration/vault-shell-v127-security`, stessa bozza [PR #67](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/67) |
| Parità delle pagine nella shell | Aperta | Editor, creazione/cambio/dissociazione collegamenti, utenze, Widget, tessera digitale, profilo aziendale e restanti percorsi canonici |
| Preparazione offline completa della shell | Aperta | Il probe prepara le liste online; verificare l'avvio normale senza visita preventiva. Foto e byte allegati esclusi per decisione dell'utente |
| Collaudo fisico del nuovo candidato | Aperto | I risultati iPhone della produzione non sostituiscono le prove del nuovo ramo |
| Sostituzione della sessione produttiva e VS-P0-01 | Aperta | Completare parità, rimuovere il wrapping legacy nel percorso produttivo e collaudare migrazione/rollback |
| Gate specialistici M5–M10 | Restano quelli dei rispettivi contratti | Nessuna chiusura implicita per effetto dei test di questo incremento |

Produzione invariata alla 1.2.127: nessun nuovo bump, merge in master o deploy. Nessun dato reale letto o modificato dalle prove dell'incremento. Dettagli e limiti in [Audit Vault](./AUDIT_VAULT_SESSION_P0.md#account-collegati-al-profilo-nella-shell--15092026). Prossimo lavoro: completare la parità dei profili e dei collegamenti mantenendo il bootstrap unico, poi verificare i percorsi rimanenti e la preparazione offline prima del cutover.

Portare progressivamente Codici & Password alla qualità strutturale di un prodotto maturo, conservando tutte le funzioni utili, i dati esistenti, la compatibilità offline e le garanzie di sicurezza. Il piano non prevede una riscrittura totale non verificabile: definisce l'architettura che adotteremmo partendo oggi da zero e usa tale modello come destinazione della rifattorizzazione dell'app reale.

Il risultato è raggiunto soltanto quando ogni area possiede responsabilità chiare, contratti dati versionati, caricamento misurabile, comportamento offline definito, test automatici e una procedura di migrazione o rimozione delle implementazioni precedenti.

## 2. Terminologia crittografica reale

La Master Password e la Vault Key non sono la stessa cosa.

```text
Password account Firebase
  └─ autentica l'utente verso Firebase

Master Password della Vault
  ├─ verifica locale tramite Vault Verifier
  └─ deriva una KEK che apre il Vault Key Envelope

Vault Key casuale
  └─ protegge i dati cifrati della Vault
```

Nella fotografia iniziale, prima del completamento M1, la variabile `_masterKey` di `security-manager.js` contiene, dopo lo sblocco, la **Vault Key risolta** o il keyring di compatibilità; il nome è storico e ambiguo. I Vault nuovi ricevono già una chiave casuale generata da `generateVaultKey()`, protetta da `wrapVaultKey()`. Per i dati precedenti può esistere temporaneamente un fallback legacy nel keyring, necessario a leggerli senza una ricifratura non atomica.

Il possibile livello futuro non è “aggiungere una Vault Key”, perché esiste già. È valutare una **Data Encryption Key per record (DEK)**:

```text
Vault Key
  ├─ protegge DEK Account A
  ├─ protegge DEK Documento B
  └─ protegge DEK Scadenza C
```

Questo modello può facilitare condivisione, revoca e rotazione selettiva, ma aumenta complessità e non deve essere adottato senza prima dimostrarne la necessità, progettare la migrazione e testare rollback e compatibilità.

## 3. Prodotto esistente da preservare

- autenticazione Firebase, 2FA TOTP e codici di recupero;
- Master Password distinta dalla password dell'account;
- Vault Key, verifier, envelope e WebAuthn/PRF;
- profilo personale, contatti, indirizzi, documenti e tessera digitale;
- account privati e aziendali, memorandum e memorandum condivisi;
- aziende, dati bancari e allegati cifrati;
- scadenze, regole, email, notifiche Push e notifiche interne;
- rubrica destinatari condivisa tra scadenze e inviti;
- archivio, ricerca e Agente Codex locale;
- consultazione offline dei dati già sincronizzati;
- importatore OCR mantenuto isolato finché non supera i relativi gate.

Una fase non può essere dichiarata conclusa se elimina, altera o rende più lenta una di queste funzioni senza una decisione esplicita e documentata.

## 4. Modello tecnico di destinazione

### 4.1 Bootstrap e navigazione

- bootstrap pubblico minimo per login, registrazione e recupero;
- bootstrap protetto unico per autenticazione, Vault, componenti e routing;
- import dinamico esclusivo del modulo della pagina corrente;
- servizi accessori, Push e prefetch sempre non bloccanti rispetto al primo contenuto;
- redirect storici confinati e rimovibili tramite un registro di compatibilità.

### 4.2 Strati applicativi

```text
UI pagina
  → servizi di dominio
    → repository locale
      → sincronizzazione
        → Firebase

Sicurezza e cifratura attraversano gli strati tramite API centrali,
senza essere replicate nelle singole pagine.
```

- la UI non costruisce direttamente percorsi Firestore complessi;
- il dominio definisce Account, Azienda, Profilo, Scadenza, Condivisione e Notifica;
- il repository decide cache-first/server refresh;
- il motore di sincronizzazione gestisce versione, stato e conflitti;
- la cifratura riceve e restituisce dati attraverso contratti espliciti.

### 4.3 Componenti

- card, righe dati, modali, form field, selettori, switch, liste e stati vuoti condivisi;
- token CSS centrali e CSS di pagina limitato al solo layout specifico;
- accessibilità, target tattili, safe area e responsive verificati automaticamente;
- nessuna dipendenza UI caricata se non serve alla pagina corrente.

### 4.4 Dati e sincronizzazione

- schema versionato per ogni entità;
- migrazioni idempotenti e riprendibili;
- cache locale cifrata o affidata a contenitori il cui rischio sia documentato;
- stato `sincronizzato`, `in attesa`, `conflitto`, `errore` quando saranno abilitate scritture offline;
- aggiornamento incrementale e selettivo, non riscaricamento globale;
- cancellazione locale verificabile su logout, cambio utente e revoca dispositivo.

### 4.5 Condivisione

- risoluzione email → UID esclusivamente backend;
- autorizzazione Firestore distinta dalla consegna crittografica della chiave;
- inviti con stato, scadenza, revoca e audit minimo;
- modello permessi predisposto per `view`, `edit`, `manage`, anche se inizialmente viene concesso soltanto `view`;
- nessuna enumerazione degli utenti e nessuna esposizione di token dispositivo;
- studio formale dell'eventuale cifratura per-record prima di cambiare il formato attuale.

### 4.6 Continuità e recupero

- cestino recuperabile e cronologia essenziale;
- esportazione cifrata completa e ripristino verificato;
- Recovery Key valutata separatamente dai codici di recupero 2FA;
- Emergency Access soltanto con disegno zero-knowledge, tempo di attesa e revoca;
- nessuna backdoor server per la Master Password.

## 5. Confronto sintetico con prodotti maturi

| Area | Codici & Password oggi | Modello maturo da valutare |
|---|---|---|
| Vault | Vault Key casuale con envelope e compatibilità legacy | terminologia pulita, migrazione legacy conclusa e possibile DEK per record |
| Condivisione | inviti, UID e regole di accesso | consegna crittografica verificata, ruoli, revoca e audit |
| Offline | shell PWA, Firestore persistente e prefetch | repository local-first, conflitti e coda scritture espliciti |
| Prestazioni | metriche bootstrap e baseline statica | budget CI e misure runtime su dispositivi reali |
| Account | consultazione, copia e condivisione | salute credenziali, cronologia e possibile autofill separato |
| Recupero | recupero account/2FA e cambio Master Password | backup cifrato verificato, Recovery Key ed eventuale emergenza |
| Organizzazione | Privato, Azienda, memorandum, documenti e scadenze | contratti comuni senza perdere i domini specifici |
| Funzioni distintive | scadenze, veicoli, documenti, Push, AI locale e OCR sperimentale | conservarle come vantaggio del prodotto, subordinate ai gate core |

Riferimenti di confronto: [Bitwarden Security Whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/), [Bitwarden encryption](https://bitwarden.com/help/what-encryption-is-used/), [Proton Pass vault](https://proton.me/support/pass-vault), [Proton Pass sharing](https://proton.me/support/pass-browser-share), [KeePassXC documentation](https://keepassxc.org/docs/).

## 6. Programma di lavoro

### M0 — Baseline e congelamento dei contratti

- [x] inventario del repository e grafo dipendenze;
- [x] baseline statica per pagina con `npm run audit:pages`;
- [x] prima metrica runtime `private-page-bootstrap`;
- [x] catalogo delle funzioni visibili e dei percorsi dati in `FUNCTIONAL_DATA_CONTRACT.md`;
- [x] dataset di prova privo di segreti reali, protetto da test automatici;
- [x] budget statici e obiettivi runtime definiti; baseline reale iPhone/PC registrata in `RUNTIME_PERFORMANCE_BASELINE.md`.

**Uscita:** sappiamo misurare prima/dopo senza usare i dati personali come collaudo.

### M1 — Nomenclatura e contratti della Vault

- [x] rinominare gradualmente `_masterKey` in `vaultKeyMaterial` senza cambiare il valore;
- [x] documentare verifier, KEK, envelope, Vault Key, keyring legacy e session wrapping in `VAULT_KEY_CONTRACT.md`;
- [x] produrre l’inventario iniziale M1 in `ENCRYPTED_FIELD_INVENTORY.md`; l’estensione ai campi successivi e l’inventario reale restano aperti;
- [x] verificare il helper di pulizia della sessione; integrazione dei logout, blocco e conformità della persistenza restano aperti nell’audit Vault;
- [x] vietare il ritorno della variabile interna ambigua `_masterKey` tramite audit.

**Uscita:** nessuna ambiguità fra password e chiavi; nessuna migrazione dati in questa fase.

### M2 — Data access e repository local-first

- [x] sostituire le letture Firestore replicate con repository di dominio;
- [x] formalizzare cache-first e refresh in background in `DATA_ACCESS_CONTRACT.md`;
- [x] deduplicare richieste equivalenti nel perimetro già migrato;
- [x] rendere selettiva la sincronizzazione per pagina tramite le priorità di `offline-sync.js`;
- [x] definire conflitti prima di abilitare scritture offline in `OFFLINE_WRITE_CONFLICT_POLICY.md`.

M2 completata: i moduli applicativi usano il repository unico; richieste equivalenti sono coordinate senza introdurre una seconda cache permanente. Questa chiusura riguarda M2; il cutover successivo e limitato delle scritture è descritto in M6.

**Uscita:** le pagine non conoscono più i dettagli della cache o della rete.

### M3 — Rifattorizzazione delle pagine

Registro canonico e redirect di compatibilità formalizzati in `CANONICAL_PAGE_REGISTRY.md`; il gate automatico impedisce che le vecchie Home vengano trattate come pagine applicative.

Ordine iniziale determinato dalla baseline, corretto dal rischio funzionale:

1. [x] Profilo Utente unico;
2. [x] Area Privata e liste Account: letture parallelizzate, password lazy anche nei più usati e vista card/Swipe condivisa tra Privato e Azienda;
3. [x] Aggiungi/Modifica Scadenza: modelli destinatari/data/configurazione, controller destinatari/allegati/configurazione e servizio di persistenza estratti e testati; il form conserva soltanto orchestrazione e UI specifiche;
4. [x] Dettagli Account Privato e Azienda: modalità canoniche, renderer bancario e compatibilità legacy condivisi; allegati e condivisione isolati, con gate su campi sensibili, listener e revoca;
5. [x] Form Account Privato e Azienda: regole Account/Memorandum e renderer bancario condivisi; cifratura e transazioni di salvataggio isolate in servizi dedicati e protette da gate;
6. [x] Impostazioni e configurazioni: modello comune delle configurazioni Scadenze estratto e testato; canali Push riuniti in un controller condiviso e QR opzionale caricato fuori dal percorso critico; riordino visivo complessivo rinviato al post-M10;
7. [x] Aziende e archivio: letture archivio parallelizzate e isolate dalla vista, mutazioni Archivio/Aziende delegate a servizi dedicati, decifratura preventiva limitata al solo indice username; apertura allegati anagrafica azienda isolata e coperta dai gate di sicurezza;
8. [x] Home e pagine pubbliche: bootstrap pubblico minimo; presentazione protetta, inbox e dashboard Scadenze isolate dall’orchestratore Home e coperte da gate dedicati.

Per ogni pagina: baseline, mappa responsabilità, componenti condivisi, caricamento progressivo, test, confronto e rimozione del vecchio percorso.

**Uscita:** una sola implementazione canonica per funzione, senza suffissi di versione applicativi.

M3 completata: le pagine canoniche sono state separate in orchestratori, viste condivise e servizi di dominio dove necessario; i percorsi precedenti non sono più concorrenti e i gate impediscono il ritorno delle duplicazioni rimosse.

### M4 — Componenti e design system

- [x] estrarre componenti soltanto dopo almeno due utilizzi reali, secondo `UI_DESIGN_SYSTEM_CONTRACT.md`;
- [x] unificare card Account, righe sensibili, form field e stati di caricamento: viste Account e dati bancari condivise, campi base in `moduli.css`, stati di pagina accessibili in `ui-state-view.js`;
- [x] eliminare flash e discontinuità di header/footer durante scroll e overscroll: nebbia V2 e colore del canvas esterno approvati su iPhone, contratto strutturale verificato su Windows; la matrice estesa resta nel collaudo finale M10;
- [x] ridurre CSS duplicato senza aumentare il cascade globale: i due form Account usano un solo foglio canonico e gli stati pagina sono nel core condiviso;
- [x] completare l’infrastruttura i18n e l’accessibilità tecnica: stati asincroni, focus, target tattili, movimento ridotto e dialoghi sono coperti; revisione editoriale di tutte le lingue resta vincolata al post-M10;
- [x] applicare budget per font e icone: Manrope e Material Symbols restano locali, non bloccanti e protetti dal gate M4.

**Uscita:** UI coerente e più leggera, senza una libreria astratta sovradimensionata.

### M5 — Condivisione professionale

- [x] threat model completo del flusso proprietario/invitato;
- [x] verificare come il destinatario ottiene il materiale necessario alla decifratura;
- [x] confrontare ACL attuale e condivisione crittografica;
- [x] progettare ruoli, revoca, scadenza e cronologia;
- [x] prototipo isolato della chiave per-record, incluse ACL Firestore e Storage candidate in emulatore;
- [~] migrazione simulata soltanto su dataset fittizio; integrazione e copia non produttiva reale non avviate.

**Uscita:** autorizzazione e crittografia sono entrambe dimostrate end-to-end.

### M6 — Sincronizzazione e scritture offline

- [x] modello di revisione, coda cifrata, idempotenza e conflitti per il perimetro privato isolato;
- [x] prove del cutover registrate nel contratto M6;
- [ ] consultazione bancaria offline iPhone e matrice completa;
- [ ] fallback quando Web Locks non è disponibile e collaudi aggiuntivi dei dispositivi supportati.

**Uscita:** nessuna perdita o sovrascrittura silenziosa nel perimetro collaudato; estensione ad altri domini separata.

### M7 — Cronologia, cestino e audit

- [x] archivio e purge manuale implementati; distribuzione e collaudo storico del 09/09 registrati in M7;
- [x] audit tecnico e controlli di revisione/idempotenza nel perimetro implementato;
- [ ] politica di retention complessiva approvata e verificata su dati, allegati e backup.

**Uscita:** recupero e cancellazione verificabili; il collaudo storico non chiude la decisione sulla retention.

### M8 — Backup e recupero

- [x] formato v2 cifrato, Recovery Key distinta, integrità e anteprima implementati;
- [x] distribuzione e prova di recupero riuscita su account di prova registrate il 09/09 in M8;
- [ ] gestione completa delle interruzioni fra blocchi e allegati;
- [ ] rispondenza al requisito di staging e ripresa/rollback su copia non produttiva;
- [ ] limiti di memoria e matrice fisica completa.

**Uscita:** recupero dimostrato anche in errore. Emergency Access resta separato e non attivato.

### M9 — Salute credenziali e integrazioni

- [x] analisi locale e UI su richiesta implementate, con collaudo iPhone registrato il 10/09;
- [ ] collaudo Windows;
- [ ] provider violazioni, privacy e consenso prima di qualsiasi attivazione di rete;
- [x] passkey di servizio e autofill esterno distinti dallo sblocco Vault e dalla PWA.

**Uscita:** nessuna integrazione riduce la sicurezza o appesantisce il bootstrap.

### M10 — Hardening e rilascio maturo

- [~] checklist tecnica e threat model consolidati; revisione OWASP finale e audit indipendente ancora richiesti;
- [~] dipendenze, CSP, App Check e Rules coperti da gate statici/emulatori; verifica in produzione ancora richiesta;
- [ ] test end-to-end su iPhone, Windows e browser supportati;
- [ ] audit esterno indipendente quando il modello crittografico è stabile;
- [~] procedura di recupero e risposta agli incidenti aggiunta; guida utente e revisione privacy finali ancora richieste.

**Uscita:** release candidata documentata, misurata e ripristinabile.

### Attività conclusiva dopo M10 — Lingue, Impostazioni e campi protetti

Questa attività è un promemoria vincolante, ma **non deve essere anticipata durante le fasi M0–M10**. Una volta completato l’intero programma di maturazione:

- riesaminare tutte le lingue e tutte le stringhe dell’app;
- completare e uniformare le traduzioni, eliminando testi mancanti, duplicati o incoerenti;
- verificare terminologia, maiuscole, messaggi di errore, accessibilità e adattamento dei testi su mobile;
- riesaminare integralmente la pagina **Impostazioni**;
- riordinare card e comandi in gruppi logici, coerenti e facilmente riconoscibili;
- eliminare eventuali doppioni soltanto dopo averne verificato utilizzo e collegamenti;
- censire in tutte le pagine ogni campo che presenta il lucchetto o un comando per occultare e mostrare dati sensibili;
- verificare manualmente che ciascun lucchetto sia attivo e che nasconda il valore all'apertura, lo mostri soltanto su richiesta e torni a occultarlo correttamente;
- controllare i campi protetti sia in visualizzazione sia nei form di inserimento e modifica, su account privati e aziendali;
- registrare eventuali campi con icona presente ma comportamento assente, incoerente o non accessibile e correggerli prima della chiusura post-M10;
- collaudare il risultato su iPhone, PC e in tutte le lingue supportate.

**Uscita:** lingue coerenti, pagina Impostazioni organizzata definitivamente per gruppi e tutti i campi sensibili realmente protetti da lucchetti funzionanti, dopo la stabilizzazione tecnica M0–M10.

## 7. Regole di esecuzione

1. Una sola fase strutturale attiva per volta; correzioni urgenti possono essere isolate.
2. Nessun cambio di formato dati senza lettore retrocompatibile, backup e rollback.
3. Nessuna funzione viene rimossa perché “sembra inutilizzata” senza prova da runtime, riferimenti e test.
4. Ogni rifattorizzazione deve ridurre o mantenere peso, richieste e tempo; un aumento richiede motivazione.
5. Nessun dato sensibile nei log, nelle metriche o nei dataset di prova.
6. Commit piccoli e tematici; push e deploy soltanto dopo suite verde e autorizzazione.
7. Le implementazioni precedenti vengono eliminate soltanto quando il percorso canonico supera tutti i gate.
8. AI, OCR e funzioni accessorie non entrano nel percorso critico di apertura.

## 8. Stato di avanzamento

| Fase | Stato |
|---|---|
| M0 | completata il 06/09/2026 |
| M1 | completata il 06/09/2026 |
| M2 | completata il 06/09/2026 |
| M3 | completata il 06/09/2026 |
| M4 | completata l'08/09/2026; matrice estesa di regressione trasferita a M10 |
| M5 | laboratorio e architettura completati; attivazione reale subordinata a collaudo fisico, M6, M8 e approvazione |
| M6 | cutover privato isolato attivo; consultazione bancaria iPhone e matrice completa aperte |
| M7 | funzioni e collaudo storico registrati; retention complessiva non approvata |
| M8 | runtime e collaudo riuscito registrati; interruzioni, staging e recupero complessivo non certificati |
| M9 | analisi locale attiva e iPhone collaudato; Windows e provider di rete aperti |
| M10 | attiva: gate statici e procedura incidenti presenti; restano verifiche reali, matrice fisica e audit indipendente |
| Post-M10 | revisione lingue, riordino della pagina Impostazioni e collaudo completo dei campi protetti dal lucchetto |

Questo documento è la fonte principale del programma di maturazione. `GUIDA.md` è la guida implementativa subordinata alla baseline sicurezza e ai contratti specialistici; `GUIDA_AGGIORNAMENTI.md` registra decisioni e avanzamento delle release.

## Avanzamento strutturale successivo — 12/09/2026

La richiesta del product owner di proseguire fino alla fine del programma autorizza l’implementazione autonoma dei blocchi ordinari; non chiude i gate specialistici e non autorizza implicitamente migrazioni distruttive, modifiche della baseline o rilascio in produzione. Le chiusure M0–M4 della tabella precedente restano storiche e non equivalgono alla risoluzione dei finding dell’audit successivo.

Fase strutturale attiva: risoluzione del P0 di sessione Vault attraverso navigazione persistente. Dopo prototipo, compatibilità crittografica su fixture e quattro prove iPhone riferite dal product owner, sono stati adattati i due orchestratori delle liste e montati nel laboratorio in sola lettura. Ultima suite locale: 364 test; anteprima: quattro test aggiuntivi. [Evidenze e limiti](./AUDIT_VAULT_SESSION_P0.md#18-orchestratori-canonici-nel-laboratorio--12092026).

Ordine operativo successivo: integrare identità e ciclo Vault nel percorso persistente; completare routing e pagine con scritture/condivisioni; verificare regressioni e dati legacy prima del cutover. In seguito riprendere i gate specialistici M5–M10 e post-M10, preservando le dipendenze indicate nei contratti. Restano decisioni/prove esterne: retention M7, ambiente non produttivo per recupero, dispositivi, configurazioni remote e audit indipendente. Nessuna percentuale globale o data di maturità definitiva viene dedotta dai soli test automatici.

Aggiornamento del blocco attivo, 12/09/2026: nel laboratorio il coordinatore collega identità, sessione Vault e lettori delle viste, con invalidazione su cambio UID e logout. Tredici nuove prove coprono anche la compatibilità v2 tramite il vero modulo crittografico su fixture. Il bootstrap Auth remoto e i flussi di salvataggio restano aperti. [Audit §19](./AUDIT_VAULT_SESSION_P0.md#19-coordinamento-identità-vault-e-viste--12092026).

Aggiornamento del blocco attivo, 12/09/2026: il coordinatore è collegato agli SDK Auth/Firestore e al lettore v2 in una prova locale riproducibile con utenti fittizi. Undici test emulati superati. Il passaggio successivo resta l’integrazione UI/repository/routing e scritture della shell; l’emulatore non certifica Firebase pubblicato, MFA, App Check o PWA sul dispositivo. [Audit §20](./AUDIT_VAULT_SESSION_P0.md#20-sdk-firebase-e-sessione-protetta-in-emulatore--12092026).

Aggiornamento del blocco attivo, 12/09/2026, base `83dffc30`: disponibile la UI locale con SDK Firebase emulati, accesso/sblocco separati e letture private/aziendali cifrate. Verificati nel browser due utenti e refresh senza persistenza. Restano integrazione delle pagine canoniche e repository, scritture e condivisioni. [Audit §21](./AUDIT_VAULT_SESSION_P0.md#21-interfaccia-browser-degli-emulatori--12092026).

Ulteriore avanzamento locale, 12/09/2026: liste canoniche private/aziendali collegate al repository reale negli emulatori, con lettura per vista e password su richiesta. Prove browser Windows su ricerca, ordinamento, blocco e due identità riuscite; scritture, dettagli, condivisioni e cutover restano aperti. [Audit §22](./AUDIT_VAULT_SESSION_P0.md#22-liste-canoniche-e-repository-negli-emulatori--12092026).

Avanzamento locale base `70a6c4c5`, 12/09/2026: dettaglio base di sola lettura nella shell emulata, riuso del renderer canonico e ritorno alla ricerca/ordinamento mantenuti in RAM. Non sono migrati gli orchestratori completi dei dettagli: scritture, widget, allegati, condivisioni e cutover restano aperti. [Audit §23](./AUDIT_VAULT_SESSION_P0.md#23-dettaglio-base-protetto-e-ritorno-alla-lista--12092026).

Avanzamento locale base `755c68ed`, 12/09/2026: dettaglio con note e URL cifrati, identità Firestore autorevole nel repository, protezioni readonly azienda e allineamento delle azioni del dettaglio privato dopo lookup legacy. Prima del cutover resta da verificare la compatibilità di allegati/widget eventualmente persistiti sotto alias. [Audit §24](./AUDIT_VAULT_SESSION_P0.md#24-identità-dei-record-e-campi-aggiuntivi-del-dettaglio--12092026).

Avanzamento P0, base `b792b1c0`: preparazione di modifiche cifrate nella sessione in RAM. Nessun salvataggio UI attivato; integrazione del writer M6, controlli sulle relazioni e compatibilità di schema rimangono passi successivi. [Audit §25](./AUDIT_VAULT_SESSION_P0.md#25-preparazione-cifrata-delle-modifiche-nella-sessione-in-ram--12092026).

Avanzamento P0 base `6432cad8`: preparazione del payload M6 e prova locale di salvataggio tramite transazione originale. UI, isolamento autorevole e gestione degli esiti dopo invio restano da integrare. [Audit §26](./AUDIT_VAULT_SESSION_P0.md#26-preparazione-m6-e-transazione-originale-su-dati-emulati--12092026).

Avanzamento P0 base `1b6a13ed`: gestione dell’esito incerto in RAM e collaudo del retry. La provenienza dei risultati non è garantita dalle Rules correnti: correggere namespace degli esiti e legame risultato/operazione prima del salvataggio UI; integrazione della coda canonica ancora aperta. [Audit §29](./AUDIT_VAULT_SESSION_P0.md#29-esito-incerto-retry-e-verifica-del-salvataggio--12092026).

Avanzamento candidato base `a795b462`: nuovo namespace backend degli esiti e legame del retry con l'operazione validata. Gli esiti storici non vengono convertiti automaticamente; recupero delle code pregresse, integrazione UI e rilascio restano gate separati. [Audit §32](./AUDIT_VAULT_SESSION_P0.md#32-provenienza-e-identità-degli-esiti-di-salvataggio--12092026).


## Consolidamento candidato — 13/09/2026

La matrice delle fasi non cambia per il solo aumento dei test. Il ramo sperimentale aggiunge isolamento dei dettagli Account e dell'Archivio durante cambio sessione, proprietario atteso nelle mutazioni, ricevute server attendibili per M6/backup/purge e confronto transazionale del backup con l'anteprima. La ripresa esplicita di backup e Archivio conserva gli identificatori nella stessa sessione. Ultimo checkpoint: 873 test nella suite completa, incluse transazioni Scadenza/Profilo e backup nel database emulato. [Audit §50](./AUDIT_VAULT_SESSION_P0.md#50-transazioni-scadenze-e-prerequisiti--candidata-13092026).

Restano aperti journal durevole, staging/compensazione e memoria aggregata del backup, concorrenza globale purge/ripristino, riferimenti widget/grant residui, fallback M6 senza Web Locks, integrazione delle viste complete nella shell, prove sui dispositivi, retention e distribuzione strutturale. Lease IndexedDB e planner dei riferimenti Archivio sono preparati e testati, ma non collegati al runtime: non chiudono i rispettivi gate. Nessuna fase M5–M10 è chiusa da questo checkpoint e nessun deploy di questi blocchi è stato eseguito.

## Consolidamento dei rami — 13/09/2026

Candidata integrata 1.2.118, codice `4a431ec3`: preservato il checkpoint sperimentale `3660a838` e aggiunta la UI Account fino a `d2ef897e`; cronologia master 1.2.117 ricongiunta nel solo ramo di integrazione. Suite completa: 887 test superati. L'integrazione non chiude ulteriori fasi: rimangono i limiti del programma già registrati, i collaudi fisici e la distribuzione separata. [Audit §51](./AUDIT_VAULT_SESSION_P0.md#51-integrazione-account-ui-e-vault--candidata-13092026).

## Ripresa dopo i rilasci UI 1.2.121 — 13/09/2026

Il ramo `experiment/vault-shell-v121` conserva il candidato Vault e integra `origin/master` fino a `6fc3546e`, attraverso il merge `e2edd2b9`. Sono preservati i Widget specifici di ogni banca, il loro ordine prima delle carte e le protezioni di sessione; alla chiusura vengono rimossi anche i Widget montati nei contenitori bancari esterni.

M6 avanza con un coordinatore sperimentale comune a Web Locks e fallback IndexedDB. Non è ancora collegato alla coda dell'app e non chiude il gate. Il prossimo passo richiede protocollo di aggiornamento dello store e compatibilità delle vecchie copie PWA, prima dell'attivazione. Restano inoltre aperti i lavori M7/M8, shell completa, prove fisiche e distribuzione strutturale già elencati. La produzione 1.2.121 contiene i rilasci UI/bancari; non contiene questi nuovi controlli Vault.

## Avanzamento autonomo M6–M9 — 13/09/2026

Base iniziale `5b3cd4da`, codice finale di questo blocco `f47a55c9`. I rami sottostanti sono checkpoint **in sequenza**, ciascuno discendente del precedente: non sono sei implementazioni divergenti da fondere separatamente. Il ramo `experiment/vault-shell-v121` raccoglie l'insieme dopo verifica.

| Area | Passaggio completato | Commit |
|---|---|---|
| M6 | Chiusura connessioni, apertura annullata/bloccata e timeout, senza upgrade runtime | `b4bec892` |
| M8 | Limiti cumulativi dell'anteprima e messaggio dedicato | `44c7f077` |
| M6 | Sei prove reali IndexedDB/Web Locks in Chrome ed Edge headless, profili temporanei | `5fa297ab` |
| M8 | Identità fisiche e duplicati anche fra chunk | `0586aa63` |
| M9 | Invalida analisi/dialoghi su blocco, cambio utente e pagehide; etichette aziendali distinte | `4fba54e7` |
| M7 | Ripristino CAS, messaggi di conflitto e transazioni emulatore | `f47a55c9` |

### Lavori tecnici ancora aperti

- **M6:** lettore compatibile col futuro schema, upgrade dello store, integrazione del lease in tutte le scritture della coda e gestione delle copie PWA precedenti. Il test reale conferma che il lettore v1 rifiuta lo schema 2: non cancellare il database per aggirarlo.
- **M7:** protocollo condiviso fra purge/ripristino, writer Account/Widget/link/inviti, Rules e backup; solo dopo collegare il planner dei riferimenti residui.
- **M8:** journal durevole, staging/compensazione e collaudi della memoria effettiva sui dispositivi. Le soglie limitano i dati ammessi ma non misurano lo heap.
- **Shell e M5:** viste complete e integrazione dei flussi di scrittura/condivisione, compatibilità del formato e gate crittografici.

### Passaggi che richiedono decisioni o verifiche esterne

Restano le decisioni prodotto della baseline (fra cui retention e recupero), audit indipendente, matrice fisica dei dispositivi e approvazione della distribuzione coordinata. Questi passaggi non impediscono di continuare i lavori tecnici su rami sperimentali. Non sono concessi implicitamente da commit/push o dal superamento dei test. Nessuna fase viene marcata completa da questo blocco e la produzione resta 1.2.121.

## Riallineamento alla produzione 1.2.124

La PR #58 è unita in master 9e5335d9; Hosting è già 1.2.124. Il ramo experiment/vault-shell-v124 integra le note 1.2.122–124 nel ciclo Vault sperimentale, mantenendo i blocchi M6–M9 già consolidati. Suite completa superata. Ripresa tecnica da compatibilità del lettore della coda; restano i gate già elencati, senza nuovo deploy strutturale.


Avanzamento M6 successivo: disponibile in laboratorio il lettore compatibile degli schemi 1 e 2, senza upgrade o scritture. Undici scenari browser superati in Chrome e Edge, con dati sintetici. Il recupero in lettura è un prerequisito; integrazione delle mutazioni, distribuzione preparatoria e collaudi fisici restano aperti. Il programma non è concluso.

M6: aggiunto nel laboratorio il collegamento di tutte e quattro le mutazioni della coda cifrata al coordinatore ibrido, con confronto transazionale e protezione dal vecchio titolare. Sedici scenari browser passati su Chrome ed Edge, oltre alla suite offline esistente. Restano collegamento al client completo e rollout dello schema; nessun cutover o deploy.

M6: client di laboratorio collegato al sincronizzatore canonico, con conferme protette dal lease e conservazione dei retry. Ventidue scenari passati su Chrome/Edge e 59 test offline; backend simulato, integrazione Firebase emulata e attivazione UI ancora da completare. Nessuna nuova fase chiusa.

M6: collaudato il collegamento browser IndexedDB–handler applyOfflineMutation originale–Firestore emulato. Cinque scenari passati in ciascuno di Chrome/Edge: applicazione, retry, conflitto, riuso ID e proprietario errato. Restano percorso privato completo, trasporto/Auth/App Check, UI e rollout. Nessun deploy.

M6: esteso il collaudo browser al backend Account privato originale, inclusi riferimenti inversi Profilo/Azienda e retry dopo collegamento. Otto scenari privati più cinque generici passati in Chrome e Edge. Il collegamento UI e il rollout restano aperti; nessuna fase dichiarata conclusa.

M6 UI: pannello note candidato con coda offline e retry collaudato in DOM reale/backend emulato. Dettaglio shell predisposto tramite provider opzionale sotto lifecycle; provider non ancora attivato nell’entry principale. Trentadue esecuzioni browser e 31 test vista/sessione superati. Restano attivazione controllata, aggiornamento dettaglio, recupero conflitti e rollout.

M6: rinnovo opzionale del controllo della coda durante invii lunghi, con arresto alla chiusura. Verificati 24 scenari per browser e 73 test offline. Provider della shell, trasporto autenticato e rollout restano aperti; nessun deploy e nessuna fase globale dichiarata conclusa.

M6 UI: conferma della singola operazione e callback di rilettura separato dal risultato di scrittura. Gestiti altri Account nella coda, refresh fallito e chiusura della vista. Verificati 79 test offline e 32 esecuzioni browser/backend emulato; attivazione nella shell e rollout ancora aperti.

M6 UI: dettaglio predisposto per rilettura protetta dopo conferma, senza ricaricare il documento. Verificati errori e risposte tardive; 155 test shell e npm test completo superati. L'integrazione effettiva del provider nel bootstrap, trasporto autenticato, recupero conflitti e rollout restano da completare.

M6 conflitti: implementata nel candidato la scelta confermata di scartare la propria modifica locale mantenendo i dati online. Verificati annullamento, identità, lease e dati backend invariati. Restano confronto/riproposizione locale e attivazione completa; la fase M6 non è conclusa.

M6 conflitti: aggiunto confronto read-only nota locale/online con provider esplicito e cancellazione del testo dalla vista su chiusura. Test offline e browser/backend emulato passati. Riproporre la modifica sulla revisione aggiornata e recuperare le code da una nuova sessione restano attività aperte; nessuna fase globale chiusa.

M6 conflitti: preparatore della riproposizione della sola nota implementato e verificato, con conferma e revisione fissata al confronto. Restano collegamento UI, sostituzione della coda e collaudo integrato backend; nessun nuovo gate globale chiuso.

Aggiornamento PR #59, audit 68: collegamento UI, replace transazionale e collaudo backend della riproposizione note completati nel candidato e verificati localmente con Chrome/Edge ed emulatori. Suite completa superata. Setup Linux revisionato e provato con fixture; installazione effettiva cloud ancora da verificare. Prossimi gate M6: recupero della coda dopo riapertura, provider protetto del bootstrap, trasporto autenticato e rollout. Shell persistente confermata come direzione scelta; nessun ritorno al wrapping della Vault Key in sessionStorage, nessuna fase globale dichiarata conclusa.


### Collaudo cloud finale — 14/09/2026

Toolchain e Firestore reali presenti; fixture setup superata. Emersi due soli prerequisiti container: cache Storage assente dalla fase setup e avvio browser root senza flag dedicato. Le correzioni candidate precaricano Storage con la CLI bloccata e applicano `--no-sandbox` soltanto a Linux root; il runner corretto passa su entrambi i browser. La rete disattivata impedisce in questa fase di scaricare il JAR mancante e quindi di certificare la suite completa; nessun altro gate M6 viene anticipato.


### Chiusura del trasferimento Linux cloud — 14/09/2026

Sul nuovo ambiente basato su `3070d01d` sono stati verificati Chrome, Edge, Java e i JAR Firestore/Storage; fixture setup, suite completa e 34 esecuzioni fenced-browser sono passate dopo una sola correzione locale al runner Storage per instradare direttamente soltanto gli host loopback esatti fra emulatori e conservare il proxy originale per ogni altra destinazione. Il collaudo del trasferimento cloud è concluso con fixture sintetiche e progetti demo, senza account o servizi reali.

Lo stato di maturità M6 non cambia: shell persistente e Vault Key solo in RAM restano la direzione scelta, mentre provider bootstrap, trasporto autenticato/App Check, recupero delle code dopo riapertura, rollout e prove fisiche sono gate aperti. Nessun gate è chiuso dal solo trasferimento dell’ambiente e nessuna modifica è stata distribuita.

Ripresa M6 su `b5ab595c`: recupero candidato della nota da una coda riaperta, con sola identità restituita alla vista e ripresa esplicita senza nuova operazione. Test DOM e Chrome/Edge con IndexedDB chiuso/riaperto e backend emulato passati. È avanzato il recupero nel laboratorio; provider bootstrap, riapertura fisica PWA, trasporto e rollout restano aperti. Nessuna fase globale conclusa.

M8, audit 72: esportazione e finestra Recovery Key ora vincolate alla sessione del proprietario, con arresto dopo Vault lock/cambio utente e protezione dalle risposte tardive. Suite completa e prove mirate superate sul ramo experiment/m8-export-session. Restano limiti aggregati export, staging, journal durevole, compensazione e collaudi fisici; nessuna fase globale conclusa.

M8, audit 73: limitato il buffer delle righe cifrate nel download alternativo Blob; overflow interrompe prima di creare un file parziale. 90 test backup e controlli statici superati. Raccolta iniziale, memoria reale sui dispositivi, staging e journal restano aperti; nessuna chiusura globale.

M8, audit 74: anche i descrittori raccolti dall'export hanno soglie cumulative coerenti con l'import, con errore esplicito prima di proseguire. 93 prove backup superate. Snapshot SDK, paginazione, manifest percorsi e memoria fisica restano distinti dai limiti implementati; staging/journal ancora aperti.

M6, audit 75: chiusura esplicita del writer, rilascio dei riferimenti crittografici e arresto dei callback sospesi; 106 test offline e 44 esecuzioni browser/backend demo superati. Si rafforza il candidato, senza anticipare provider, trasporto, rollout o collaudo fisico.

M9, audit 76: corretta navigazione da tastiera dell'elenco e del dialogo; 20 test UI, CSS e suite completa finale superati. Questo non sostituisce Windows/Narrator o altri dispositivi fisici. Provider esterno ancora disattivato.

M6, audit 77: disponibile l'adattatore fenced per i callable Firebase canonici, con durata vincolata a UID e Vault/vista. Verificato con SDK, Auth e Firestore demo in Chrome/Edge: 52 esecuzioni, compreso abort dopo commit e retry senza riscrittura. 113 test offline e suite completa superati. App Check nel bridge è sintetico; bootstrap, attestazione/middleware remoti, rollout e matrice fisica restano gate distinti.

M6, audit 78: completata la proprietà della coda nel Vault della shell e il passaggio al factory Firebase senza chiavi nelle route. Suite completa superata, 165 test shell, 15 test Firebase e 52 esecuzioni Chrome/Edge demo. Sono ancora da collegare provider UI circoscritto al record ed entry principale; rollout e verifiche remote/fisiche restano separati.

M6, audit 79: provider candidato della nota privata collegato alla coda della shell, con controllo del record e observer revocabili. Suite completa superata, 178 test shell finali e 52 esecuzioni browser della catena esistente; nuovo provider provato in fixture/DOM simulato. Resta da attivarlo nell'entry tramite lettore fidato con evidenza dei collegamenti inversi e verificarlo nel browser; rollout e collaudi remoti/fisici non sono chiusi. Una nota recuperata senza provenienza durevole consente confronto, non riproposta automatica.

M6, audit 80: aggiunto lettore fidato dei profili con SDK server e policy backend condivisa, collegato al provider nella prova browser. La prima apertura richiede rete e al massimo 200 aziende; oltre tale limite non viene certificata l'assenza di link. Restano collegamento dell'entry, apertura offline iniziale, rollout e prove remote/fisiche. Si continua nella stessa PR #63, senza altri rami o deploy.

Validazione finale audit 80: npm test completo superato (183 test shell e 114 offline inclusi); Chrome/Edge superati, 9 scenari generici e 20 privati per browser, 58 esecuzioni totali. Compresi lettore Firebase reale, blocco dei link inversi e salvataggio del provider. App Check resta sintetico e il laboratorio principale non è ancora attivato.

M6, audit 81: entry del laboratorio collegata al provider per la fixture privata compatibile, trasporto solo loopback e nessun upgrade delle code esistenti. Corretto il refresh da cache dopo salvataggio usando il repository confermato. Account incompatibili restano consultabili. Restano apertura iniziale offline, rollout schema/PWA, compatibilità estesa e collaudi remoti/fisici; produzione invariata.

Validazione finale audit 81: suite completa npm test superata, inclusi 189 test shell e 114 offline. Regressioni Chrome/Edge della coda: 58 esecuzioni superate. Nuovo collaudo dell'entry: 5 verifiche per browser, 10 esecuzioni superate (68 totali). Dopo le ultime guardie di chiusura, rieseguiti i 21 test mirati di coda/dettaglio e il collaudo dell'entry. Nessuna prova App Check remota o su dispositivo fisico.

M6, audit 82: recupero della coda disponibile senza nuove letture server, verificato con rete DevTools disabilitata e ripristinata. Include blocco/sblocco offline nella sessione già autenticata e cache popolata. Nessun nuovo editor o comando ricreato nel recupero; retry esplicito al ritorno online. Restano avvio a freddo, riapertura fisica PWA, rollout schema, compatibilità estesa e collaudi remoti/fisici. Si continua nella stessa PR #63.

Validazione finale audit 82: npm test completo superato, inclusi 191 test shell e 116 offline. Chrome/Edge: 58 regressioni coda/provider e 18 verifiche dell'entry (9 per browser), 76 esecuzioni totali. La rete viene disabilitata dal protocollo DevTools, con HTTP effettivamente bloccato; superati recupero, nuovo sblocco offline e retry al ritorno online. Questa prova non certifica avvio a freddo o PWA fisica.

M6, audit 83: ampliata la matrice di consultazione dei dati già caricati e corretta la password collegata nei profili, che richiedeva sempre il server. La prova ora copre repository/cache e decifratura di Account, profili, banca, widget profilo, scadenze e metadati allegati. Non equivale a tutte le schermate offline: restano avvio a freddo, byte Storage, foto/QR, Widget Account/condivisioni, preparazione deterministica completa e gate iPhone. Nessuna certificazione generale dell'offline.

Validazione finale audit 83: npm test completo superato (inclusi 191 test shell, 116 offline e 65 test dei collegamenti dei profili). Collaudo entry su Chrome ed Edge: 25 verifiche per browser, 50 esecuzioni superate, con rete DevTools disabilitata e ripristinata. Questa matrice certifica letture dei dati sintetici già caricati nella sessione del laboratorio, non avvio a freddo, tutte le UI o file Storage offline.

### Audit 84 — ciclo online/offline e blocco della consultazione (14/09/2026)

Base 2dc18daa, stessa PR #63. Il collaudo dell'entry verifica esplicitamente che la matrice dei dati già caricati sia ancora consultabile dopo il ritorno online e che il probe protetto rifiuti la lettura dopo blocco del Vault, sia offline sia online. Chrome ed Edge: 28 verifiche per browser, 56 esecuzioni superate con emulatori e fixture locali. Modifica limitata al collaudo: nessun cambiamento runtime produttivo. La suite completa resta quella superata sul checkpoint precedente; non viene dichiarata rieseguita in questo incremento.

Programma: avanzamento della verifica M6, senza chiusura globale. Restano avvio a freddo/cache persistente, file Storage, copertura delle UI e compatibilità estesa, rollout e prove fisiche/remoti. M8 conserva staging/journal e verifiche memoria/dispositivi; M9 conserva le prove fisiche di accessibilità. Nessun master, versione o deploy.

M6, audit 85: superato il ricaricamento offline del laboratorio con cache Auth/Firestore persistente e nuovo sblocco obbligatorio (44 verifiche Chrome/Edge). La matrice dei dati caricati resta consultabile; logout la blocca. Avvio da processo terminato, PWA fisica, cache completa/eviction e Storage restano aperti. Nessuna fase globale chiusa, master o deploy.

Validazione finale audit 85: npm test completo superato, inclusi 194 test shell e 116 offline. Nuovo collaudo persistente: 44 esecuzioni Chrome/Edge superate; regressione entry ordinaria: 56 esecuzioni superate, 100 verifiche browser complessive nei due collaudi. Nessuna certificazione di chiusura processo, riavvio dispositivo o PWA produttiva.

M6, audit 86: riavvio controllato del processo browser con rete bloccata prima della navigazione superato nel laboratorio (46 verifiche Chrome/Edge). Il Vault richiede nuovamente la Master Password. Restano arresto forzato/dispositivo, PWA fisica, cache completa/eviction, Storage e rollout. Nessuna chiusura globale del programma o deploy.

Validazione finale audit 86: npm test completo superato (194 test shell e 116 offline inclusi). Chrome/Edge: 46 verifiche del riavvio processo, 44 del reload e 56 dell'entry ordinaria, 146 esecuzioni complessive superate. Nessun test su dispositivo fisico o dati reali; nessun deploy.

M6, audit 87: arresto forzato del browser dopo conferma della nota accodata offline, nuovo sblocco, recupero e retry online superati su Chrome/Edge Windows (50 verifiche). Restano transazioni in volo, dispositivo/PWA fisica, eviction, Storage e rollout; nessuna fase globale chiusa.

Validazione finale audit 87: npm test completo superato (194 test shell e 116 offline inclusi). Chrome/Edge Windows: 50 verifiche arresto forzato/nota pendente, 46 riavvio controllato, 56 entry ordinaria e 44 reload; 196 esecuzioni browser superate. Percorso Linux di terminazione non collaudato in questo incremento. Nessun test su dati reali o deploy.

M6, audit 88: la prova utente su PWA iPhone 1.2.124 non supera Home → modalità aereo → lista. Corretto nel candidato il refresh Auth obbligatorio offline del bootstrap reale, distinto da quello del laboratorio; 7 regressioni dedicate. Gate fisico ancora aperto, retest necessario dopo pubblicazione autorizzata. Nessuna fase globale chiusa o deploy.

Validazione finale audit 88: npm test completo superato, inclusi 88 controlli statici sicurezza, 11 test security (7 nuovi sul bootstrap), 194 test shell e 116 offline. Inventario aggiornato e controllo whitespace superato. I 196 scenari browser dell'audit 87 non sono stati rieseguiti né attribuiti a questa modifica del bootstrap produttivo; retest iPhone ancora necessario dopo rilascio autorizzato.

## Rilascio isolato iPhone 1.2.125 — 15/09/2026

PR #64 unita in master 263355f261c0fe0661089e2c65782edf1d13527a; release 6b36ae2d, backport isolato del controllo Auth offline. npm test locale e workflow GitHub 34931928458 superati. Deploy Hosting completato; verificati via HTTP gli hash di Home, env-v126.js, sw.js e main-v129.js rispetto al rilascio testato. Functions, Rules e dati non distribuiti/modificati. Prova iPhone Home → modalità aereo → lista ancora da ripetere dopo aggiornamento alla 1.2.125.

La PR #63 resta sperimentale e separata: non è stata unita o distribuita. Prima di un suo futuro rilascio occorre riallinearne la base/versione al nuovo master; non distribuire direttamente il vecchio numero 1.2.124 del ramo. Il programma generale e i gate fisici restano aperti.

### Audit 89 — profilo nella preparazione offline e messaggi di lettura (15/09/2026)

Base db329bee, stessa PR #63. La preparazione già prevista delle raccolte non includeva esplicitamente il documento principale users/{uid}. Ora lo legge online insieme alle priorità della pagina; la cache resta quella Firebase e la Vault Key resta in memoria. I marker precedenti senza profileIncluded non saltano il nuovo caricamento. Documento assente o lettura fallita non attestano completezza. Il gestore condiviso comunica l'indisponibilità offline solo per codici di connettività, preservando i fallimenti di permessi/autenticazione/decifratura. Integrato nelle pagine principali di profilo, liste aziende/Account e dettagli Account; dati aziendali non falliscono più soltanto nel log.

npm test completo superato; sei nuove regressioni eseguono il preparatore reale con server/cache simulati e verificano la classificazione degli errori. Nessuna estensione alle scritture o certificazione degli allegati. Prove riferite dall'utente su iPhone 1.2.125: dati già caricati leggibili anche dopo chiusura/riapertura e nuovo sblocco; profilo prima non visitato falliva, poi leggibile dopo visita online. Nuovo candidato ancora da distribuire e collaudare fisicamente. Master e versione invariati.

### Audit 90 — Widget Account e credenziali comuni offline (15/09/2026)

Base 9f769aab, stessa PR #63. Su richiesta dell'utente la verifica riguarda Widget Account e credenziali comuni; foto e byte degli allegati sono esplicitamente esclusi dal requisito di consultazione offline, per evitare carichi eccessivi nella cache. Non chiedere il loro caricamento offline come condizione per chiudere questo requisito. L'utente intende mantenere la sessione autenticata (nessun logout), anche chiudendo e riaprendo l'app.

Riscontro: i componenti di consultazione già leggono accountWidgets e sharedVaultData tramite il repository con cache e decifrano localmente dopo sblocco. Queste due raccolte mancavano però dalla preparazione automatica. Ora sono incluse; un nuovo marker widgetsIncluded impedisce che il precedente stato completo salti il caricamento. Un fallimento di una delle due mantiene la preparazione incompleta. I riferimenti condivisi usati nelle schede Account risiedono in accountWidgets; non occorre scaricare file Storage.

Validazione: test:data-access, test:offline, test:js-syntax e controllo whitespace superati. Sette nuove regressioni: tre sulla preparazione (inclusione senza visita, fallimento di ciascuna raccolta) e quattro sulla UI reale eseguita in ambiente simulato, con letture server vietate offline, per Widget/credenziali e Account personali/aziendali. Verificati rendering, rivelazione del valore e rimozione al blocco; zero scritture. Crittografia nei test UI simulata: non attribuire una nuova prova fisica iPhone o end-to-end a questi risultati. La suite completa era passata su 9f769aab; questo incremento ha eseguito i controlli mirati indicati.

Nessun deploy, bump, modifica a master, scrittura dati o estensione delle modifiche offline. Produzione resta 1.2.125; il candidato sperimentale richiede il riallineamento già previsto prima del rilascio.

## Rilascio isolato 1.2.126 completato — 15/09/2026

PR #65 unita in master a14d0198b37507b7c6fb0e7352fe8930d57a9f0d, candidato bb926671693f52348a4d2f9a6032d532170e7635 sulla base produttiva 1.2.125. Distribuite soltanto preparazione offline del profilo, accountWidgets/sharedVaultData e spiegazione degli errori di connettività nelle pagine principali. Il gestore del profilo viene importato su errore; intestazione del modulo abbreviata per il budget. Non sono stati importati i cambiamenti sperimentali dei componenti Widget.

npm test completo della release superato; GitHub Actions 34937232687, job validate 104277695629 riuscito. Tredici test offline del ramo produttivo (preparazione/classificazione e quattro letture Widget/credenziali private/azienda con rivelazione e mascheramento simulati). Hosting distribuito con successo, 240 file. Verificati via HTTP gli hash SHA256 di Home, env-v126.js, sw.js, offline-sync.js, read-error-message.js, profilo_privato.js e offline-assets.js: corrispondono al candidato testato. Functions, Rules e dati invariati.

Retest iPhone ancora richiesto sulla 1.2.126: app online fino a completamento preparazione, poi modalità aereo senza logout; profilo, Widget e credenziali comuni consultabili senza visita preventiva. Foto e allegati esclusi per decisione dell'utente. Non interpretare la nuova pubblicazione come test fisico riuscito o garanzia contro cache espulsa.

PR #63 resta separata e aperta. Produzione ora 1.2.126: prima di un futuro rilascio sperimentale riallineare master, versioni e i due backport già distribuiti, evitando duplicazioni. Non distribuire direttamente la vecchia versione 1.2.124 del ramo sperimentale.

## Rilascio isolato Auth 1.2.127 completato — 15/09/2026

PR #66 unita in master 0ba2332b298d155f0afb1a4eb50c9659115fe321; release 94792d837cadd538e17aa67e439df1c68a09a23a. Pubblicazione Hosting autorizzata e completata. Le 22 pagine private rimangono nascoste fino alla conferma Auth; errore, timeout e logout mantengono il blocco. Pulizia locale/Vault prima del tentativo di signOut. Nessuna lettura o modifica di dati reali; Functions e Rules non distribuite.

npm test completo e dieci scenari browser Chrome/Edge superati; GitHub Actions 34939530695 riuscita. Dopo il deploy, 31 file pubblicati corrispondono via SHA256 alla release. Prova Chrome con profilo isolato senza credenziali: nessuna struttura privata visibile e arrivo a /login-v115.html senza parametro di errore/timeout. Collaudo fisico iPhone ancora da eseguire, inclusa riapertura offline con sessione mantenuta e sblocco Vault.

Produzione ora 1.2.127. PR #63 resta sperimentale: riallineare con master prima di integrare, evitando duplicazioni dei backport offline e logout. La direzione shell persistente resta confermata; questo rilascio non chiude il P0 legacy del wrapping in sessionStorage né l'intero audit sicurezza. Dettagli implementativi e regressioni sono in docs/AUDIT_VAULT_SESSION_P0.md del ramo produttivo e nella PR #66.

### Candidata Auth prima del rendering — 15/09/2026

Su master 1.2.126 riprodotta la Home generica visibile prima del redirect anonimo. Correzione isolata delle 22 pagine private, attesa Auth con errore/timeout chiusi e cleanup centralizzato logout. Il requisito era già previsto dal bootstrap protetto e dal contratto di pulizia; mancava il collaudo del primo frame produttivo. Dettagli, test e limiti nell'ultima sezione di AUDIT_VAULT_SESSION_P0.md. Nessun deploy, dato reale o certificazione complessiva della baseline. La shell persistente resta la direzione già scelta nel ramo sperimentale.
