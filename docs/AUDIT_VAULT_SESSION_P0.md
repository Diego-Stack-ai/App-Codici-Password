# Audit P0 — Sessione Vault

> **Stato:** audit statico completato; correzione architetturale da approvare
> **Autorità:** evidenza subordinata a [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md) e [Contratto Vault Key](./VAULT_KEY_CONTRACT.md)
> **Data:** 11 settembre 2026
> **Commit esaminato:** `2b00336dfcf2a2c90e244263bca33fbf3db2d922`
> **Codice esaminato:** `security-manager.js`, `vault-session.js`, `webauthn-manager.js`, `inactivity-timer.js`, chiamate di logout e test Vault

## 1. Esito

Il runtime separa correttamente la password Firebase dalla Master Password e usa una Vault Key casuale protetta da envelope. La sessione fra pagine, però, non soddisfa l'invariante della baseline: `vault-session.js` conserva nello stesso `sessionStorage` sia il materiale Vault cifrato sia la chiave casuale che lo decifra.

Questo wrapping impedisce la lettura casuale del solo payload, ma non crea una separazione crittografica contro uno script eseguito nella stessa origine. Un attaccante capace di eseguire JavaScript nell'app può leggere entrambi i valori e ricostruire il materiale Vault della scheda sbloccata.

Il runtime non deve quindi essere dichiarato conforme al contratto Vault o definitivamente zero-knowledge finché questa persistenza resta attiva.

## 2. Flusso verificato

1. La Master Password verifica il verifier e deriva temporaneamente la KEK.
2. La KEK apre `vaultKeyEnvelope` oppure inizializza il formato compatibile previsto.
3. `_vaultKeyMaterial` conserva la chiave sbloccata in RAM.
4. `saveVaultSession()` cifra lo stesso materiale e salva il payload in `sessionStorage`.
5. `getSessionKey(true)` genera la chiave di wrapping e salva anch'essa in `sessionStorage`.
6. Al caricamento della pagina successiva `restoreVaultSession()` legge entrambi i valori e ripristina `_vaultKeyMaterial` senza chiedere nuovamente la Master Password.
7. Il timer aggiorna `expiresAt`; `softLock()` e `clearSession()` eliminano payload e chiave di wrapping.

## 3. Evidenze positive

- non è emersa persistenza della Master Password in `localStorage`;
- verifier e `vaultKeyEnvelope` memorizzati localmente sono contenitori cifrati e versionati;
- il vecchio segreto biometrico non strutturato viene eliminato e non viene più letto;
- il contenitore WebAuthn/PRF conserva ciphertext, IV, salt e identificatore credenziale, non la chiave PRF;
- cambio UID, perdita dell'utente autenticato, blocco per inattività e reset Vault chiamano la pulizia centralizzata;
- i test verificano isolamento per UID e cancellazione dei due valori di sessione;
- non sono emerse chiamate che inviano Master Password o Vault Key alle Cloud Functions.

## 4. Finding

### VS-P0-01 — Chiave e ciphertext nello stesso storage

**Gravità:** alta.
**Stato:** verificato nel codice e indirettamente dai test.
**Impatto:** una XSS o dipendenza frontend compromessa, mentre la Vault è sbloccata o ripristinabile, può ottenere entrambi gli elementi necessari alla decifratura.
**Limite:** nessuna soluzione browser può proteggere completamente una chiave già in RAM da codice ostile eseguito nella stessa pagina; eliminare la persistenza riduce però la finestra e impedisce il recupero dopo un nuovo caricamento.

### VS-P1-02 — Pulizia al logout non sempre esplicita

**Gravità:** media.
**Stato:** verificato nel codice.
**Impatto:** alcuni pulsanti chiamano direttamente `signOut()` e affidano la pulizia al listener globale `onAuthStateChanged`. Il percorso normalmente funziona, ma il contratto dovrebbe richiedere `clearSession()` prima del logout in ogni comando esplicito, mantenendo il listener come seconda difesa.

### VS-P1-03 — Ripristino della scheda e crash non certificati

**Gravità:** media.
**Stato:** non determinabile senza prova fisica.
**Impatto:** `sessionStorage` è normalmente limitato alla scheda, ma il ripristino della sessione del browser dopo chiusura anomala può conservarlo. Non esiste una prova su Safari/iPhone, Chrome ed Edge che documenti tutti i casi.

### VS-P1-04 — Test funzionali descritti come contratto di sicurezza

**Gravità:** media.
**Stato:** verificato nei test e negli script.
**Impatto:** i test attuali dimostrano che la sessione viene ripristinata e cancellata, ma non dimostrano che il wrapping sia sicuro. Uno script di audit richiede esplicitamente la persistenza fra pagine; il messaggio “contratto M1 rispettato” deve essere separato dalla conformità alla nuova baseline.

## 5. Vincolo funzionale

L'app usa pagine HTML separate. Una Vault Key conservata soltanto in una variabile JavaScript viene persa a ogni navigazione completa. Rimuovere subito `sessionStorage` obbligherebbe quindi l'utente a reinserire la Master Password in quasi ogni pagina, salvo usare WebAuthn con un nuovo gesto dell'utente.

Per questo motivo la correzione non deve essere una cancellazione isolata di `vault-session.js`: richiede una decisione sull'architettura di navigazione e sul livello di comodità accettato.

## 6. Piano di correzione proposto

### Blocco 1 — Riduzione immediata del rischio

- rendere esplicita la pulizia prima di ogni logout;
- distinguere nei test “continuità funzionale” e “conformità di sicurezza”;
- verificare CSP, rendering dinamico e dipendenze come difesa principale contro XSS;
- misurare chiusura, crash, ripristino scheda e timeout sui browser supportati.

Questo blocco non cambia il formato dei dati e non richiede migrazione.

### Blocco 2 — Scelta del modello di sessione

Valutare e approvare una delle seguenti direzioni:

1. **modalità rigorosa:** chiave solo in RAM e nuovo sblocco dopo ogni caricamento completo;
2. **navigazione persistente:** evoluzione graduale verso una shell che non ricarica il contesto crittografico a ogni pagina;
3. **sblocco dispositivo:** WebAuthn/PRF esplicito quando cambia documento, mantenendo la Master Password come fallback;
4. **compatibilità temporanea:** mantenere il comportamento corrente per un periodo dichiarato, rafforzando fortemente prevenzione XSS e timeout, senza definirlo conforme.

Service Worker, SharedWorker, cookie o un secondo storage web non devono essere considerati automaticamente sicuri: richiedono threat model, compatibilità iPhone/PWA e prova che la chiave non sia recuperabile dagli stessi script dell'origine.

### Blocco 3 — Cutover controllato

Dopo la scelta:

- implementare il nuovo gestore dietro una modalità reversibile;
- mantenere invariati ciphertext, envelope e dati Firestore quando possibile;
- aggiungere test per logout, cambio UID, timeout, refresh, chiusura e ripristino;
- collaudare su iPhone/Safari, PWA, Chrome ed Edge;
- rimuovere il lettore di sessione precedente soltanto dopo il collaudo e il rollback verificato.

## 7. Decisione richiesta

La correzione non richiede recuperare o risalvare gli account esistenti: riguarda il modo in cui la chiave già sbloccata sopravvive fra le pagine. Prima del Blocco 2 il product owner deve scegliere se privilegiare temporaneamente comodità, modalità rigorosa oppure una futura shell persistente.

## 8. Correzione locale del 12/09/2026 — Blocco 1, logout

Base applicativa: v1.2.110, `fa555d49`; documentazione consolidata in `5ef16228`.

- Corretti i quattro percorsi privi di pulizia esplicita: logout in `auth.js`, pulsante Home in `components-v129.js`, riautenticazione e uscita dall’aggiornamento password obbligatorio in `imposta_nuova_password.js`.
- Tutti i sette `signOut(auth)` applicativi sono preceduti da `clearSession()`. Nei percorsi nuovi il gestore viene importato soltanto quando si esce, mantenendo leggero il bootstrap pubblico.
- `tests/vault-logout.test.mjs` censisce i sette percorsi e prova il comando logout con il corpo reale dei moduli di sicurezza/sessione, sostituendo soltanto browser e Firebase. Verifica RAM e quattro chiavi di sessione eliminate prima della chiamata remota, anche quando questa fallisce; gli altri dati locali restano intatti.
- I messaggi dei gate distinguono terminologia e continuità funzionale dalla conformità crittografica.

**Impatto e rollback:** nessuna modifica a ciphertext, envelope, autenticazione, Rules o Functions. Se Firebase rifiuta il logout, la Vault resta priva del materiale locale già cancellato; il recupero richiede lo sblocco previsto dall’app. Il rollback è il revert del commit, senza migrazione dati.

**Validazione locale:** `npm test` completato con successo il 12/09/2026, inclusi build, gate statici, test Vault e suite Firestore/Storage negli emulatori. Rigenerati inventario e baseline delle 30 pagine; nessun collegamento relativo a file MD rotto. Il primo tentativo di build era impedito dai permessi di lettura della sandbox; la suite completa è stata poi eseguita con l’accesso locale necessario. Queste prove non sostituiscono i collaudi fisici elencati sotto.

**Limiti:** VS-P1-02 corretto nei comandi espliciti; listener Firebase conservato come seconda difesa. VS-P0-01 rimane aperto: chiave di wrapping e payload persistono ancora nello stesso storage durante la sessione. Nessuna prova fisica di crash/ripristino scheda né certificazione di operazioni di sblocco già in corso. Il Blocco 1 complessivo e il Blocco 2 non sono chiusi da questa correzione. Nessun deploy eseguito.

## 9. Correzione locale del 12/09/2026 — operazioni concorrenti

Base del confronto: commit `67288cc3`, dopo la pulizia esplicita dei logout. La limitazione sulle operazioni già in corso della sezione 8 viene affrontata nel perimetro seguente.

**Problema riprodotto:** Web Crypto e sblocco sono asincroni. Un salvataggio avviato prima del blocco poteva ricreare il payload dopo la pulizia; un ripristino già in corso poteva restituire la vecchia chiave e ripubblicarla in RAM. Anche un errore tardivo poteva cancellare una sessione più recente. La stessa sequenza coinvolgeva biometria, prompt Master Password e risoluzione della chiave.

