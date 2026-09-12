# Guida tecnica operativa — Codici & Password

> **Stato:** guida implementativa attiva; stato runtime distinto dai requisiti obiettivo.\
> **Autorità:** subordinata a [Guida progetto](../docs/GUIDA_PROGETTO.md), [Architettura Sicurezza V1](../docs/ARCHITETTURA_SICUREZZA_V1.md) e contratti specialistici.\
> **Riferimento:** v1.2.110, commit applicativo `fa555d49d45e3a3545d09bc862645e84ba386862`.\
> **Verifica documentale:** 12 settembre 2026.\
> **Area:** frontend, UI, accesso dati, sicurezza e manutenzione.\
> **Dipendenze:** contratti collegati nelle sezioni seguenti; [registro aggiornamenti](./GUIDA_AGGIORNAMENTI.md).\
> **Sostituisce:** le prescrizioni V7/V8 della precedente revisione di questo stesso file, conservate nella cronologia Git. Non sostituisce la baseline o i contratti specialistici.

## 1. Uso della guida

Questa guida indica le regole operative consolidate. I contratti specialistici prevalgono; gli audit descrivono soltanto il commit e il perimetro indicati. Un test passato non certifica configurazione Firebase, dispositivi o sicurezza complessiva.

Prima di un intervento verificare il codice corrente, il contratto dell'area, i dati legacy coinvolti e i test pertinenti. Non rimuovere una funzione, un campo o un fallback sulla sola base della sua età. Non eseguire migrazioni, bonifiche o scritture di prova sui dati reali come effetto collaterale di un audit.

## 2. Pagine, bootstrap e viewport

Il [registro canonico](../docs/CANONICAL_PAGE_REGISTRY.md) identifica la superficie applicativa. Alla v1.2.110 comprende 30 pagine: cinque di accesso, 24 interne e il ricevitore pubblico `contatto_condiviso.html`. `prova.html` è un laboratorio temporaneo escluso dal conteggio.

Il [contratto delle pagine](../docs/PAGE_SHELL_CONTRACT.md) disciplina struttura, scroll, safe area e viewport. Le pagine interne usano `body.base-bg`, contenitore comune, header, `.base-main`, `.page-container` e footer. Le pagine di accesso hanno un bootstrap e un layout distinti; il ricevitore pubblico del contatto non carica la shell privata.

Il router e il bootstrap correnti sono `pages-init.js`, `main-v129.js` e gli entry point dedicati. I moduli di pagina espongono il proprio inizializzatore e non duplicano bootstrap o listener. Questo vincolo non vieta ai moduli di dominio di esportare API condivise né agli entry point dedicati di inizializzare la propria pagina.

La shell e gli stati di caricamento devono apparire senza attendere una sincronizzazione globale dei dati. Traduzioni, autenticazione, sblocco e caricamento mantengono i gate effettivi del rispettivo flusso. Non reintrodurre un occultamento globale fino al download completo.

La famiglia accesso conserva il tema previsto e consente scroll di emergenza con tastiera o schermo basso. Modifiche a nebbia, safe area, stacking o viewport richiedono confronto con il [collaudo M4](../docs/M4_VISUAL_ACCEPTANCE.md); le prove estese rimangono nel gate M10.

## 3. CSS, componenti e accessibilità

Il [contratto UI](../docs/UI_DESIGN_SYSTEM_CONTRACT.md) distingue fondazioni, componenti, modelli di pagina e stili esclusivi. Non creare un foglio globale che assorba differenze funzionali.

- `core.css`: fondale, temi, token, watermark e livelli condivisi.
- `core_fonts.css`: Manrope e Material Symbols locali, token tipografici.
- `core_fascie.css`: header, footer, nebbia e compensazioni.
- `core_ui.css` e `moduli.css`: controlli, modali, campi e stati condivisi.
- `account_form.css`, `account_detail.css`, `azienda_shared.css` e `profile-layout.css`: composizioni comuni ai rispettivi domini.
- CSS di pagina: comportamento e presentazione realmente esclusivi.

Rispettare l'ordine di caricamento verificato per ciascuna famiglia; non applicare una sequenza unica alle pagine pubbliche e private. Non introdurre Tailwind runtime, stili inline o nuove librerie UI per sostituire componenti già esistenti. Le utilità locali del progetto non sono automaticamente Tailwind e non vanno eliminate meccanicamente.

Usare token tipografici, target tattili di almeno 44 px, nomi accessibili, focus e movimento ridotto. Conservare occhio, copia e azioni contestuali accessibili. I controlli custom devono mantenere semantica, tastiera e selezione; la sola estetica non autorizza a sostituire un controllo accessibile con un `div` privo di comportamento.

Non applicare divieti globali di `!important`, selettori ID o valori numerici che cancellino eccezioni già presenti nelle fondazioni. Verificare cascade e contesto del componente; una normalizzazione richiede equivalenza e collaudo.