**Correzione:** contatori esclusivamente in RAM invalidano le operazioni precedenti a logout, blocco e reset; il controllo UID impedisce di pubblicare il risultato per un altro utente. Il livello di sessione scarta salvataggi/ripristini obsoleti e ricontrolla la scadenza dopo la decifratura. Una nuova richiesta di sblocco può partire senza attendere quella invalidata. Il cambio Master Password verifica il contesto prima della scrittura remota e prima di riaprire la Vault. Se la scrittura era già completata, conserva verifier/envelope cifrati aggiornati per evitare una cache locale obsoleta, ma non ripristina la chiave sbloccata.

**Prove:** 14 nuovi test deterministici in `vault-session-races.test.mjs`, con ritardi controllati e dati fittizi; Web Crypto reale per cifratura/decifratura della sessione, confini Firebase/UI/biometria simulati per il gestore. Eseguiti contro la copia precedente `67288cc3`, i test producono 13 fallimenti e un timeout sulla nuova richiesta bloccata dalla vecchia promise; contro la correzione passano tutti. Non sono prove biometriche su dispositivo reale.

**Verifica finale locale:** `npm test` superato il 12/09/2026, inclusi 310 test, emulatori Firestore/Storage e gate statici. Il budget delle 30 pagine è rispettato senza aumentarne i limiti; inventario e baseline rigenerati. Verificati 94 collegamenti relativi a file MD senza destinazioni mancanti (ancore e URL esterni esclusi dal controllo automatico).

**Compatibilità e rollback:** API, formato v1 di sessione, chiavi di storage, verifier, envelope e record Firestore invariati. Nessuna migrazione o cancellazione di dati reali. Revert del commit per rollback applicativo. Non viene promessa la cancellazione fisica della memoria JavaScript né l’annullamento di richieste remote già inviate; vengono impediti la ripubblicazione e il ritorno delle chiavi dalle operazioni invalidate nel perimetro verificato.

**Gate aperti:** VS-P0-01 (chiave e ciphertext nello stesso storage), ripristino/crash e matrice fisica, operazioni legacy di provisioning/migrazione e revisione crittografica indipendente. Nessuna distribuzione. Il Blocco 2 resta una decisione di prodotto: rimuovere la persistenza adesso comporterebbe uno sblocco per ogni documento HTML.

## 10. Proposta per il Blocco 2 — da scegliere prima dell’implementazione

Raccomandazione: navigazione persistente per le pagine protette, con chiave soltanto in RAM; nuovo sblocco dopo refresh, chiusura o caricamento completo. Permette di conservare la comodità della navigazione ordinaria, ma richiede la migrazione graduale degli inizializzatori di pagina e la pulizia di listener/stato quando cambia vista.

| Direzione | Esperienza prevista | Lavoro necessario |
|---|---|---|
| Navigazione persistente, raccomandata | Uno sblocco durante la navigazione interna; nuovo sblocco dopo refresh | Prototipo isolato su due pagine, montaggio/smontaggio controllato, link e history, offline, timeout, logout, iPhone/PWA e Windows; nessun cutover globale prima dei gate |
| RAM nelle pagine attuali | Nuovo sblocco a ogni pagina HTML | Gestore reversibile, rimozione della lettura della sessione persistita, collaudo di tutti i percorsi e accettazione dei prompt ripetuti |
| WebAuthn/PRF a ogni documento | Gesto di sblocco dispositivo a ogni pagina compatibile; Master Password di fallback | Prova fisica delle capacità e dell’esperienza sui dispositivi supportati |

Questa proposta non attiva una nuova modalità e non rende conforme la compatibilità temporanea attuale. L’approvazione della direzione autorizzerà il prototipo; pubblicazione e migrazione restano gate separati.

## 11. Prototipo autorizzato — 12/09/2026

Il product owner ha autorizzato il prototipo isolato della navigazione persistente dopo la proposta della sezione 10. Base: `a6f756cc`, branch `experiment/persistent-vault-shell`. Questa autorizzazione non attiva il modello nell’app pubblicata.

**Implementazione:** `experiments/persistent-vault-shell/` contiene un unico documento e due viste dimostrative, Panoramica e Account. Un router a destinazioni chiuse gestisce hash/history, AbortSignal e smontaggio dei listener; le viste non ricevono la chiave. Il gestore custodisce una CryptoKey non esportabile solo in RAM e verifica UID, generazione e scadenza anche al completamento delle letture asincrone. Blocco, uscita e `pagehide` invalidano la sessione e cancellano il contenuto visibile; `pageshow` da bfcache impone un nuovo sblocco. Refresh crea un gestore bloccato.

**Dati e minacce:** fixture fittizia cifrata con AES-GCM, credenziale dimostrativa pubblica nel sorgente, salt/ciphertext in RAM. Non è un’autenticazione sicura e non accetta password o dati reali; la KDF della fixture non modifica il contratto crittografico produttivo. Nessuna persistenza web, rete Firebase o import del security manager produttivo. Il server serve soltanto sei file esplicitamente ammessi, ascolta su loopback e impone CSP `connect-src 'none'`, niente script inline, nessun framing e `no-store`. Una XSS nel contesto sbloccato resta una minaccia: non esportabilità e sola RAM non impediscono a codice ostile di usare il decryptor. Non viene promessa la cancellazione fisica della memoria o di copie già lette.

**Avvio:** dalla radice repository, `npm run prototype:vault-shell`; aprire `http://127.0.0.1:4187`. Per terminare il server usare Ctrl+C. `npm run test:vault-shell` esegue 12 test ed è incluso nel gate Vault. La demo rimane esterna a `Frontend/public`, manifest e service worker: il gate verifica anche questa separazione. Nessuna pagina canonica aggiunta e nessun incremento del bundle dell’app.

**Prove locali:** 12 test superati, inclusi cifratura reale della fixture, un solo sblocco su tre cambi di vista, cambio UID, timeout, annullamento delle letture e degli sblocchi pendenti, pulizia dei listener, destinazioni non ammesse e isolamento dal runtime. Nel browser integrato su Windows verificati sblocco, passaggio tra le due viste, Indietro/Avanti, refresh bloccato e cancellazione del contenuto al blocco. I test `pagehide/pageshow` del modello non certificano il bfcache reale di Safari.

**Gate prima dell’integrazione:** adattare due vere pagine con montaggio/smontaggio completo e collegamenti originali; integrare Auth/verifier/envelope senza usare la credenziale pubblica della fixture; gestire cambi utente e tutte le operazioni pendenti; verificare deep link, focus, scroll e back/forward; misurare caricamento e memoria su iPhone/Safari/PWA, Chrome ed Edge; definire bootstrap offline e riapertura senza rete. La navigazione della demo già caricata non richiede fetch; un avvio offline da chiusa non è implementato (nessun service worker del laboratorio). Nessuna migrazione di account o condivisioni, né modifica del formato v1 produttivo.

**Rollback:** eliminazione/revert del solo laboratorio e del relativo comando di test, senza toccare i dati. VS-P0-01 rimane aperto nell’app online fino al cutover collaudato; prototipo completato non significa migrazione completata.

## 12. Componenti reali delle liste — 12/09/2026

Base `321fec0b`. L’autorizzazione a proseguire autonomamente comprende la preparazione locale, non il cutover pubblico. Nel percorso di adattamento delle pagine è emerso un accumulo di listener: `account-list-view` istanziava `SwipeList` a ogni render senza rimuovere le istanze precedenti; anche l’Archivio perdeva il riferimento alla vecchia istanza. Un risultato di ricerca vuoto lasciava attivi i gestori precedenti.

**Correzione candidata nel codice applicativo:** `SwipeList.destroy()` rimuove sette listener documentali e i timer; il renderer condiviso privato/azienda distrugge la vecchia istanza prima di ogni render, anche vuoto, ed espone `destroy()` per il futuro smontaggio. L’Archivio applica la stessa pulizia. Un AbortSignal per render impedisce a un reveal/copia asincrono di restituire plaintext dopo lo smontaggio della vecchia card. Richieste remote già inviate non vengono annullate o certificate da questo intervento.

**Laboratorio:** aggiunte Lista privata e Lista aziendale usando il renderer originale, `dom-utils`, modello Account e SwipeList del repository. Il build esbuild sostituisce esclusivamente i confini di traduzione, notifiche, logging e risoluzione fixture; controlla dal metafile che Firebase, repository reale e security manager non entrino nel bundle. Queste sono integrazioni dei componenti, non delle due pagine complete: mancano orchestratori, condivisioni e mutazioni. Ricerca e mostra/nascondi funzionano su due account fittizi; comandi di scrittura non attivi. CSS del laboratorio semplificato, non sostituisce il design system.

**Avvio aggiornato:** `npm run prototype:vault-shell` compila prima il bundle locale ignorato da Git. Il server loopback ammette nove risorse esplicite, incluso bundle, font icone e avatar; `connect-src 'none'` resta attivo. Nessuna esposizione dell’intero repository.

**Validazione:** cinque test aggiuntivi sul codice reale dimostrano assenza di accumulo dopo 20 render, pulizia su ricerca vuota, cancellazione timer prima di azioni sui record, azione singola della gesture valida e nessun reveal tardivo. Suite completa `npm test` superata, emulatori inclusi; budget delle 30 pagine invariato e rispettato. Nel browser integrato Windows verificati reveal fittizio, ricerca vuota e cambio alla lista aziendale senza stato della ricerca precedente.

**Rollback/gate:** revert delle modifiche UI e del laboratorio, senza migrazione dati. Nessun deploy. Restano da adattare inizializzatori completi, Auth/envelope e scritture, oltre alla matrice fisica iPhone/PWA; il solo riuso del renderer non chiude questi gate.

## 13. Compatibilità e anteprima offline — 12/09/2026

Base `553a35d5`. Preparato `legacy-adapter.mjs`, un adattatore candidato di sola lettura con dipendenze esplicite per identità, sottoscrizione Auth, caricamento dei contenitori, richiesta Master Password e API crittografiche. Nei test usa il vero `crypto-utils.js`, verifier/envelope v2 e keyring CPVK2, ma esclusivamente credenziali sintetiche e backend simulato. Non è collegato al browser della demo né al database reale. Respinge proprietari diversi, plaintext nel lettore cifrato e contenitori mancanti invece di avviare automaticamente migrazioni; logout/cambio UID invalidano il contesto.