I nuovi testi usano il sistema i18n, inclusi placeholder, ARIA, errori e contenuti dinamici. La revisione editoriale globale di lingue e Impostazioni resta nella fase post-M10. I dizionari generati si aggiornano con `scripts/split-translations.mjs`, non manualmente.

## 4. Dati, cache e operazioni asincrone

Il [contratto di accesso dati](../docs/DATA_ACCESS_CONTRACT.md) definisce il percorso pagina → repository → adattatore Firestore. Le letture ordinarie sono cache-first; dopo una scrittura confermata si usa il percorso mirato `afterWrite`/server-confirmed. Non trasformare tutte le letture in server-first.

Il coordinatore accorpa richieste concorrenti della stessa risorsa e le libera anche in errore. Non memorizzare dati decifrati nel repository. Non lasciare Promise non attese mediante `forEach(async ...)`: usare un ciclo atteso oppure parallelismo limitato secondo le dipendenze.

La UI distingue caricamento, vuoto, indisponibilità offline, conflitto ed errore. Un refresh fallito non deve cancellare una copia locale valida. La cache non garantisce che una raccolta sia completa o che un allegato sia disponibile offline.

La [policy dei conflitti](../docs/OFFLINE_WRITE_CONFLICT_POLICY.md) e [M6](../docs/M6_SINCRONIZZAZIONE_OFFLINE.md) governano revisioni, coda e retry. Il cutover è limitato ad Account e memorandum privati isolati. Banca, condivisioni e collegamenti Profilo restano fuori da quel percorso; la consultazione bancaria offline su iPhone ha un gate non superato.

## 5. Account, profili, widget e scadenze

Il [contratto funzionale](../docs/FUNCTIONAL_DATA_CONTRACT.md) conserva i domini e i percorsi dati; la [roadmap Profilo/Account/Widget](../docs/PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md) descrive proprietà, collegamenti e compatibilità.

- Account e Account condivisi possono avere username, codice e password; memorandum non conservano copie nascoste di queste credenziali. Il cambio di tipo richiede la scelta consapevole prevista dal modello condiviso.
- Account aziendali conservano `aziendaId` e il percorso sotto l'azienda. Il contesto del proprietario resta distinto dal visitatore.
- Profilo personale e Dati azienda condividono linguette e componenti, mantenendo campi e significati propri.
- Più recapiti possono riferire lo stesso Account. Apri, cambia e scollega devono operare sul collegamento; scollegare non elimina l'Account.
- Le credenziali appartengono all'Account collegato. Non cancellare copie legacy finché trasferimento e confronto non sono verificati nel flusso autorizzato. Le modifiche del singolo utente non autorizzano una pulizia globale del database.
- Widget incorporati e Credenziali comuni hanno proprietà e percorsi distinti. I valori comuni non si duplicano e non vengono ereditati automaticamente dagli ospiti di un Account.
- Il QR contiene soltanto i dati esplicitamente ammessi e selezionati. Foto e dati del contatto seguono il ricevitore pubblico; password, PIN, PUK e campi sensibili restano esclusi.
- Scadenze proprie e copie ricevute sono domini distinti. Il backend verifica destinatario e permesso corrente; notifiche e link non sostituiscono l'autorizzazione.

Le configurazioni Scadenze rimangono separate in `deadlineConfig`, `deadlineConfigDocuments` e `generalConfig`. Non cambiare automaticamente le scadenze esistenti quando si aggiorna una configurazione. Le cancellazioni seguono i contratti del dominio e i gate di recupero: nessun gesto UI autorizza da solo una bonifica massiva.

## 6. Sicurezza e condivisione

La [baseline](../docs/ARCHITETTURA_SICUREZZA_V1.md) e il [contratto Vault](../docs/VAULT_KEY_CONTRACT.md) separano password Firebase, Master Password, KEK, Vault Key e Recovery Key. AES-GCM è il riferimento corrente; `libsodium` e la frase di recupero di 24 parole erano proposte storiche, non decisioni operative.

Lo stato della sessione è descritto nell'[audit Vault](../docs/AUDIT_VAULT_SESSION_P0.md): payload e chiave di wrapping nello stesso storage mantengono aperto il rilievo. Non replicare questa persistenza come soluzione conforme. Il blocco per inattività è distinto dal logout Firebase; pulizia dei singoli percorsi e collaudo fisico restano verifiche specifiche.

La [classificazione dei campi](../docs/ENCRYPTED_FIELD_INVENTORY.md) è un inventario incompleto, non un'autorizzazione a lasciare tutte le anagrafiche o etichette in chiaro. La baseline richiede classificazione e minimizzazione. Non riscrivere i dati per eliminare una discrepanza documentale.

La [condivisione M5](../docs/M5_CONDIVISIONE_THREAT_MODEL.md) distingue ACL legacy e consegna crittografica. Nel runtime legacy si conservano i lettori necessari di `sharedWith`, `sharedWithUids` e formati anteriori; il protocollo per-record/grant resta subordinato al [piano di integrazione](../docs/M5_PIANO_INTEGRAZIONE.md). Revocare non cancella copie già viste o esportate.