**Distinzione importante:** l’adattatore compatibile mantiene in RAM il materiale chiave testuale/keyring del formato esistente. Non lo trasforma in una CryptoKey non esportabile. La CryptoKey non esportabile della fixture iniziale non è una garanzia trasferita al lettore legacy. Nessun contenitore o record reale viene migrato.

**Prove dell’adattatore:** otto test con crittografia reale su fixture: formato corrente, fallback legacy, password errata, envelope mancante/manomesso, proprietà, logout durante il prompt e cambio UID. Sono prove del collegamento in memoria; non certificano Auth remoto, provisioning legacy, AAD o condivisioni M5.

**Offline della demo:** `prepare-preview.mjs` produce esattamente nove asset fittizi e un service worker in `dist/site`, ignorato da Git. Versione della cache derivata dall’hash dei file; aggiornamento elimina solo cache con prefisso del laboratorio. Il worker serve soltanto GET di percorsi statici ammessi della stessa origine, senza query; non gestisce record, chiavi, POST o API. CSP aggiornata a `worker-src 'self'; connect-src 'self'` per precaricare gli asset, senza consentire domini Firebase o altre origini. Il contenuto fittizio viene ricreato in RAM a ogni caricamento; la disponibilità offline non conserva uno sblocco precedente.

**Prova browser Windows:** dopo installazione del worker, server locale fermato; refresh della pagina riuscito in stato bloccato e sblocco fittizio della lista aziendale riuscito senza server. Questa prova supera il limite della sola navigazione già caricata della sezione 11, limitatamente alla demo e al browser integrato. Non dimostra il ripristino offline dei dati reali o Safari/PWA.

**Anteprima pronta, non pubblicata:** `firebase.preview.json` configura esclusivamente Hosting sui dieci file fittizi, con CSP, anti-framing, no-sniff e no-referrer. Nessuna configurazione Rules/Functions/Storage. `npm run test:vault-preview` rigenera e verifica inventario chiuso e intercettazione limitata del worker. Il deploy deve usare un canale Hosting temporaneo separato, scadenza sette giorni, dal percorso del laboratorio con il suo config; mai il comando di deploy live. Il link sarà accessibile a chi lo possiede: non definirlo un’area autenticata o privata. Nessun dato personale nei file.

**Verifica finale:** `npm test` superato con 335 test, gate statici ed emulatori Firestore/Storage; due ulteriori test dell’anteprima superati con `npm run test:vault-preview`. Controllati 104 collegamenti relativi a file nei 38 MD, senza destinazioni mancanti; ancore e URL esterni esclusi dal controllo automatico.

**Gate e prossimo intervento:** autorizzazione esplicita al canale temporaneo e collaudo iPhone/Safari/PWA di sblocco, passaggio liste, Indietro/Avanti, refresh, background/timeout e avvio offline. Questa verifica anticipata serve a validare la direzione prima di ampliare la migrazione degli orchestratori. Restano aperti pagine complete, login/verifier reali, scritture, recupero e compatibilità multi-dispositivo. Nessuna dichiarazione di pronta produzione; rollback del laboratorio senza dati da ripristinare.

## 14. Anteprima temporanea pubblicata — 12/09/2026

Il product owner ha autorizzato esplicitamente la pubblicazione dell’anteprima di sette giorni. Pubblicato il contenuto del commit `fc9fffe1` tramite il solo config Hosting del laboratorio, canale `vault-shell-fc9fffe1-0912`: dieci file fittizi, nessun backend o dato personale. Il canale scade il 19/09/2026.

URL: https://appcodici-password--vault-shell-fc9fffe1-0912-83dusttn.web.app/

Verifica sul canale HTTPS nel browser integrato Windows: caricamento, sblocco fittizio, lista aziendale, indicazione di disponibilità offline e refresh in stato bloccato riusciti. La precedente prova senza server resta locale; non è un collaudo offline fisico su iPhone. Nessun deploy del canale live, push o merge eseguito.

Resta richiesto il collaudo Safari/iPhone: passaggio fra liste e Indietro/Avanti senza nuovo sblocco; refresh con nuovo sblocco; blocco dopo 60 secondi di inattività; riapertura e sblocco senza rete dopo la preparazione offline. Annotare separatamente l’esito da Safari e dall’eventuale collegamento aggiunto alla schermata Home. Questa anteprima non certifica la migrazione delle pagine complete o l’accesso ai dati reali.

## 15. Annullamento e robustezza del laboratorio — 12/09/2026

Base `ff006c71`. Il proseguimento autonomo riguarda correzioni e verifiche del laboratorio; resta separato il gate fisico precedente alla migrazione delle pagine complete.

**Problemi e correzioni:** il controllo della generazione al termine dello sblocco impediva la pubblicazione tardiva della chiave, ma non impediva una richiesta Master Password dopo un blocco intervenuto durante il caricamento del contenitore. Ora ogni tentativo possiede un AbortSignal: blocco e nuovo tentativo annullano il precedente; il lettore legacy controlla identità e annullamento dopo ogni attesa e passa il segnale alle dipendenze di caricamento/prompt. Una dipendenza deve rispettare il segnale per chiudere effettivamente il proprio prompt o annullare la rete; le primitive Web Crypto già avviate possono terminare, ma non attivano la fase successiva. Nessuna modifica KDF, envelope, record o persistenza.

La dismissione dell’adattatore è idempotente e rimuove la sottoscrizione Auth anche se il callback UI genera un errore. Il router segnala errori di smontaggio, ferma la transizione interessata e permette al gestore di bloccare il Vault; segnala anche errori di cleanup asincrono tardivo. Corretto il titolo di lista privata/aziendale aperta da collegamento diretto in stato bloccato.

**Verifiche:** 32 test del gate laboratorio superati, di cui sette nuovi su annullamento concorrente, prompt tardivi, unwrap impedito e cleanup fallito; due test dell’anteprima superati. Build isolato riuscito. Nel browser Windows verificati aggiornamento del worker locale, titolo aziendale bloccato e sblocco della lista. Non è stata rieseguita la suite produttiva completa: le modifiche riguardano solo il laboratorio e i suoi test.

**Preparazione delle pagine complete, sola lettura:** `privato/account_privati.js` e `azienda/account_azienda.js` mantengono array, utente e ordinamento globali e listener di ricerca/ordinamento senza dismissione dell’inizializzatore. Entrambe leggono `location`, costruiscono header/footer e navigano tramite documenti HTML; entrambe includono scritture pin/archivio/eliminazione. Il privato aggiunge inviti, dati di altri proprietari e refresh dopo scrittura; l’azienda richiede l’identificativo aziendale. Prima del montaggio nella shell occorrono contesto per vista, invalidazione delle letture dopo ogni attesa, smontaggio dei listener, navigazione iniettata e test specifici delle scritture/condivisioni. Il riuso del solo renderer non soddisfa questi requisiti. Nessuno di questi orchestratori viene attivato nella demo.

**Rollback e limiti:** revert dei soli file del laboratorio; nessun dato da ripristinare. Il canale temporaneo già autorizzato può ricevere queste correzioni con lo stesso perimetro fittizio. Il laboratorio non contiene manifest PWA: una prova Safari o di collegamento Home non certifica installazione e ciclo di vita della PWA produttiva. Restano richiesti i collaudi fisici e i gate della sezione 13.

**Pubblicazione e verifica successiva:** il 12/09/2026 aggiornato lo stesso canale temporaneo con il commit `8379af17`; scadenza riportata dalla CLI 19/09/2026. Verificati sul canale HTTPS aggiornamento del worker, titolo aziendale corretto da collegamento diretto, sblocco e blocco automatico con rimozione dei dati dopo oltre 60 secondi senza attività nel browser integrato Windows. Il lettore legacy resta coperto dai test locali, non incluso nel browser della demo. Nessun push, merge o deploy live.

## 16. Esito riferito dal product owner — 12/09/2026

Il product owner ha risposto «ok x 4 volte» alle quattro prove guidate dell’anteprima: navigazione e Indietro/Avanti, refresh con nuovo sblocco, inattività/background e uso senza rete. Si registra l’esito positivo riferito dall’utente, non una prova osservata direttamente dall’agente. Modello iPhone e versione iOS non sono stati comunicati; non si inferiscono altri dispositivi o modalità di installazione.

Il riscontro soddisfa il controllo preliminare della demo su iPhone richiesto prima di ampliare la preparazione degli orchestratori. Non chiude i gate di produzione: autenticazione reale, lettura/scrittura dati, condivisioni, installazione PWA e matrice completa restano da integrare e collaudare. Prossimo blocco: ciclo di montaggio/smontaggio delle liste private e aziendali, con invalidazione delle letture pendenti e contesto di navigazione esplicito. Baseline verificata della demo: commit `8379af17`; registrazione precedente `22e84191`.

## 17. Primo adattamento degli orchestratori reali — 12/09/2026

Base `0a807adb`, successiva al riscontro iPhone della sezione 16. Modificati i due moduli canonici `privato/account_privati.js` e `azienda/account_azienda.js`. Ogni montaggio conserva in una closure separata utente, record e ordinamento; espone subito `{ready, destroy}` e accetta `signal`, query iniziale e navigazione iniettata. Il privato accetta anche `replaceQuery` per il ritorno dopo scrittura. Gli inizializzatori storici restano compatibili, smontano l’istanza precedente e restituiscono la funzione di dismissione; `pages-init.js` inoltra opzioni e risultato.

**Rischio ridotto:** listener duplicati al rimontaggio e completamenti asincroni che riscrivono la vista successiva. Ricerca e ordinamento usano il segnale della vista; la dismissione distrugge il renderer, svuota record e contenuto e annulla i consumatori. Controlli dopo le attese impediscono ulteriore decifratura/render e impediscono cancellazioni se si è usciti durante conferma o lettura del profilo. Le scritture già inviate non vengono annullate e possono riuscire: viene soppresso solo l’aggiornamento UI tardivo. Nel privato la lettura dei propri account e degli inviti viene attesa con Promise.all, evitando un rigetto non gestito della prima mentre si attende la seconda.

**Compatibilità:** URL HTML e percorso repository restano i default; nessun nuovo documento canonico, schema, formato crittografico o migrazione dati. Non viene introdotto un nuovo blocco su `pagehide` nelle pagine produttive: senza un bootstrap persistente completo altererebbe il ripristino da bfcache. Il chiamante futuro deve annullare il segnale su uscita, logout, cambio UID e blocco. I collegamenti HTML del footer restano da gestire nella shell; montaggi contemporanei nello stesso DOM non sono supportati. La demo pubblicata continua a utilizzare il renderer, non questi orchestratori.

**Prove mirate:** 19 test eseguono il sorgente reale dei due moduli con confini DOM/repository/Firebase simulati e dati fittizi. Coprono rimontaggio, ricerca/ordinamento, caricamento tardivo, decifratura interrotta, conferma cancellazione tardiva, pin in corso, percorsi di scrittura, archivio/eliminazione riusciti, dissociazione email e segnale già annullato. Test di navigazione: 48 superati. Sintassi e budget statico delle 30 pagine superati. Le prove non inviano scritture al database reale e non certificano autorizzazioni remote o UI completa su dispositivo.

**Rollback e prossimo blocco:** revert dei due moduli e dell’inoltro in pages-init, senza ripristino dati. Restano da collegare autenticazione/Vault alla dismissione, montare le pagine nella shell con template/header/footer e routing completi, integrare condivisioni e verificare i flussi di scrittura sul modello persistente. Nessun push, merge o deploy di queste modifiche.

**Validazione finale del blocco:** `npm test` completato con codice 0, 361 test superati, build e gate statici inclusi, emulatori Firestore/Storage terminati correttamente. Baseline delle 30 pagine rigenerata senza aumentare i budget. Controllati 115 collegamenti relativi a file negli MD senza destinazioni mancanti; ancore e URL esterni esclusi dal controllo automatico. Verifiche limitate a ambiente locale e confini simulati delle nuove prove; nessun collaudo visuale delle pagine complete sul dispositivo.

## 18. Orchestratori canonici nel laboratorio — 12/09/2026

Base `4c1d90b5`. La prosecuzione del programma conserva una sola fase strutturale attiva: sessione Vault e navigazione persistente. La prova ora importa e monta `mountAccountPrivati` e `mountAccountAziendaList`, non soltanto il renderer. Template minimo del laboratorio con gli ID canonici di ricerca, ordinamento e contenitore; header/footer e dettagli produttivi non sono ancora migrati.

**Confini:** il build sostituisce esplicitamente repository, Firebase, security-manager, notifiche e pilot offline con moduli di fixture. Verifica dal metafile che entrambi gli orchestratori reali siano inclusi e che nessun modulo backend originale entri nel pacchetto. Il repository fittizio clona i quattro record dimostrativi, limita UID/azienda e svuota il proprio contesto all’uscita; una dismissione precedente non cancella il contesto successivo. Il Vault dimostrativo cifra ancora la fixture e sblocca in RAM; non usa Auth remoto o contenitori personali. Non si trasferiscono le prove del lettore legacy a questo flusso.

**Sola lettura:** opzione esplicita negli orchestratori e nel renderer condiviso: niente pulsante pin, gestori swipe o azioni di scrittura. I callback di mutazione respingono anche chiamate dirette quando la modalità è attiva; gli adattatori Firebase della demo rifiutano comunque ogni scrittura. Comportamento produttivo predefinito invariato. Dettagli e salvataggi non disponibili sono dichiarati nella demo, senza simulare riuscite.

**Prove:** 364 test della suite completa superati, inclusi build, controlli statici ed emulatori. Quattro test specifici dell’anteprima verificano pacchetto chiuso, worker, clonazione/isolamento delle fixture e inclusione dei veri orchestratori. Nel browser integrato Windows verificati montaggio privato, inversione A-Z/Z-A su due record, ricerca senza risultati e passaggio alla lista aziendale con stato ripristinato. Nessun dato personale usato.

**Restano aperti:** bootstrap autentico, collegamento Auth/blocco/revoca ai segnali, integrazione del lettore legacy nel flusso UI, routing di dettaglio/form/header/footer, condivisioni e salvataggi, collaudo fisico della nuova integrazione e migrazione del resto delle pagine. Il riscontro iPhone precedente resta relativo al commit provato nella sezione 16. Rollback tramite revert di questa integrazione e ripubblicazione del precedente pacchetto fittizio; nessun dato da ripristinare. Nessun deploy live o migrazione.

**Stato della pubblicazione:** candidato locale consolidato nel commit `a32e1785`. Il tentativo di aggiornare il precedente canale Hosting è stato fermato dalla revisione automatica delle autorizzazioni prima dell’esecuzione: copertura dell’autorizzazione precedente ritenuta non sufficientemente esplicita per questo aggiornamento. Richiesta al product owner conferma specifica per lo stesso canale temporaneo, soli dati fittizi e nessun backend. Non dichiarare pubblicato questo commit finché il deploy non è eseguito e verificato; il risultato browser sopra è locale.

**Autorizzazione e pubblicazione completate — 12/09/2026:** dopo la richiesta specifica il product owner ha risposto «autorizzo». Aggiornato il canale `vault-shell-fc9fffe1-0912` con il pacchetto del commit `a32e1785`: dieci file, soli dati fittizi, nessun backend. Deploy concluso con codice 0; scadenza riportata 19/09/2026. Verificati sul collegamento HTTPS aggiornamento della cache dopo ricaricamento, quattro account in panoramica e montaggio della lista privata canonica con ricerca e ordinamento. Il blocco di autorizzazione riportato sopra è risolto per questa pubblicazione. Nessun push, merge o deploy live.

## 19. Coordinamento identità, Vault e viste — 12/09/2026

Base `d906fd50`. Aggiunto `protected-session.mjs` nel laboratorio e collegato alle viste della demo. Il coordinatore riceve esplicitamente provider d’identità e factory Vault; le viste ricevono soltanto UID e lettore legato al contesto, mai la chiave o il gestore Vault grezzo. Le liste canoniche rimangono in sola lettura su fixture.

**Comportamento:** blocco, timeout, uscita e cambio UID smontano la vista e invalidano le letture pendenti. L’identità viene verificata anche dopo una lettura, così una notifica Auth ritardata non consente la restituzione al vecchio contesto. Un rinnovo dell’identità con lo stesso UID mantiene la sessione. Il logout blocca prima di invocare il provider, resta bloccato in caso di errore e impedisce uno sblocco concorrente finché l’uscita non è terminata. La dismissione chiude anche le sottoscrizioni dell’adattatore Vault.

**Prove:** dodici test del coordinatore coprono letture per vista, cambi identità, notifica tardiva, logout fallito/in corso, timeout e dismissione. Una tredicesima prova integra il lettore legacy con vero crypto-utils e contenitore v2 sintetico: lettura riuscita prima del cambio UID, accesso invalidato dopo, sottoscrizioni tutte rimosse. Gate laboratorio aggiornato: 46 test superati; verificato anche il contratto Vault completo. Quattro test dell’anteprima superati. Nel browser Windows verificati sblocco della lista canonica, uscita con rimozione dei dati e nuovo ingresso nella demo.

**Distinzione fra prova e produzione:** l’identità della demo è simulata in RAM; Sblocca demo ripristina un’identità fittizia dopo l’uscita, senza Firebase Authentication. Il collegamento al lettore v2 è verificato dai test e non viene attivato nel browser con dati reali. Restano da integrare provider Auth remoto, provisioning e recupero, MFA/PRF, revoca dispositivi, routing completo e salvataggi. Il coordinatore non è importato dall’app produttiva; nessuna migrazione crittografica, modifica delle Rules o deploy di questo blocco.

**Rollback:** revert dei file del coordinatore e del collegamento nel laboratorio; nessun dato persistito da ripristinare. La precedente anteprima HTTPS resta legata al commit `a32e1785`; non considerare già pubblicata questa evoluzione locale.

## 20. SDK Firebase e sessione protetta in emulatore — 12/09/2026

Base `0e07621d`. Aggiunto `firebase-session.mjs`, collegamento candidato fra Firebase Authentication, lettura Firestore, adattatore Vault v2 e coordinatore delle viste. Riceve istanze SDK già inizializzate e UI Master Password iniettata; non è importato dall’app produttiva o dall’anteprima Hosting. Le viste hanno un lettore di campi Account per UID attivo e ID privato/aziendale validati. Non possono fornire un UID diverso, un percorso arbitrario o un campo fuori dalla allowlist. Identità e segnale vengono ricontrollati dopo getDoc; valori non cifrati vengono respinti.

**Ambiente riproducibile:** `npm run test:vault-emulators` avvia soltanto Auth e Firestore sul progetto fittizio `demo-vault-shell`, con host 127.0.0.1 (9099 e 8085). I test rifiutano l’avvio se mancano gli endpoint emulatori esatti. Il runner copia le Rules originali, senza trasformarle, in `dist/emulators/firestore.rules` ignorato da Git: Firebase CLI non consente un file Rules esterno alla directory del laboratorio. Nessun export/import di dati reali; nessuna Rules o configurazione produttiva modificata. Emulatori e utenti effimeri vengono eliminati con la chiusura del processo.

**Prove:** dieci casi di integrazione più il contenitore di test, undici esiti superati. Creazione di tre utenti fittizi tramite Auth SDK con persistenza in memoria; salvataggio di verifier/envelope v2 e Account cifrati con le funzioni crittografiche originali. Verificati login distinto da sblocco, lettura privata e aziendale, rifiuto di campo/percorso non ammesso, diniego server a un altro proprietario, Master Password errata, logout con diniego anonimo, passaggio al secondo utente con chiave diversa, dismissione e assenza di provisioning implicito per Vault non configurato.

**Finding confermato, non chiuso:** i test possono scrivere sotto il proprio UID un record con password in chiaro e uno con ownerId incoerente. Le Rules correnti li ammettono; il nuovo lettore li respinge con CIPHERTEXT_REQUIRED/OWNER_MISMATCH. Questo è un limite di validazione server già incluso nell’audit generale, non una correzione delle Rules né una prova di conformità del database. Prima di introdurre restrizioni reali servono inventario degli schemi legacy, compatibilità, test e approvazione del relativo blocco.