Le operazioni semplici possono essere dirette solo con Rules complete; operazioni coordinate, ACL, grant e dati comuni seguono la matrice backend della baseline. La regola ricorsiva proprietario attuale non equivale a validazione di ogni schema. Nessun cambiamento a Rules o Functions è implicito nel riallineamento degli MD.

## 7. Campi credenziali e autofill

Le credenziali Firebase di accesso mantengono la semantica di login. Nei form Account, username e password effettivi mantengono gli attributi previsti dal flusso; il codice è un campo distinto, non una password universale.

Master Password, PIN, PUK e campi personalizzati cifrati non devono essere proposti come password di login. Per questi valori si usa il controllo testuale protetto previsto dal runtime, con comandi mostra/nascondi e copia dove autorizzati. Non convertire indiscriminatamente tutti i campi Account in testo e non reintrodurre trappole di login nascoste.

La protezione visiva non è cifratura. Gli attributi HTML non garantiscono il comportamento di ogni password manager: il gate comprende Safari/iPhone, Chrome ed Edge e distingue credenziali reali dagli altri segreti.

## 8. CSP, Storage, notifiche e PWA

La CSP applicata da Hosting è in `firebase.json`. Non copiare il vecchio meta tag con hash inline: il runtime usa script esterni e gate dedicati. Le modifiche a CSP, domini e worker richiedono controllo dei flussi interessati.

Gli allegati seguono la pipeline della baseline: validazione locale, nome casuale, cifratura con chiave-file, upload opaco e riferimento recuperabile. I percorsi e gli URL legacy richiedono inventario e migrazione separata; non sostituirli con nomi contestuali fissi o URL pubblici permanenti.

`sw.js` gestisce la shell; `firebase-messaging-sw.js` gestisce Push con scope distinto. La cache Firestore multi-tab è separata da Cache Storage. Non aggiungere allegati, OCR o modelli AI alla precache obbligatoria. La cache non è un backup.

Notifiche, email e log non contengono segreti. Il backend usa i servizi correnti di `functions/index.js`; lo scheduler della revisione applicativa indicata è alle 09:00 `Europe/Rome`. Il trasporto email usa credenziali dedicate: non è una garanzia di recapito o di invio illimitato. Non inserire credenziali o indirizzi amministrativi negli esempi della guida.

## 9. Backup, test e rilascio

[M7](../docs/M7_CRONOLOGIA_CESTINO_AUDIT.md), [M8](../docs/M8_BACKUP_RECUPERO.md) e la [procedura incidenti](../docs/RISPOSTA_INCIDENTI_E_RECUPERO.md) governano cestino, retention e recupero. Il backup applicativo è `.cpbackup` cifrato con Recovery Key distinta. Non generare un PDF contenente Master Password, Vault Key o codici MFA come procedura ordinaria di rilascio.

Il ripristino storico riuscito non certifica interruzioni fra blocchi e allegati. Le prove distruttive usano esclusivamente una copia di collaudo autorizzata. Il controllo del solo flag `_encrypted` non dimostra correttezza crittografica.

Scegliere test che esercitino il requisito modificato; distinguere test statici, helper, runtime, emulatori con Rules attuali, Rules candidate e dispositivi fisici. Il [piano di audit](../docs/PIANO_AUDIT_COMPLETO_PROGETTO.md) richiede il rapporto prima delle correzioni.

Il [gate M10](../docs/M10_HARDENING_RILASCIO.md) resta il riferimento per il rilascio. Il workflow della revisione indicata valida PR/push e distribuisce solo Hosting su avvio manuale. Rules, Functions e dati richiedono autorizzazione e distribuzione separate.

Aggiornare i contratti interessati nello stesso lavoro; rigenerare gli inventari con gli script previsti. Conservare commit, test, rollback e limiti nel registro. Il riallineamento documentale non chiude automaticamente i gate del progetto.

### Liste Account predisposte al montaggio — 12/09/2026

Su base `0a807adb`, i moduli canonici privato/azienda espongono un montaggio con stato per vista, `ready`, `destroy`, AbortSignal e navigazione iniettata. Gli inizializzatori storici restano compatibili e `pages-init.js` restituisce la dismissione. Il futuro chiamante deve usarla su uscita/blocco/cambio identità; la shell persistente non è ancora attivata nell’app. [Evidenze e limiti](../docs/AUDIT_VAULT_SESSION_P0.md#17-primo-adattamento-degli-orchestratori-reali--12092026).

### Montaggio reale nel laboratorio — 12/09/2026

Importati gli orchestratori canonici delle due liste nella shell sperimentale, con template minimo e repository fittizio. Aggiunta opzione esplicita `readOnly` che sopprime UI e callback di scrittura; default produttivo invariato. [Audit §18](../docs/AUDIT_VAULT_SESSION_P0.md#18-orchestratori-canonici-nel-laboratorio--12092026) definisce perimetro e limiti; le pagine complete non sono ancora migrate.