**Limiti:** getDoc è una dipendenza diretta del laboratorio per verificare SDK e Rules, non sostituisce il repository canonico nell’app. Le letture SDK già inviate non sono annullate a livello di rete; si invalida il loro consumatore. Mancano UI browser collegata a Firebase, MFA/PRF/App Check, verifica email secondo il flusso reale, offline persistente sul dispositivo, migrazione legacy, scritture e condivisioni nella shell. Non inferire dal collaudo emulato che i parametri o le Rules siano distribuiti in produzione. Rollback: revert del connettore, test e runner, senza dati personali da ripristinare.

**Validazione finale:** suite completa `npm test` terminata con codice 0 e 388 test superati, incluso il nuovo gate Auth/Firestore; gli emulatori si sono chiusi correttamente. SHA-256 delle Rules originali e della copia emulata coincidente (`36a98f2dd2b27b89c16e287d06e1ecb34612d6b1fffb40f3537a342a479d6571`). Verificati 131 collegamenti relativi a file negli MD, senza destinazioni mancanti; ancore e URL esterni esclusi dal controllo automatico. Nessun push, merge o deploy.

## 21. Interfaccia browser degli emulatori — 12/09/2026

Base `83dffc30`. Questa sezione registra il passaggio intermedio dell'interfaccia minima, poi ampliato nella sezione 22 durante lo stesso blocco di lavoro. `npm run prototype:vault-emulators` avvia Auth/Firestore e una pagina su `http://127.0.0.1:4188`. La prima implementazione preparava due utenti sintetici tramite SDK e le Rules originali, con verifier/envelope v2 e un campo cifrato privato e aziendale per utente. Il browser usa inMemoryPersistence, letture Firestore e decifratura locale attraverso il connettore della sezione 20. Login predisposto e Master Password restano operazioni separate.

**Confini e minacce:** solo progetto `demo-vault-shell`, endpoint emulatori verificati prima del seed, server vincolato al loopback con Host esatto e risorse in allowlist: tre nella versione minima, cinque dopo l'integrazione della sezione 22. Il browser rifiuta origini diverse da 127.0.0.1:4188; CSP limita le connessioni alle due porte emulatori. Nessun worker o cache persistente, risposte no-store. Le credenziali riportate nella pagina sono pubbliche fixture di laboratorio. Questo riduce il rischio di confondere la prova con l'app reale; non costituisce un ambiente per dati personali. Il pacchetto è separato dai dieci file della preview Hosting e non viene distribuito.

**Prompt e dismissione:** input Master di tipo testo mascherato graficamente, autocomplete off e indicazioni ai password manager; non si garantisce il comportamento di ogni estensione. Il prompt cancella il valore e rimuove i listener dopo conferma, annullamento o aborto. Blocco/background/pagehide invalidano il Vault e rimuovono i dati; timeout controllato periodicamente e sugli accessi. Login/sblocco/logout serializzati nell'interfaccia. Il refresh perde l'identità in memoria e richiede un nuovo accesso.

**Prove:** quattro nuovi test del prompt coprono conferma, pulizia, annullamento, aborto anticipato e indipendenza del prompt successivo. Nel browser integrato Windows verificati login A ancora bloccato, Master errata respinta, lettura privata e aziendale A, uscita con schermata vuota, login e sblocco B con lettura del solo dato aziendale B, refresh senza identità o dati. Le prove browser non certificano autofill su tutti i browser o dispositivi fisici.

**Limiti e seguito del passaggio intermedio:** la pagina minima leggeva singoli campi; l'integrazione successiva di liste canoniche e repository è registrata nella sezione 22. Dettagli, salvataggi e condivisioni restano da comporre con questo bootstrap. Nessuna migrazione, modifica della baseline, delle Rules o dei dati produttivi. Restano i finding P0 del runtime storico. Rollback: revert dell'interfaccia e del comando di avvio; nessun dato personale da ripristinare. Il server di laboratorio va arrestato prima del gate emulatori, che usa le stesse porte. Nessun push, merge o deploy di questo blocco.

## 22. Liste canoniche e repository negli emulatori — 12/09/2026

Proseguimento locale del blocco con base `83dffc30`. Il browser monta ora `mountAccountPrivati` e `mountAccountAziendaList` con il renderer condiviso e il repository canonico `vault-repository.js`, inclusi `offline-firestore.js` e `request-coordinator.js`. Le letture delle liste passano quindi dal percorso applicativo reale verso gli emulatori. Il connettore della sezione 20 continua a gestire identità, sblocco e lettore cifrato vincolato alla vista; il suo helper getDoc non sostituisce il repository delle liste.

**Confini verificabili:** `emulator-firebase.mjs` inizializza soltanto il progetto fittizio `demo-vault-shell`, Auth in memoria e Firestore sugli endpoint loopback stabiliti. `build-emulator.mjs` verifica nel metafile la presenza di entrambi gli orchestratori e dei tre moduli dati canonici, respingendo gli ingressi produttivi di configurazione Firebase/sessione Vault e il repository fixture. I confini di `security-manager`, risolutore legacy delle password, pilot offline e mutazioni SDK sono sostituiti con funzioni che rifiutano l'operazione. Logging, traduzioni e notifiche restano adattamenti del laboratorio. Il server ammette cinque asset espliciti: HTML, CSS, bundle JavaScript, font e avatar. CSP e controllo Host mantengono l'isolamento locale; nessun service worker o persistenza Auth/Firestore su disco viene abilitato.

**Fixture finale:** due utenti sintetici, ciascuno con due account privati e due aziendali, per otto record complessivi. Alfa e Zeta permettono di verificare ricerca e ordinamento. Ogni record contiene `nomeAccount`, `username`, `account` e `password` cifrati con crypto-utils originale e la chiave del rispettivo utente; verifier/envelope v2 sono preparati tramite SDK sotto le Rules originali. Il seed non importa dati personali. L'accesso alle liste dell'utente B richiede la sua identità e la sua Master Password.

**Lettura e dismissione:** gli orchestratori accettano un callback `readField` per montaggio. Titolo, username e codice vengono decifrati in copie appartenenti alla vista, rendendo possibili ricerca e ordinamento senza modificare i record restituiti dal repository. La password resta cifrata e viene letta soltanto su richiesta di mostra/copia attraverso lo stesso contesto protetto, senza ricorrere al risolutore legacy. Un errore nella lettura dei campi visibili esclude il record, senza fallback in chiaro o visualizzazione del ciphertext. Abort e controllo dell'identità invalidano completamenti tardivi; smontaggio e blocco eliminano card e stato della vista. Le richieste di rete già inviate possono terminare, ma non ripopolano la vista precedente. Il dialog Master include ora un pulsante Annulla esplicito, oltre a Esc, con il medesimo percorso di pulizia.

**Prove automatiche mirate:** 37 test su orchestratori e renderer superati. Comprendono copie ricercabili, password letta solo su richiesta, rifiuto dei record non leggibili, decifratura completata dopo abort, pulizia dei listener, rimontaggio, mancata copia tardiva negli appunti e mantenimento dei comportamenti canonici di scrittura nei test dei percorsi preesistenti. Cinque test del prompt superati, incluso Annulla e assenza di listener precedenti che interferiscano con un nuovo prompt. La suite completa è stata verificata al termine del blocco, come registrato sotto.

**Prove browser osservate dall'agente principale:** nel browser integrato Windows, login A con Vault ancora bloccato; sblocco e visualizzazione dei due account privati Alfa/Zeta; mostra/nascondi della password di Alfa; ricerca Zeta; ordinamento Z-A; passaggio agli account aziendali con ripristino A-Z; blocco con rimozione delle card; logout; login e sblocco B con visualizzazione dei soli Alfa/Zeta aziendali di B. Sono prove dirette della UI locale con fixture, non risultati del canale Hosting o del dispositivo iPhone.

**Revisione indipendente:** un secondo agente ha esaminato in sola lettura inizializzazione Firebase, build, seed, montaggio delle liste e integrazione dei lettori, senza rilevare finding concreti di isolamento, accesso al gestore legacy o esposizione tardiva del plaintext nel perimetro verificato. La revisione non costituisce audit crittografico indipendente dell'applicazione produttiva e non chiude i finding P0 preesistenti.

**Limiti e rollback:** sola lettura, con pin/swipe/salvataggi disattivati; dettagli, routing completo, template/header/footer produttivi, scritture, provisioning/recupero e condivisioni restano da integrare. Il callback attuale ammette il proprietario autenticato e non implementa decifratura di account condivisi da altri utenti. Il riuso di offline-firestore non certifica avvio offline, cache persistente, comportamento PWA o matrice fisica. Nessuna migrazione di dati, modifica delle Rules, push, merge o deploy di questo blocco; l'anteprima pubblica resta quella della sezione 18. Rollback tramite revert del laboratorio e delle opzioni candidate aggiunte ai mount/renderer, senza dati personali da ripristinare.

**Validazione finale del blocco:** `npm test` terminato con codice 0: 403 test superati, build, controlli statici, Rules/Functions e gate Auth/Firestore inclusi. Quattro test separati della preview superati dopo ricompilazione: pacchetto ancora chiuso e privo del backend emulato. Il controllo statico di navigazione è stato aggiornato alla nuova firma della callback password; il comportamento lazy è coperto dai test eseguibili. Inventario: 447 file; 141 collegamenti relativi a file nei 38 MD verificati senza destinazioni mancanti (ancore e URL esterni esclusi). La versione applicativa resta 1.2.110; nessuna pubblicazione del nuovo laboratorio.

## 23. Dettaglio base protetto e ritorno alla lista — 12/09/2026

Base `70a6c4c5`. Il laboratorio locale consente ora di aprire un account dalla lista privata o aziendale, leggere le credenziali e tornare alla lista senza ricaricare il documento. `emulator-detail-view.mjs` riusa `createAccountListView` in sola lettura con una singola card; non importa né migra gli inizializzatori completi di dettaglio. Questa è una composizione sperimentale di un renderer canonico, non una nuova pagina produttiva o il completamento della migrazione dei dettagli.

**Percorso e capacità di lettura:** `account-detail-reader.mjs` riceve il contesto protetto e le funzioni canoniche `getPrivateAccount`/`getCompanyAccount`. L'UID deriva dall'identità autenticata, mentre dominio e ID vengono verificati prima della lettura. Dopo il repository, presenza del record, identità e segnale sono ricontrollati. Il lettore conserva copie dei soli ciphertext di `nomeAccount`, `username`, `account` e `password`, ed espone un oggetto congelato con `has(field)` e `read(field)`: il dettaglio non riceve chiavi né il record cifrato originale. La lettura usa il callback Vault della vista e ricontrolla identità/segnale al completamento. Nella fixture il repository legge i campi cifrati e non riceve i valori decifrati; ciò non certifica la conformità dei record produttivi.

**Controllo proprietario:** l'assenza del campo `ownerId` resta ammessa per il percorso proprietario legacy. Quando il campo è presente deve coincidere esattamente con l'UID attivo; valori espliciti nulli, vuoti, non stringa o appartenenti a un altro utente vengono respinti. Nel nuovo percorso con `readField`, l'orchestratore privato conserva il proprietario ricevuto senza normalizzare questi valori in un UID valido. Il comportamento del percorso legacy senza callback resta invariato; questa verifica client non sostituisce la validazione degli schemi nelle Rules, ancora aperta.

**Routing e stato temporaneo:** `account-route.mjs` accetta soltanto le due destinazioni canoniche di dettaglio, con parametri ammessi una sola volta, identificatori decodificati una sola volta, proprietario corrente e azienda nel perimetro previsto dal laboratorio. Destinazioni esterne, parametri aggiuntivi o duplicati e selezioni fuori contesto sono respinti. Selezione, ricerca e ordinamento rimangono in RAM. Il ritorno ripristina ricerca e ordinamento della lista, mentre le password ripartono nascoste; blocco e logout cancellano selezione e stato conservato della lista.

**Rendering e dismissione:** titolo, username e codice sono letti prima del rendering con verifiche tra gli await. La presenza della password produce soltanto un marcatore interno; mostra/copia invocano la capacità di lettura su richiesta. Nessuna nota, referente, banca, allegato, condivisione, widget o azione di modifica viene aggiunta a questo dettaglio base. Il cleanup viene registrato prima delle letture, rimuove listener, distrugge il renderer e rimuove soltanto il wrapper della propria vista, impedendo che un completamento vecchio cancelli la nuova. Gli errori si propagano al coordinatore senza fallback in chiaro.

**Correzione emersa dalla revisione:** individuato nel renderer un intervallo tra microtask in cui il blocco poteva intervenire dopo la risoluzione della password ma prima della visualizzazione o copia negli appunti. Aggiunto il ricontrollo del segnale nel punto dell'azione, con due prove di aborto nell'ultimo intervallo di attesa e una prova che impedisce notifiche tardive dopo una copia già inviata agli appunti. Una copia già inviata può terminare: non viene promessa la sua cancellazione. L'agente revisore ha eseguito queste tre prove contro il sorgente precedente caricato in memoria: tutte fallivano, confermando la riproduzione dei difetti. Sul sorgente corretto la suite swipe/renderer supera 13 test. Questa evidenza corregge i casi osservati; non estende il collaudo a ogni operazione degli orchestratori legacy.

**Finding mantenuti aperti:** il dettaglio aziendale canonico incrementa `views` anche nel percorso readonly; per questo il laboratorio non ne attiva l'inizializzatore. Entrambi gli inizializzatori completi conservano stato globale e dipendenze di allegati/condivisioni/sessione da migrare. Inoltre il repository originale compone alcuni record come `{id: snapshot.id, ...data}`: un campo `data.id` può prevalere sull'ID dello snapshot. Questo comportamento non è corretto nel presente blocco e resta da trattare nel repository con valutazione della compatibilità legacy. I controlli della selezione e della proprietà qui introdotti non ne certificano la risoluzione.

**Prove mirate:** superati otto test del parser, otto del lettore protetto, sette del dettaglio e due ulteriori test proprietario negli orchestratori; superati anche i 13 test swipe/renderer indicati sopra. Nel browser integrato Windows l'agente principale ha osservato: utente A, lista privata con ricerca Zeta e ordinamento Z-A, apertura di Zeta e mostra password, ritorno con ricerca/ordinamento conservati e password nuovamente nascosta; apertura di Alfa aziendale e mostra password; blocco con rimozione dei dati. Sono prove locali con fixture, non del canale Hosting o dell'iPhone. La validazione finale del blocco è registrata sotto.

**Limiti e rollback:** restano aperti inizializzatori completi di dettaglio, form e salvataggi, condivisioni, header/footer e resto delle pagine, persistenza offline e matrice fisica. Nessuna modifica di dati personali, Rules o contratti crittografici; nessun push, merge o deploy di questo blocco. Il rollback consiste nel revert del routing/dettaglio sperimentale e delle modifiche candidate associate, senza dati personali da ripristinare. L'anteprima pubblica resta quella della sezione 18 e la versione applicativa resta 1.2.110.

**Validazione finale:** `npm test` terminato con codice 0: 432 test superati, build e gate statici, Functions, Rules Firestore/Storage e dodici test Auth/Firestore inclusi. Quattro test aggiuntivi della preview passati dopo ricompilazione. Inventario rigenerato: 453 file, 30 pagine entro i budget; verificati 146 collegamenti relativi a file nei 38 MD senza destinazioni mancanti (ancore e URL esterni esclusi). Lavoro svolto da quattro agenti incluso il principale, con modifiche assegnate a file separati e revisione integrata. Nessuna pubblicazione del laboratorio.

## 24. Identità dei record e campi aggiuntivi del dettaglio — 12/09/2026

Base `755c68ed`. Il blocco interviene su due livelli distinti: corregge nei sorgenti applicativi canonici l'identità dei record e alcuni comportamenti di dettaglio readonly; amplia soltanto nel laboratorio locale il dettaglio con note e sito web. Le correzioni ai sorgenti dell'app non costituiscono una pubblicazione e non rendono gli inizializzatori completi di dettaglio già migrati nella shell.

**Identità canonica del documento:** le letture del repository attribuiscono autorità all'ID dello snapshot Firestore dopo i dati del documento, impedendo che un campo `data.id` sovrascriva l'identificatore fisico restituito al chiamante. La ricerca per ID legacy resta disponibile come fallback esplicito: l'alias individua il documento, ma il risultato espone il suo ID fisico. La query può essere accorpata fra richieste simultanee, mentre ogni consumatore riceve una copia separata del record; una normalizzazione o decrittazione locale non modifica gli oggetti degli altri consumatori. Diciannove test del repository superati coprono l'identità restituita e questi confini. Non vengono cancellati o riscritti gli alias memorizzati, né migrate sotto-collezioni o relazioni che li utilizzino: l'inventario di tali dati e l'eventuale migrazione restano separati.

**Dettaglio aziendale canonico:** corretto il finding della sezione 23 relativo a `views` e al pulsante Modifica. La modalità readonly non mostra l'azione di modifica e non incrementa le visualizzazioni; il callback verifica nuovamente il rapporto proprietario/visitatore prima di navigare. L'incremento consentito al proprietario verifica anche che identità e contesto corrispondano ancora a quelli della lettura iniziata. Cinque test proprietario/visitatore superati verificano il comportamento corretto. Questo intervento circoscritto non converte in readonly tutti i moduli dipendenti né conferisce lifecycle completo all'inizializzatore.

**Dettaglio privato e alias:** la risoluzione del documento precede l'inizializzazione dei moduli allegati/condivisioni e l'abilitazione della modifica. Il dettaglio conserva separatamente ID richiesto e ID fisico risolto; le azioni e i moduli ricevono quest'ultimo. La compatibilità dell'ingresso tramite alias resta disponibile, senza riutilizzare l'alias come percorso di modifica. Dodici test superati verificano collegamento ai moduli, percorso di modifica, sola lettura e caricamenti tardivi. Ogni caricamento controlla la propria generazione e il contesto dopo le attese; il vecchio pulsante allegati viene disattivato prima della nuova ricerca e i callback conservati vengono respinti fuori contesto. Anche ogni reload disattiva il pulsante allegati: dopo un errore rimane nascosto, e un caricamento riuscito installa una nuova azione. Questa preparazione non elimina lo stato globale e tutte le dipendenze legacy del dettaglio.

**Note e sito web nel laboratorio:** la capacità `account-detail-reader.mjs` estende la propria allowlist da quattro a sei campi, aggiungendo `note` e `url`. Anche questi valori provengono da copie di ciphertext del repository e vengono decifrati soltanto dal lettore della vista con controllo di identità e segnale. `detail-extra-fields.mjs` riceve esclusivamente la capacità `has/read`, il segnale e i callback di copia/errore; non importa Firebase e non riceve chiavi. Le note sono testo con interruzioni di riga conservate; il sito web viene mostrato come testo con il comando Copia, senza apertura esterna. Le fixture locali includono entrambi i campi cifrati: nessun dato personale o modifica di schema produttivo.

**Pulizia e gestione degli errori:** le letture aggiuntive sono sequenziali, con controlli prima e dopo gli await. Il cleanup viene registrato prima di leggere, cancella valori e testo raggiungibili dal componente, rimuove i listener e soltanto il proprio wrapper. La copia è iniettata e controlla il segnale immediatamente prima e dopo l'operazione; una copia già inviata può terminare senza notifiche tardive. Gli errori di lettura e copia espongono codici fissi, senza inoltrare messaggi del provider che potrebbero contenere dati. Un errore rimuove l'output parziale invece di mostrare fallback non decifrati.

**Prove del dettaglio sperimentale:** superati sette test dei campi aggiuntivi, nove del lettore e nove del wrapper di dettaglio. Le prove automatiche verificano testo non interpretato come HTML, ritorni a capo, copia tramite callback, errori sanitizzati, letture/copie tardive e rimozione del solo contenuto appartenente alla vista. Nel browser integrato Windows l'agente principale ha osservato, per Alfa privato dell'utente A, la nota su due righe, il sito web come testo e i comandi Copia; il blocco ha rimosso i dati. La copia effettiva negli appunti non è stata verificata nel browser in questa sessione: è coperta qui soltanto dai test automatici con callback iniettato. `npm test` terminato con codice 0: 477 test superati, inclusi build e gate emulatori; quattro test separati della preview superati. Dopo l’ultima correzione del pulsante allegati, rieseguito il gate navigazione: 75 test superati, inclusi i 12 del dettaglio privato (un caso aggiuntivo rispetto alla suite completa). Tutte le 30 pagine rispettano i budget esistenti, senza aumentarli. Controllati 155 moduli JavaScript; inventario di 458 file e 151 collegamenti relativi nei 38 MD senza destinazioni mancanti (ancore e URL esterni esclusi).

**Perimetro e rollback:** il pacchetto emulato resta separato dall'anteprima HTTPS. Nessun push, merge, deploy, cambiamento delle Rules o migrazione dei dati in questo blocco; versione applicativa invariata a 1.2.110. Restano aperti migrazione completa degli inizializzatori, scritture nella shell, condivisioni, allegati/widget, collaudi fisici e finding P0 della sessione legacy. Rollback tramite revert delle correzioni ai sorgenti e dell'estensione locale del dettaglio, senza dati personali da ripristinare; un eventuale intervento successivo sugli alias persistiti richiederà un piano proprio.

**Gate di compatibilità prima della pubblicazione:** allegati memorizzati sotto un percorso account con ID alias e widget con riferimenti storici allo stesso alias potrebbero non risultare visibili passando al solo ID fisico. Il blocco non ha inventariato dati produttivi né implementato una lettura compatibile dei riferimenti persistiti. La correzione resta candidata locale: prima del rilascio occorre verificare questi casi e completare la compatibilità o una migrazione verificata, senza cancellare riferimenti o dati sulla sola base della normalizzazione del repository.

**Revisione dei riferimenti storici:** i metadati e i file allegati usano `users/{uid}/accounts/{accountId}/attachments/...`; il file conserva il proprio `storagePath`. Le Rules attuali non richiedono un documento account padre esistente per questi allegati. Widget e credenziali comuni conservano invece `accountId` e identificatori di collegamento che lo incorporano; le Functions attuali verificano l’esistenza dell’account alla creazione, perciò eventuali widget storici riferiti ad alias non sono dati accertati. Una compatibilità futura dovrà respingere alias ambigui, preservare provenienza, `storagePath`, widgetId e linkId, ed evitare riscritture implicite. Questo è un piano da verificare, non una lettura doppia già implementata.

**Prossimo blocco P0:** preparazione di patch cifrate tramite capacità Vault vincolata a UID, generazione e segnale della vista, senza esporre chiavi o attivare scritture UI. Primo perimetro: sei campi di account privato isolato, round-trip con crypto-utils esistente e rifiuto dei completamenti dopo blocco/logout. Il successivo salvataggio emulato dovrà riusare `applyPrivateAccountMutation` e i controlli M6 di revisione/idempotenza; nessun nuovo percorso diretto che li aggiri.

## 25. Preparazione cifrata delle modifiche nella sessione in RAM — 12/09/2026

Base `b792b1c0`. Blocco sperimentale della fase P0: aggiunge una capacità di cifratura alla sessione e un preparatore di patch per account privato isolato. Nessun comando di salvataggio viene attivato nella UI e nessuna patch viene inviata al backend. Non è completata la migrazione dei form canonici.

**Capacità e ciclo di vita:** `memory-vault.mjs` mantiene la chiave nella propria closure e delega la cifratura al modulo originale tramite l’adapter. La vista riceve `encrypt(value)`, vincolata a identità e segnale; il risultato viene ricontrollato dopo l’operazione asincrona. Blocco, timeout, logout, cambio UID e smontaggio impediscono la restituzione del risultato alla vecchia vista. Una operazione crittografica già iniziata può terminare internamente: non viene promessa cancellazione della primitiva o azzeramento fisico della memoria JavaScript.

**Formato e limiti:** viene riusato `crypto-utils.encrypt` con il materiale Vault già sbloccato, conservando il formato attuale e il comportamento del keyring legacy. Non vengono introdotti algoritmo, KDF, AAD o Record Key nuovi. Poiché il modulo originale restituisce invariata la stringa vuota, questa capacità iniziale rifiuta valori vuoti e non stringa; la cancellazione di un campo richiede una semantica successiva esplicita. Il risultato deve essere ciphertext riconosciuto, senza fallback plaintext.

**Preparazione della patch:** `prepare-private-account-patch.mjs` accetta soltanto modifiche non vuote a `nomeAccount`, `username`, `account`, `password`, `note` e `url`. Verifica il contesto e i marcatori del record prima di cifrare; rifiuta altri campi, record non dichiarati account/private, condivisioni, banca e collegamenti Profilo dichiarati. La provenienza dal percorso Firestore privato resta responsabilità del chiamante: i soli marcatori non certificano il dominio del documento. L’assenza di collegamenti esterni richiede `hasProfileLink: false` esplicito: è evidenza fornita dal chiamante, non un inventario autonomo del database. Il risultato contiene solo i campi modificati cifrati; non include record sorgente, chiavi, operazione di scrittura o revisione da inviare. La fonte non viene modificata e gli errori della preparazione non inoltrano messaggi del provider.

**Gate del futuro writer M6:** questa patch non è direttamente un payload accettato e semanticamente compatibile con `applyPrivateAccountMutation`. Il backend attuale limita `nomeAccount` a 240 caratteri e tratta titolo/URL secondo il modello storico; cifrarli entrambi richiede verifiche di schema e lettori. Inoltre il servizio M6 valida l’isolamento del record fornito ma non prova da solo l’assenza di relazioni Profilo esterne o condivisioni nel record corrente. Prima del salvataggio emulato occorrono un adapter verificato, controllo autorevole dei vincoli e conservazione di revisioni/idempotenza/conflitti. Non viene aggiunto un percorso `updateDoc` alternativo.

**Validazione:** `npm test` terminato con codice 0: 506 test superati; quattro test separati della preview superati. Nel blocco, 57 prove di sessione/adapter includono 17 nuovi casi; nove prove del preparatore coprono anche bozza mutata durante attesa, valori non ammessi, output parziale, annullamento ed errori sanitizzati. Le 14 prove SDK emulato includono round-trip della capacità e di tutti i sei campi della patch, con documento Firestore verificato invariato. Revisione indipendente dei sorgenti e riesecuzione di 66 prove senza finding bloccanti nel perimetro. Verificati 155 moduli JavaScript, budget di tutte le 30 pagine, inventario di 460 file e 156 collegamenti relativi nei 38 MD senza destinazioni mancanti (ancore e URL esterni esclusi). Nessuna nuova prova UI: la capacità non ha un comando visibile.

**Perimetro e rollback:** nessuna scrittura su dati reali, modifica delle Rules/Functions, migrazione, push, merge o deploy. Versione 1.2.110 invariata. Il rischio P0 dello storage della sessione produttiva e i gate degli alias del blocco 24 restano aperti. Rollback tramite revert della sola estensione sperimentale, senza dati da ripristinare.

## 26. Preparazione M6 e transazione originale su dati emulati — 12/09/2026

Base `6432cad8`. Il blocco collega sperimentalmente la preparazione cifrata al formato dell’operazione M6 e ne esercita il backend originale contro dati sintetici. Non aggiunge un pulsante di salvataggio al laboratorio né abilita un nuovo percorso produttivo.

**Perimetro del preparatore:** `prepare-private-account-mutation.mjs` prepara un aggiornamento di record esistente, con identità/dominio dichiarati, ID fisico e revisione espliciti e coerenti con il record sorgente. Riusa la cifratura protetta e limita i campi modificabili a username, codice account, password e note. Titolo e URL vengono preservati senza modificarne il formato: non viene aggirato il gate di compatibilità dei sei campi del blocco 25. Il chiamante fornisce operationId e deviceId stabili; il preparatore non crea coda, non invia richieste e non memorizza plaintext. I marcatori e l’evidenza di assenza di collegamenti Profilo non sostituiscono una verifica autorevole del dominio o delle relazioni.

**Prova del backend:** il test dedicato usa gli emulatori Auth e Firestore nel progetto demo. Importa il modulo Functions originale soltanto dopo avere verificato progetto ed endpoint, e chiama `applyPrivateAccountMutation.run` con un’identità sintetica nel contesto del test. Vengono quindi esercitati validator e transazione reali contro Firestore emulato, senza avviare il server Functions o installare trigger di notifiche. Questo percorso non collauda il trasporto callable HTTP, la verifica del token Auth, App Check, IAM o la configurazione pubblicata.

**Gate mantenuti aperti:** il backend attuale valida il record proposto ma non verifica nella transazione tutte le relazioni del record corrente; un controllo client non risolve questo limite. Il formato storico di titolo/URL, l’inventario degli alias, la migrazione delle pagine, le scritture dei domini complessi e il P0 della sessione produttiva restano aperti. Una richiesta già inviata al backend non può essere considerata annullata soltanto perché la vista è stata chiusa. Questo blocco non promette salvataggio UI, coda offline, recupero di esiti incerti o cancellazione di richieste inviate.

**Validazione mirata:** dieci test del preparatore superati, usando il validator M6 originale; sette esiti del gate emulato (sei scenari e contenitore) superati. Verificati applicazione del ciphertext, rilettura protetta, incremento revisione, retry idempotente, revisione obsoleta senza scrittura, collisione di operationId, namespace dei due UID e rifiuto di dati invalidi. Il runner disabilita il rilevamento dei metadati cloud e impone progetto demo ed endpoint locali prima di importare Admin/Functions. Esito della suite completa registrato dopo la correzione del modulo azienda nel blocco 27. Le prove non coprono un writer UI o una richiesta HTTP concorrente.

**Rollback e pubblicazione:** nessuna modifica a Functions/Rules produttive, dati reali, cifratura originale o versione 1.2.110; nessun push, merge o deploy. Rollback tramite revert del preparatore e delle prove locali; i dati sintetici degli emulatori non richiedono migrazione.

## 27. Falso conflitto nella modifica dei contatti azienda — 12/09/2026

Base `6432cad8`, correzione sorgenti nel commit `73fbe022`. Segnalazione del proprietario durante il blocco 26: cancellando un numero e premendo Salva compare “Contatti modificati: ricarica prima di salvare” e il dato non viene aggiornato. Non sono stati letti o modificati i dati personali per riprodurre la segnalazione.

**Difetto riprodotto:** `ma_save.js` confrontava le mappe dei contatti tramite JSON.stringify. Oggetti equivalenti con diverso ordine di inserimento delle proprietà producevano un falso conflitto, anche quando l’unica modifica voluta era la rimozione del telefono. Il nuovo confronto è strutturale: l’ordine delle chiavi delle mappe non conta, mentre valori, campi e posizione degli elementi negli array continuano a contare. Il controllo delle modifiche concorrenti rimane attivo.

**Freschezza del modulo:** online `modifica_azienda.js` legge tramite `getCompanyConfirmed` nel repository, attendendo il server prima di abilitare Salva; errore o record mancante non fanno ripiegare sulla copia obsoleta. Offline rimane la lettura cache preesistente, senza introdurre salvataggi offline aziendali. Questa correzione evita che il modulo online inizi da una copia locale vecchia mentre il refresh in background aggiorna soltanto la cache.

**Prove:** la cancellazione di un telefono non collegato con chiavi email riordinate fallisce sul sorgente precedente (nessuna scrittura) e passa sul sorgente corretto. Nove test profilo azienda superati, inclusi conflitto reale che resta bloccato e telefono collegato che richiede prima lo scollegamento. Cinque test del caricamento eseguono repository e gestione cache originali con SDK simulato, verificando server online, errore/mancanza senza fallback, cache offline e creazione senza lettura. La prova riproduce un difetto compatibile con la segnalazione, senza certificare la situazione del record reale.

**Validazione complessiva:** npm test terminato con codice 0, 531 test superati inclusi entrambi i gate emulati; quattro test separati della preview superati. Budget delle 30 pagine rispettati e baseline rigenerata; inventario di 464 file, 162 collegamenti relativi nei 38 MD verificati senza destinazioni mancanti (ancore e URL esterni esclusi).

**Rilascio e rollback:** correzione candidata locale, nessuna pubblicazione, migrazione o scrittura su dati reali. Restano invariati collegamenti Account e regole che richiedono Scollega prima di eliminare un contatto collegato. Rollback tramite revert dei tre moduli interessati e dei relativi test; nessun dato da ripristinare.

## 28. Rilascio isolato della correzione azienda — 12/09/2026

Il proprietario ha autorizzato di proseguire dopo la correzione segnalata. Creata worktree separata da master `fa555d49`, branch `fix/company-contact-save-conflict`, trasferita soltanto la correzione del blocco 27 e preparata v1.2.111. Preservato il mapper ID della produzione: il test di freschezza verifica separatamente il payload legacy e il percorso fisico richiesto. Nessun codice sperimentale della shell, modifica alle Rules o alle Functions incluso.

Commit release `cba1efe29d8f3ffbd2ba9889524a4effbd910094`; [PR #45](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/45) validata e unita in master `f4d9393b9c4b9b1f3a7eeb4b6d3ec9f16b84dea8`. La suite della base produttiva supera 301 test, inclusi 14 mirati alla regressione; non va confusa con i 531 test del ramo sperimentale. Versione, 236 query asset e file generati inclusi nel commit; inventario e baseline rigenerati.

[Workflow Hosting](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/34712067898) avviato su master, validazione e deploy conclusi con successo. Verificati via HTTPS sul sito pubblico env-v126.js, ma_save.js, modifica_azienda.js, vault-repository.js e sw.js: identici alla release dopo normalizzazione delle terminazioni di riga. Nessuna cancellazione di contatti reali eseguita per il collaudo. Il programma sperimentale resta sul proprio ramo; il rilascio non chiude il P0 o gli altri gate. Rollback: Hosting del precedente master `fa555d49`.

## 29. Esito incerto, retry e verifica del salvataggio — 12/09/2026

Base `1b6a13ed`, fase strutturale P0 ancora sperimentale. Il salvataggio preparato dal blocco 26 richiede una distinzione tra rifiuto prima dell’invio ed esito sconosciuto dopo l’invio: un errore di trasporto non dimostra che il server non abbia salvato. Il nuovo controller mantiene una sola operazione in RAM, con preparazione, invio e ricerca dell’esito iniettati; nessun SDK, chiave, coda persistente o comando UI viene aggiunto dal controller.

**Retry e contesto:** il tentativo successivo riutilizza lo stesso envelope cifrato e operationId, senza ricifrare la bozza o cambiare revisione. Un esito sconosciuto impedisce di iniziare un’altra modifica. La ricerca dell’esito usa l’ID dell’operazione e verifica i metadati del risultato; un documento assente resta un esito sconosciuto, perché può essere in corso oppure la transazione può aver restituito un conflitto senza registrarlo. Il conflitto non produce rebase o sovrascrittura automatica. UID, segnale e disponibilità della vista sono controllati prima dell’invio e dopo le attese. Un invio già effettuato può completarsi dopo blocco/logout: il controller non promette annullamento del backend e non aggiorna una vista dismessa.

**Finding sul backend corrente, da risolvere prima della UI:** le Rules originali consentono al proprietario anche la scrittura di `users/{uid}/operationResults/{operationId}`, tramite il wildcard delle sottocollezioni. Il risultato non è quindi una prova di provenienza backend. La callable privata verifica dominio/recordId dell’esito precedente ma non lo lega a un digest del payload: un risultato precedente compatibile può essere trattato come successo duplicato senza applicare la modifica. I controlli del controller su UID, ID e revisione non correggono questo problema. La prova emulata caratterizza il comportamento esistente, senza indicarlo come sicurezza superata. Restano necessari namespace degli esiti non scrivibile dal client e legame verificabile dell’esito con l’operazione prima di affidare alla UI la conferma del salvataggio.

**Limiti del blocco:** trasporto e lookup sono capacità iniettate; i test usano il backend originale `.run` e Firestore/Auth locali, non HTTP/App Check. Le Rules, Functions e la coda M6 produttive non sono modificate. Un refresh perde il controller in RAM: il recupero dopo riavvio, il coordinamento multischeda e il riaggancio dopo un nuovo sblocco richiedono l’integrazione con la coda canonica. L’isolamento autorevole del record corrente, la compatibilità titolo/URL e gli altri gate dei blocchi precedenti rimangono aperti.

**Validazione mirata:** 20 test del controller superati. Il gate di transazione emulata supera 13 esiti (12 scenari e contenitore), inclusi perdita della risposta dopo commit, riconciliazione, retry identico, isolamento fra UID e annullamento prima dell’invio. Riprodotto anche il finding operationResults: un esito sintetico scritto dal proprietario induce un successo duplicato senza aggiornare il record. Questo caso caratterizza il difetto, non lo risolve. La validazione complessiva è registrata nel blocco 30. Il controller non viene pubblicato nell’app. Rollback del blocco tramite revert del controller e dei test; nessuna migrazione o dato reale da ripristinare.

## 30. Dati azienda aggiornati dopo il salvataggio — 12/09/2026

Richiesta del proprietario: mostrare immediatamente inserimento, modifica o eliminazione dopo Salva. Nel percorso precedente il form attendeva artificialmente un secondo, poi apriva il dettaglio che poteva mostrare la cache senza ridisegnarsi dopo il refresh server.

**Correzione candidata:** dopo conferma del salvataggio, creazione e modifica aprono subito il dettaglio con `afterWrite=1`. `dati_azienda.js` richiede una lettura confermata dal server per quel passaggio, e rimuove il parametro soltanto dopo caricamento e rendering riusciti. La normale consultazione conserva la lettura local-first. I callback dopo modifica/scollegamento Account richiedono anch’essi un refresh confermato. Un errore non riporta silenziosamente la vecchia cache come dato appena salvato; offline conserva la copia disponibile con avviso esplicito e parametro ancora presente.

**Ciclo delle richieste:** generazione della vista e contatore delle letture sono distinti: risposte tardive non sovrascrivono il contesto successivo, callback di una vecchia azienda/identità non avviano nuove letture, mentre un refresh fallito nella stessa vista può essere ritentato. L’aggiornamento non elimina le protezioni sui conflitti o sui contatti collegati.

**Prove:** 12 test del profilo azienda includono ritorno immediato dopo salvataggio/creazione confermati e nessuna navigazione dopo errore. Test del dettaglio verificano valore nuovo o rimosso, server dopo scrittura, consultazione ordinaria, errore/mancanza senza fallback, offline esplicito, callback dopo collegamento, isolamento dei callback e retry dopo errore. Suite completa sperimentale terminata con codice 0: 568 test; dopo la correzione finale del retry, rieseguiti 21 test profilo/dettaglio (nove del dettaglio, un caso aggiuntivo). Quattro test separati della preview superati. Budget delle 30 pagine rispettati; inventario di 467 file e 169 collegamenti relativi nei 38 MD senza destinazioni mancanti (ancore e URL esterni esclusi). Correzione sorgenti nel commit `ca7736a5`; pubblicazione isolata da verificare.

**Perimetro:** richiesta riferita al profilo azienda. Non è un collaudo automatico di ogni form dell’app. Nessuna modifica a Rules/Functions, dati personali o schema; rollback della correzione tramite revert dei moduli e controlli di navigazione interessati. Il laboratorio Vault resta separato dal rilascio azienda.

## 31. Pubblicazione isolata 1.2.112 — 12/09/2026

La correzione del blocco 30 è stata trasferita dalla base produttiva `f4d9393b` nel branch `fix/company-after-save-refresh`, commit sorgenti `2d02b1f5` e release `974a4bd62a75498d51377ed3d341f2806440c197`. Suite produttiva: 313 test superati, inclusi 21 mirati; versione e 236 riferimenti asset verificati. La [PR #46](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/46), validata da CI, è stata unita in master `e448568f4672acc333b85422ee95c1b9f04a0da8`.

Il [workflow di pubblicazione](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/34712964705), avviato su tale master, ha concluso con successo validazione e deploy del solo Hosting. Verificati via HTTPS env-v126.js, ma_save.js, dati_azienda.js, vault-repository.js e sw.js: corrispondono alla release 1.2.112 dopo normalizzazione delle terminazioni di riga. Nessun contatto reale modificato per il collaudo. Il ramo sperimentale, Rules e Functions non sono stati pubblicati; i gate del programma restano aperti. Rollback Hosting alla precedente release 1.2.111, master `f4d9393b`.
