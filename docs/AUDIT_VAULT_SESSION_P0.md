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

## 32. Provenienza e identità degli esiti di salvataggio — 12/09/2026

Base locale `a795b462`. Il finding del blocco 29 richiede due controlli distinti: impedire al client di creare conferme e impedire di riutilizzare una conferma per un payload diverso. Le callable private e offline generica usano il nuovo percorso `/mutationResults/{uid}/operations/{operationId}`, prima non autorizzato dalle Rules. Una nuova sottocollezione sotto `users` non sarebbe sufficiente: il wildcard storico avrebbe permesso di prepararvi documenti falsi in anticipo. Le Rules candidate consentono al proprietario la lettura puntuale degli esiti e riservano le scritture al backend; anche il vecchio namespace viene escluso dal wildcard in scrittura.

Il backend calcola un digest SHA-256 della rappresentazione canonica dell'operazione validata, insieme a UID e dominio. L'esito conserva digest, versione del legame, identità dell'operazione, record, dispositivo e revisione attesa. Il retry deve corrispondere a tutti questi dati. Il digest non è una firma: la provenienza dipende dal percorso mai scrivibile dal client. Nessuna chiave o nuovo plaintext viene introdotto nel risultato.

**Compatibilità e gate di attivazione:** un esito presente soltanto nel vecchio namespace non viene promosso o considerato affidabile e non provoca una nuova applicazione automatica. La richiesta viene respinta mantenendo i dati e la coda. Prima del rilascio occorre completare il recupero comprensibile delle code pregresse e verificare inventario, ordine di distribuzione Rules/Functions e rollback su ambiente non produttivo. Un semplice ritorno alle vecchie Functions dopo nuove operazioni perderebbe il nuovo registro di deduplicazione: non è un rollback certificato. Nessuna migrazione, cancellazione o pubblicazione di Rules/Functions eseguita in questo blocco.

Il controller sperimentale richiede anche l'operationId nel lookup. La coda canonica non elimina più un'operazione sulla sola presenza di `duplicate: true`: serve l'esito `applied`. Identificatori e revisioni sono validati senza conversioni implicite; la revisione assente conserva la baseline legacy zero, una revisione presente ma malformata viene respinta. L'isolamento autorevole dei record e dei collegamenti Profilo, l'integrazione UI e i gate fisici rimangono aperti. Le altre callable di cronologia, widget e condivisione conservano i loro percorsi storici: il blocco non ne certifica la deduplicazione pregressa.

**Validazione:** suite completa `npm test` conclusa con codice 0, 591 test superati. Comprende 37 test Functions con sintassi/ESLint, 21 test Rules, 20 esiti di integrazione mutazioni (19 scenari e contenitore), Storage e sessione emulata. I casi nuovi verificano falsificazione negata, payload/device/revisione cambiati, separazione UID e domini, risposta persa, precedenza dell'esito nuovo rispetto al legacy e rifiuto delle revisioni server malformate. I controlli di trasporto usano gli handler reali `.run` con Auth/Firestore emulati, non HTTP o App Check remoto. Inventario di 469 file; budget delle 30 pagine rispettato; 173 collegamenti relativi nei 38 MD senza destinazioni mancanti (ancore e URL esterni esclusi). Nessun dato reale usato.

## 33. Punto di ripresa concordato per limite token — 12/09/2026

Blocco verificato nel commit `311a9421`, 591 test; produzione ferma alla 1.2.112, master `e448568f`. Nessuna nuova pubblicazione. L'avvio del recupero legacy è stato sospeso prima di integrare codice non collaudato; il ramo conserva il blocco verificato.

Prossimo lavoro: distinguere il rifiuto legacy tramite `failed-precondition` con `details.reason = LEGACY_MUTATION_RESULT_UNVERIFIED`; aggiungere stato di riconciliazione alla coda e gestirlo in entrambi i percorsi del form. Non riusare senza correzioni il recupero conflitti attuale: elimina l'operazione prima della decifratura/ripristino del modulo. La copia cifrata deve restare conservata finché l'utente sceglie esplicitamente il server o una sostituzione viene salvata/accodata atomicamente. Il ramo save deve riconoscere lo stato nuovo per evitare un falso toast di successo. Restano test di errore decifratura, chiusura, cambio UID, doppia scheda, recupero e rollback prima del deploy backend.

## 34. Ponticelli Account pubblicati separatamente — 12/09/2026

Solo modifica grafica dei ponticelli laterali fra Account collegati, trasferita in `fix/account-link-bridges` dalla produzione 1.2.112. Release 1.2.113, PR #47 unita nel master `844f53addeb819710e41c08431d642ebc8b90f3e`; 313 test della base produttiva superati. Workflow Hosting `34715601727` completato con successo. Verificati via HTTPS env-v126.js, impostazioni.css, dati_azienda.js, vault-repository.js e sw.js: corrispondono alla release. Rules, Functions e programma sperimentale esclusi dal rilascio. Rollback Hosting alla 1.2.112. Rimane attivo il ramo sperimentale; i branch storici già uniti via PR non sono stati eliminati e quelli senza PR richiedono un controllo separato.

## 35. Widget comuni nei form Account — 12/09/2026

Caso segnalato: credenziale comune collegata a due Account aziendali, visibile nel dettaglio ma assente dai form. I form caricavano soltanto i widget embedded. Correzione sorgenti `e7888abd`: sezioni e inizializzazione anche per shared-reference in privato/azienda; editor dei valori con conferma della propagazione, revisione invariata fino al salvataggio, protezioni UID anche dopo cifratura e rifiuto della decifratura fallita. Collegamento e scollegamento disponibili nel form; dettaglio di consultazione. Struttura e metadati originali conservati. Nessun valore reale modificato per il collaudo.

Rilascio isolato 1.2.114, commit `56368d1bc86599fd14b0576fe677b34029ddfa89`, PR #48 unita in master `b34bf710a71984a34dd048ce848b136251b575be`. Suite completa della base produttiva: 320 test superati; include quattro test comportamentali editor, due di sessione client e quattro dei widget/form. Sintassi, HTML, riferimenti, 239 versioni asset e budget pagine verificati. Workflow Hosting `34716831131` concluso con successo. Env, modulo condiviso, entrambi i form HTML e service worker online corrispondono alla release. Nessun deploy Rules/Functions o programma sperimentale. Rollback Hosting alla 1.2.113.

## 36. Riuso Credenziali comuni e selettore widget — 12/09/2026

Sorgenti consolidati nel commit `2cf8d8af`. Pulsante esplicito nei form privato/azienda, incluso il percorso crea → salva confermato → selettore; il menu widget propone le Credenziali comuni utilizzate altrove senza duplicare valori. Filtraggio del solo collegamento corrente per contesto/azienda/Account, protezione della sessione durante il selettore, colori delle opzioni e disposizione responsive.

Rilascio isolato 1.2.115, commit `f6cba92fa1698b0814825218fffcfe41b9b4db36`, PR #49 unita in master `856fabe8e758ff8a4165b6a3be111e1815fc22fd`. Suite completa produttiva: 326 test superati con emulatori; 240 riferimenti asset coerenti, HTML/CSS/sintassi e budget pagine superati. Workflow Hosting `34717784547` completato con successo. Verificati via HTTPS dieci file: versione, form, salvataggi, moduli widget/comuni, CSS e service worker corrispondono alla release. Nessun dato reale modificato durante i test. Nessun rilascio Rules/Functions o programma sperimentale; rollback Hosting alla 1.2.114.

Nota separata sul ramo sperimentale: i dieci test mirati passano; la baseline rigenerata segnala profilo_privato.html a 336,1 KB gzip contro 336 KB di budget. Il limite non è stato aumentato. Questo scostamento deve essere risolto prima del rilascio del programma sperimentale e non riguarda la base produttiva verificata. Il recupero legacy resta sospeso al punto descritto nel §33.

## 37. Uniformità grafica selettore widget — 12/09/2026

Correzione CSS `2c6da4cb`: sfondo trasparente del controllo e colori delle opzioni coerenti con le modali chiare/scure. Release isolata 1.2.116, commit `87477d264cc26dcec77ecc9dd094af83df6ad93f`, PR #50 unita in master `7e2000c80b907de17a98c9d070d700ba38cbefe6`. CSS, versione, shell offline e budget pagine verificati localmente; suite CI completa riuscita. Workflow Hosting `34718435775` completato con successo, dieci file online corrispondenti alla release via HTTPS. Nessuna modifica funzionale, ai dati o al backend. Rollback Hosting alla 1.2.115. Rendering del menu nativo ancora dipendente dal browser/dispositivo; nessun collaudo fisico aggiuntivo eseguito.

## 38. Visibilità iniziale linguette azienda — 12/09/2026

Correzione sorgenti `366a98db`: gli otto pannelli legacy non attivi ora hanno hidden nell’HTML, oltre al pannello tessera digitale già nascosto. Verificati dieci pannelli: solo Panoramica inizialmente visibile. L’attivazione esistente ripristina la scheda memorizzata dopo la lettura dati. Nessun cambiamento ai collegamenti o ai dati.

Release isolata 1.2.117, commit `83513576b6e36c0ef91b7b000841067552f50903`, PR #51 unita in master `445b338dd9320f4854eb97bc2f3e90cb60a59a0f`. HTML, shell offline, versione e budget verificati; suite CI completa riuscita. Deploy Hosting `34719109968` riuscito, undici file verificati via HTTPS corrispondono alla release, incluso dati_azienda.html. Rollback Hosting alla 1.2.116. Backend e programma sperimentale esclusi.

## 39. Ripresa autonoma per blocchi verificati — 12/09/2026

Autorizzazione utente: proseguire il programma, registrando i punti che richiedono intervento e continuando sui blocchi indipendenti. Un solo ramo `experiment/persistent-vault-shell`, commit distinti; nessun merge o deploy implicito delle modifiche strutturali. Produzione resta alla 1.2.117 (`445b338d`).

Commit verificati:
- `91effaca`: le due callable distinguono legacy non verificato con failed-precondition e reason; otto test handler aggiuntivi, nessuna nuova scrittura.
- `95b8adaf`: sostituzione atomica IndexedDB e marker di riconciliazione nel contenitore cifrato. CAS, collisione ID, ordine, errore cifratura/transazione e cambio sessione coperti da undici test della coda.
- `c6fb7ff5`: marker persistente impedisce retry automatici; recupero nel modulo conserva l'originale fino a sostituzione atomica o scelta esplicita server. Decifratura rigorosa, revisione server fresca, stato e lifecycle controllati. Esiti non confermati e lease occupato non dichiarano salvato. Cinque test UI recupero, più synchronizer/client.
- `0d1ae576`: editor Profilo caricato su azione con guard UID/generazione/DOM. Tre test; pagina a circa 333,7 KB gzip, senza aumento del budget di 336 KB.
- `99ac08d4`: guard del record corrente nella transazione privata. Impedisce di eliminare implicitamente condivisione, banca, archivio, proprietario o collegamenti dichiarati con payload ridotto. Retry già attestato resta consultazione. Riferimenti inversi/alias ancora da censire.

Suite completa `npm test` conclusa con codice 0: 642 test superati, inclusi Functions, Rules, Storage, sessione e mutazioni emulati. Non equivale a certificazione dei dispositivi fisici. Nessuna migrazione, dato reale o pubblicazione backend in questo blocco.

## 40. Decisioni e collaudi lasciati aperti senza bloccare lavori indipendenti

| Punto | Perché resta aperto | Lavoro proseguibile |
|---|---|---|
| iPhone e Windows: ripresa, chiusura, conflitti, lista bancaria offline | La precedente prova iPhone non è superata; servono dispositivi reali e dati fittizi | Test automatici e lifecycle canonici |
| Inventario riferimenti inversi/alias Profilo | Il guard controlla solo campi dichiarati nel record; non certifica assenza di altri link | Policy e test negativi del record corrente |
| Deploy Rules/Functions e rollback | Vecchie Functions ignorano il nuovo registro mutationResults; tornare alla vecchia versione non è un rollback valido | Preparazione artefatti e prove locali di compatibilità |
| Recupero di record divenuti condivisi/bancari/archiviati o eliminati | La copia resta cifrata e bloccata; non può essere riscritta come account isolato | Consultazione, mantenimento server esplicito e altri record |
| Retention M7, ripresa backup M8, App Check remoto e audit indipendente | Richiedono scelte/verifiche specifiche; non chiusi dai test locali | Blocchi che non dipendono da tali decisioni |

Prima del deploy strutturale: usare ambiente non produttivo separato; verificare lettore nuovo/vecchio e marker di coda, Rules che negano esiti client e Functions che usano soltanto ricevute attendibili. Provare risposta persa, retry, errore legacy e ripristino della copia senza segreti nei log. Un eventuale artefatto di rollback deve mantenere il nuovo registro e la deduplicazione: non distribuire le vecchie Functions come scorciatoia. L'ordine esatto e la prova di rollback restano gate documentato, non esecuzione autorizzata su produzione.


## 41. Widget, riferimenti inversi e checkpoint multi-commit — 12/09/2026

Commit `3f40efbc`: controllo autorevole dei riferimenti inversi nei Profili privati e aziendali prima di nuove mutazioni private. Le ricevute attendibili continuano a precedere ogni verifica aggiuntiva. ID legacy divergenti e strutture malformate sono respinti senza correzioni automatiche. Il punto inventario del §40 è avanzato per i campi noti: restano risoluzione degli alias, altri domini e valutazione della scansione completa delle aziende sotto carico.

Commit `59ebff4e`: widget e dialoghi appartengono al montaggio della vista; blocco Vault anche a UID invariato, logout, cambio vista e pagehide invalidano le operazioni in attesa e cancellano i valori UI. Crea/modifica delle credenziali comuni e dei widget ricontrollano la sessione dopo cifratura. Il timer del salvataggio privato non naviga da una vista scaduta. Il renderer bancario si carica su richiesta; form privato entro 42 moduli iniziali, circa 328,1 KB gzip, senza aumento dei budget.

Validazione complessiva: `npm test` codice 0, **669 test** superati; include 55 test Functions e 22 esiti delle mutazioni con Auth/Firestore emulati. Le nuove combinazioni dei riferimenti inversi sono verificate tramite handler reale con transazione simulata; la suite emulata verifica anche l'esecuzione delle nuove letture con SDK reale, senza certificare ogni combinazione o la concorrenza sotto carico. Budget di tutte le 30 pagine rispettati; versione candidata 1.2.110 e 240 riferimenti asset coerenti; 38 MD, 174 collegamenti relativi senza destinazioni mancanti (ancore/URL esclusi); inventario 482 file.

Nessun dato reale, migrazione o deploy in questo checkpoint. Produzione resta 1.2.117. Il costo del controllo inverso cresce con tutte le aziende dell'utente; scala/contesa, prove fisiche, distribuzione e rollback strutturale restano aperti. Le richieste già inviate al server non vengono annullate dalla dismissione UI. Il programma completo non è dichiarato terminato.


## 42. Ripresa continuativa: offline, purge e backup — 13/09/2026

Base `141259d9`. Commit distinti:

- `51f43532`: rifiuti permanenti del perimetro privato sospesi nella coda cifrata, senza retry automatici; scelte esplicite server/più tardi e test emulatori dei riferimenti inversi.
- `1b8ada9d`: pulizia Profilo del purge distingue Account privati e aziendali, include telefoni/documenti/utenze/fonti aziendali e preserva il resto dei contatti. I marker legacy null di link rimossi non bloccano inutilmente M6. Query completa e limite 450 patch; fallimenti finali non dichiarano purged.
- `273de41b`: ripristino backup legato alla sessione; dialoghi e piano ripuliti a blocco/cambio UID, nessun falso successo dopo interruzioni. `expectedOwnerUid` obbligatorio lato server prima di accedere a Firestore. Riprodotto con utenti sintetici l'ordine del metodo getToken dell'SDK installato: il token può essere scelto dopo un microtask, quindi il solo controllo client non bastava.

Verifica finale della candidata a `273de41b`: suite completa `npm test` codice 0, **700 test** superati, inclusi 65 Functions, 24 esiti mutazioni Auth/Firestore emulati e 13 nuovi test client backup. Le prove della callable backup e del finale purge usano handler reali con servizi simulati; non sono un collaudo Storage/Functions di ripristino end-to-end. Budget di tutte le 30 pagine rispettato; versione candidata 1.2.110, 240 riferimenti asset coerenti. Nessun dato reale o deploy. Produzione invariata alla 1.2.117.

Limiti mantenuti aperti: staging/compensazione backup, confronto atomico con anteprima, ricevute storiche degli altri domini, race purge/ripristino, widget e grant residui, dimensione/contesa delle scansioni, prove fisiche. Backend backup nuovo e client vecchio non sono compatibili: distribuzione coordinata e rollback che mantenga il vincolo proprietario sono gate, non operazioni eseguite. Il prossimo adattamento indipendente riguarda il ciclo di vita del dettaglio Account aziendale canonico.


## 43. Dettaglio aziendale e ricevute backup — candidata 13/09/2026

Il dettaglio Account aziendale canonico cattura proprietario, visitatore, azienda e Account per ogni montaggio. Cambio vista, logout, blocco Vault e pagehide invalidano letture, decifratura, import differiti e callback ancora in attesa; rimuovono dati e azioni della vista precedente. Allegati, condivisioni, selettore sorgente, file picker e copia bancaria rispettano lo stesso contesto. I dialoghi sono personalizzati e appartengono alla vista. I controlli statici sono riallineati ai callback senza aumentare baseline o budget.

Sedici test mirati sul dettaglio e sui permessi ospite passati; la suite completa è registrata nel checkpoint successivo. La preparazione riguarda la pagina canonica: non abilita una nuova rotta nella shell. Richieste già iniziate non sono annullate dal solo teardown.

Il writer backup usa ora ricevute attendibili vincolate al comando; le ricevute storiche non autorizzano successo o ripetizione. I nuovi test helper/handler e quelli sul proprietario passano con servizi simulati. Il confronto atomico con l'anteprima e la compensazione rimangono da implementare. Nessun dato reale, migrazione o deploy in questa sezione.

Checkpoint `99dabb19`: **731 test** superati nella suite completa (`npm test`, codice 0), inclusi 82 Functions e 25 esiti mutazioni con Auth/Firestore emulati. Controlli statici, budget delle 30 pagine e dipendenze superati. Commit `7063b9b3` vincola anche M6/widget al proprietario; `e3882995` isola il dettaglio aziendale; `99dabb19` verifica le ricevute backup. Produzione invariata, versione candidata 1.2.110.


## 44. Anteprima backup e confronto transazionale — candidata 13/09/2026

Base `dc985f64`. Classificazione e versione sono prodotte dalla stessa snapshot server; applicazione condizionata a tutte le versioni del chunk, incluso il Profilo, con consenso per sostituire gli esistenti. Il client mantiene gli indici originali nelle selezioni non contigue, rifiuta risposte incomplete o vecchie e interrompe i passi successivi a `stale-preview`. La UI distingue una nuova anteprima necessaria da un possibile ripristino parziale.

Suite completa `npm test` codice 0, **742 test** superati. La revisione successiva dei tipi ha corretto il metodo binario non disponibile nell'Admin SDK e il confronto di numeri non finiti: suite Functions ripetuta sul risultato finale, **89 test** superati, più test mirati export/encoder/UI. Sintassi dei 156 moduli e budget di tutte le 30 pagine rispettati; candidata 1.2.110, 239 riferimenti asset coerenti (rimosso l'import dal servizio export nel percorso import). I test handler usano Firestore simulato; nessuna pretesa di ripristino Storage end-to-end.

Il protocollo richiede rilascio coordinato e rollback che conservi proprietario, ricevute e precondizioni. Nessun dato reale, migrazione o deploy. Staging globale, compensazione, ripresa fra esecuzioni e dispositivi restano aperti.


## 45. Archivio: sessione, proprietario e ricevute — candidata 13/09/2026

Base `bdc0d5f8`. Il commit `df8243a5` vincola il purge al proprietario atteso prima degli accessi. Il blocco UI/servizio successivo cattura UID e identità completa dell'Account, invalida letture/decifratura/dialoghi/azioni a blocco o cambio montaggio, distingue ID coincidenti nei contesti e interrompe lo svuotamento prima dell'elemento successivo dopo invalidazione. Un solo dialogo di conferma per vista; pulizia di nomi, filtro e timer precedenti.

Le ricevute purge sono ora verificate nel registro protetto; conferma richiesta anche per riprese/duplicati. Il finale transazionale verifica nuovamente la ricevuta prima di attestare il completamento. Legacy non promosso, nessun fallback permissivo.

Suite completa `npm test` codice 0: **771 test** superati, inclusi 106 Functions e 11 nuovi test Archivio frontend. Budget delle 30 pagine rispettato; candidata 1.2.110 e 240 riferimenti asset coerenti. Test ricevute con handler reale e servizi simulati; la suite emulata non certifica un purge distribuito end-to-end. Nessun dato reale, migrazione o deploy; produzione resta 1.2.117.

Restano aperti concorrenza purge/ripristino, recupero UI delle operazioni incerte con stesso ID, pulizia widget/grant residui, retention, staging e compensazione backup, prove fisiche e distribuzione coordinata.


## 46. Ripresa esplicita del backup nella sessione — candidata 13/09/2026

Base `f67c8d7b`. Piano di esecuzione privato e immutabile, una sola esecuzione contemporanea, ID/comandi stabili e avanzamento conservato. Dopo una risposta Firestore persa, la UI propone una scelta esplicita prima di reinviare il chunk incerto. Chunk confermati non reinviati, risultato completato riutilizzato senza upload duplicati. Selezione alterata e rifiuti definitivi non consentono retry; incertezza Storage blocca la ripetizione generica. Logout/blocco/dismissione rilasciano il piano. L'eventualità di precedenti scritture non confermate rimane nel progresso anche dopo un successivo rifiuto certo.

Suite completa `npm test` codice 0, **781 test** superati; inclusi 18 test servizio backup e 10 UI, 106 Functions. Budget delle 30 pagine e versione candidata 1.2.110/240 riferimenti coerenti. Prove di perdita risposta con server/ricevute simulate, senza dati reali. Nessun deploy; journal durevole, staging e compensazione restano aperti.


## 47. Manifest backup e ripresa Archivio — candidata 13/09/2026

Base `bf3bb010`, correzione Bytes SDK `630972ec`. Allegati selezionati raccolti ricorsivamente e verificati prima di applicare i dati; oggetti duplicati, mancanti o malformati non producono una scrittura parziale iniziale. Nell'Archivio il recupero UI usa piano opaco e comandi stabili dopo scelta esplicita, salta Account confermati e blocca azioni concorrenti. Nessuna ripresa dopo refresh.

Suite completa `npm test` codice 0, **795 test** superati: inclusi 24 servizio backup, 18 Archivio e test della classe Bytes SDK reale. Budget delle 30 pagine rispettato. Nessun dato reale, migrazione o deploy. Staging/persistenza/retention e concorrenza globale restano aperti. Un audit successivo ha riprodotto la mescolanza dei riferimenti A/B nel dettaglio privato durante conferma allegato: è il prossimo blocco, non una correzione inclusa nei 795 test.

## 48. Dettaglio privato e lettura backup — candidata 13/09/2026

Il dettaglio privato cattura identità e documento fisico, invalida conferme, selettori file, import e decifratura dopo blocco/cambio pagina. Il test riproduceva Storage A e metadati B nella stessa eliminazione: ora il cambio contesto impedisce la prosecuzione. Conservati tutti i 12 test degli ID legacy, aggiunti 11 test di ciclo di vita.

Suite completa npm test codice 0: 813 test superati sul blocco privato e sulla lettura incrementale backup (31 test servizio). Il successivo vincolo dei digest fra le scansioni è verificato separatamente nella suite backup: 61 test, di cui 34 servizio. Nessun dato reale o deploy; candidata 1.2.110, 240 riferimenti asset coerenti. L'audit successivo individua gli stessi rischi nel dettaglio Scadenza: intervento in corso, non incluso in questo checkpoint.


## 49. Scadenze e conferma della coda offline — candidata 13/09/2026

Checkpoint 2b306403: il dettaglio Scadenza invalida letture, conferme, allegati, notifiche e footer dopo cambio contesto. Ripristinato l'import della data per le ricevute gestibili; il backend verifica il destinatario atteso prima di accedere ai dati. La coda offline non elimina una versione locale diversa dal comando applicato e non sovrascrive identificatori già usati. Il backup è verificato anche attraverso il callable originale e transazioni Firestore emulati.

Suite completa npm test codice 0: 843 test superati, inclusi 110 Functions, 12 lifecycle Scadenza, 52 offline e 32 mutazioni emulatore (7 backup). Versione candidata 1.2.110, 240 riferimenti asset coerenti; budget rispettati. Verificati 38 MD e 181 collegamenti relativi senza destinazioni mancanti (URL/ancore non verificati). Nessun deploy o dato reale.

Restano distinti e successivi: confronto transazionale del collegamento documento Profilo durante cancellazione Scadenza, protocollo fallback senza Web Locks, concorrenza globale purge e ripristino/staging complessivo. Nessuna fase chiusa dai soli test automatici.


## 50. Transazioni Scadenze e prerequisiti — candidata 13/09/2026

Checkpoint d3bfadd5: la cancellazione Scadenza collegata al Profilo legge il documento nella transazione e scollega soltanto la coppia documentId/deadlineId esatta. Modifiche concorrenti e riferimenti più recenti restano conservati; Profilo mancante non viene creato. La UI spiega il requisito di connessione. Il vero SDK emulato ha ripetuto la transazione dopo un conflitto senza perdita di dati; il blocco prima del retry impedisce cancellazione e scollegamento.

Disponibili due prerequisiti non attivati: lease IndexedDB con token e scritture nella stessa transazione, e planner dei riferimenti residui Archivio. Il primo non modifica il database/runtime e non garantisce invii di rete esclusivi; il secondo non autorizza cancellazioni, conserva le credenziali centrali e richiede un protocollo globale rispettato da tutti i writer.

Suite completa npm test codice 0: 873 test superati, inclusi 121 Functions, 18 Scadenza lifecycle/CAS, 61 offline e 36 mutazioni emulatore. Budget delle 30 pagine e sintassi dei 156 moduli rispettati; candidata 1.2.110 con 240 riferimenti asset coerenti. Nessun dato reale, migrazione o deploy. L'integrazione dei prerequisiti, staging/journal backup, concorrenza globale, prove fisiche, retention e distribuzione restano aperti.

## 51. Integrazione Account UI e Vault — candidata 13/09/2026

Codice verificato `4a431ec3`, ramo `codex/integrate-vault-account-v118`. Input: sperimentale `3660a8383e8b93ba4d982a2c3c4bb1d251fe75d3`, UI `d2ef897e0094a970944db6b8c19ed59c1d36dd22`, master `445b338dd9320f4854eb97bc2f3e90cb60a59a0f`. I sette commit UI sono stati applicati con provenienza cherry-pick; un merge interno al ramo di integrazione conserva l'ascendenza master. I rami sorgente restano invariati.

Risolti i conflitti mantenendo lifecycle, proprietario e ID fisici legacy; renderer bancario caricato in differita nel form privato, azioni Widget invalidate su blocco/logout e stato sola lettura. La vista compatta conserva i nomi dei contatti del proprietario e non legge la sua Rubrica da una vista esterna. Allegati sotto note, un solo base-glow e password di soli spazi preservata. Aggiunti test per Numero verde e referente banca nei due form, dati legacy e accesso al normale editor Widget. I campi bancari nuovi sono metadati secondo i writer attuali: inventario aggiornato, nessuna migrazione.

Suite completa `npm test` codice 0: **887 test superati**, zero fallimenti; inclusi 121 Functions e 36 mutazioni su emulatori. Versione 1.2.118 coerente con 244 riferimenti asset; budget statici delle 30 pagine rispettati senza aumentarli. Le prove di integrazione usano fixture e dati sintetici. Questa verifica non include un nuovo collaudo fisico iPhone/iPad né dati produttivi.

Master e Hosting non modificati; nessuna distribuzione di Rules/Functions. Restano aperti i gate descritti in §50, inclusi shell completa, fallback offline nel runtime, concorrenza globale Archivio, staging/journal backup, retention e prove reali. Il push del ramo candidato non certifica la chiusura M0–M10 e non autorizza il deploy.

## 52. Ripresa del programma dopo UI 1.2.121 — candidata 13/09/2026

Ramo `experiment/vault-shell-v121`: merge `e2edd2b9` fra il candidato integrato `41f63f33` e master `6fc3546e`, senza modificare i rami sorgente. Preservati i controlli Vault e i Widget bancari pubblicati fino alla 1.2.121: posizione sopra le carte, verifica degli identificativi salvati, normale editor e invalidazione delle azioni dopo cambio sessione. Il cleanup elimina anche le schede Widget trasferite nei contenitori bancari esterni, evitando residui visibili dopo blocco/logout.

Il commit `8de71910` aggiunge soltanto nel laboratorio il coordinatore comune IndexedDB/Web Locks. Entrambi i percorsi devono acquisire lo stesso lease; un Web Lock occupato o fallito non viene aggirato. I controlli successivi alle attese e la transazione protetta rifiutano il vecchio titolare; il rilascio conserva un eventuale subentro. Nessuna esclusività di rete promessa, nessuna modifica allo schema o al runtime.

Suite completa `npm test`: codice 0, **913 test superati**, inclusi 128 Functions e 36 mutazioni emulati. Dopo l'ultima correzione del coordinatore (conservare anche rifiuti JavaScript con valore falsy) rieseguita la suite offline: **69 test superati**, inclusi i 7 nuovi scenari ibridi e i 9 del lease. Fixture sintetiche per IndexedDB: nessun nuovo collaudo fisico o dato produttivo. Versione 1.2.121 coerente con 244 riferimenti asset; 30 pagine entro i budget invariati; inventario 514 file.

Gli aggiornamenti UI/bancari risultano già pubblicati su master 1.2.121. Questo checkpoint Vault resta sperimentale e non distribuisce Hosting, Rules o Functions. M6 resta aperta per integrazione runtime, aggiornamento dello store, compatibilità PWA precedenti e prove su dispositivi. Restano inoltre i gate M7/M8, shell completa, retention e distribuzione strutturale: il numero dei test non equivale alla chiusura del programma.

## 53. Avanzamento autonomo offline, backup, salute e Archivio — candidata 13/09/2026

Base `5b3cd4da`, codice finale `f47a55c9`. Sei commit in sequenza: `b4bec892` apertura/ciclo di vita IndexedDB; `44c7f077` limiti cumulativi backup; `5fa297ab` collaudi browser; `0586aa63` unicità delle destinazioni backup; `4fba54e7` revoca dell'analisi credenziali; `f47a55c9` ripristino Archivio CAS.

Suite completa finale `npm test`, codice 0: **941 test superati**, zero fallimenti. Inclusi 128 Functions e 41 prove mutazioni sui soli emulatori demo. In aggiunta, sei scenari browser eseguiti in ciascuno di Chrome headless 152 ed Edge headless 153, su profili temporanei e server loopback senza Firebase: roundtrip cifrato, upgrade sintetico con conservazione del ciphertext, VersionError del vecchio lettore, contesa pagina/Worker e fencing. Queste dodici esecuzioni browser non sono incluse nel conteggio 941 e non equivalgono ai collaudi iOS o alla sospensione fisica.

Versione 1.2.121 coerente, 245 riferimenti asset; inventario 519 file; budget delle 30 pagine rispettati senza aumenti. Il controllo memoria backup è una soglia sui dati ammessi, non una misura esatta dello heap. La verifica Archivio usa il servizio canonico con vere transazioni SDK: aggiorna solo la versione selezionata e conserva dati/updateTime nei casi negativi. La revoca M9 evita risultati tardivi e svuota i riferimenti trattenuti, senza promettere cancellazione fisica delle stringhe JS o annullamento di Web Crypto già partito.

Tutti i rami del blocco appartengono alla stessa catena e vengono raccolti in experiment/vault-shell-v121. Nessun aggiornamento master, Hosting, Rules, Functions o dato reale. Nessuna migrazione e nessuna attivazione dello schema 2 nel runtime. Restano aperti il coordinamento globale purge/ripristino, journal/staging, integrazione completa shell/M5/M6, prove dei dispositivi, retention e approvazione della distribuzione strutturale. Il programma non è dichiarato concluso.

## 54. Integrazione delle note e release 1.2.124 — candidata

Integrato master 9e5335d9 nel ramo experiment/vault-shell-v124, preservando i controlli di sessione di 80ec7837. Note con matita/cestino, listener Auth dedicato e confronto transazionale; nei dettagli sperimentali il modulo riceve signal e isActive della generazione corrente. Il valore cifrato precedente viene acquisito prima della decifratura; gli ID restano quelli fisici risolti dal repository. Test di avvio esteso al rifiuto della generazione invalidata e fixture dei dettagli aggiornate. Suite completa npm test superata, inclusi emulatori. Nessun rilascio strutturale: master e Hosting restano la release UI 1.2.124.


## 55. Scritture offline protette nel laboratorio

Base c82ceab0: createFencedQueueWriter riusa il formato cifrato canonico e protegge inserimento, sostituzione, riconciliazione e rimozione in transazioni con lease e CAS. Sedici scenari browser in Chrome ed Edge, suite offline superata. Il ramo è candidato: nessun import runtime o aggiornamento dello schema produttivo; limitazioni e prossimo passo nel contratto M6.

## 56. Sincronizzatore collegato alla coda protetta

Base 2a79917a. Client candidato con controlli prima/dopo invio e rimozione CAS; stati tardivi soppressi dopo chiusura o perdita del lease. Ventidue scenari browser Chrome/Edge, 59 test offline. Risposte server simulate: il risultato non sostituisce le prove backend. Nessun dato reale, schema runtime o deploy modificato.

## 57. Coda browser e transazioni backend emulato

Base 7f2886b9. Nuovo runner --fenced-browser: cinque scenari Chrome e cinque Edge con coda cifrata IndexedDB reale, handler generico originale invocato direttamente e Firestore demo. Nessuna simulazione delle ricevute in questi casi; risposta HTTP persa simulata dopo commit. Trasporto Firebase pubblico e handler privato non certificati da questo collaudo. Dettagli e comando nel contratto M6.

## 58. Account privati tra coda browser e handler emulato

Base 3b551a7a. Otto scenari privati per browser verificano ciphertext, revisioni, ricevute e riferimenti inversi con handler originale e Firestore demo. Conservazione del marker di riconciliazione e assenza di retry automatico dimostrate. Comando --fenced-browser: 26 esecuzioni complessive sui due domini/browser. Nessuna attivazione runtime o prova del trasporto pubblico.

## 59. Pannello note sperimentale e teardown

Base 7beb3dbf. UI candidata senza chiavi nel DOM, disattivata su abort e rimozione manuale della vista. Prove browser/emulatore di offline/retry e avvii tardivi; 31 test vista/sessione. Il dettaglio accetta un provider opzionale, ancora non configurato nel bootstrap principale. Nessuna attivazione produttiva.

## 60. Rinnovo del lease durante sincronizzazione

Base a7b7d1f8. Rinnovo opt-in nel client candidato, interrotto su fine operazione, abort e chiusura; nessuna conferma tardiva dopo invalidazione. 24 scenari per browser Chrome/Edge e 73 test offline passati. Non attivato nel runtime produttivo; dettagli e limiti nel contratto M6.

## 61. Conferme UI correlate all'operazione

Base 790d3d26. Il pannello candidato usa la conferma del proprio operationId/recordId dopo rimozione protetta, senza confondere esiti di altri Account nella coda. Refresh fallito distinto da salvataggio fallito. 79 test offline e 32 esecuzioni browser/backend emulato superati; nessun cutover.

## 62. Rilettura protetta del dettaglio

Base ec8ced7d. Callback onSaved del provider opzionale rilegge la capability, prepara i nuovi campi e invalida risposte segrete della versione precedente. Cinque regressioni su aggiornamento/errori/teardown; 155 test shell e suite npm test completa passati. Nessun deploy o nuova migrazione. Provider del bootstrap resta aperto.

## 63. Scarto confermato della modifica locale

Base 7471d3c8. Il pannello consente scarto solo del proprio comando in conflitto, con conferma separata e CAS sotto lease. Annullamento e chiusura preservano i confini della vista; il backend non viene modificato dallo scarto. 83 test offline, 155 shell e 34 esecuzioni browser/emulatore superati. Confronto e riproposizione locale restano aperti.

## 64. Confronto protetto delle note

Base 12d4e3f9. Capability di confronto read-only tra comando e record corrente; identità e lifecycle verificati. UI senza HTML interpretato, testo svuotato alla chiusura e coda invariata. 90 test offline e 34 esecuzioni browser/backend emulato superati. Nessuna riproposizione automatica o attivazione nel bootstrap principale.

## 65. Preparazione controllata della riproposizione

Base cc067a12. Proposta della sola nota con conferma, nuova identità stabile e revisione confrontata; altri campi preservati dal preparatore canonico. 95 test offline e 155 shell passati. La proposta non è ancora collegata alla UI o alla sostituzione in coda: nessuna attivazione runtime.

## 66. Riproposizione UI con replace transazionale — 14/09/2026

Base iniziale verificata `65a5d0e7a7de0fe561b1d26b60b7b15ae4fbe93b`, ramo candidato dedicato. Il pannello collega la proposta della sola nota alla UI con confronto e consenso separato; la sostituzione usa il CAS cifrato sotto lease già esistente e registra la nuova identità prima del flush. Errori, annullamento, cambio comando e teardown non eliminano la copia locale né rilasciano testo decifrato. La vista riceve soltanto capability, mai chiavi Vault, SDK o writer non circoscritti.

Il caso browser candidato attraversa la coda IndexedDB, il replace e il backend privato originale emulato, oltre a conservare lo scarto esplicito senza scrittura server. Il runner non dipende più esclusivamente dai percorsi Windows: supporta variabili `CHROME_PATH`/`EDGE_PATH` e candidati Linux. Nel cloud erano assenti entrambi i browser, quindi nessuna prova browser/dispositivo è attribuita a questo checkpoint. `npm ci` e `npm ci --prefix functions` completati; OpenJDK 25 disponibile; 97 test offline e 155 shell superati. Il tentativo sull'emulatore `demo-vault-shell` non ha avviato Firestore perché il JAR non era presente e la rete non ne ha consentito il download. Nessun Firebase reale, deploy, migrazione o attivazione runtime. Restano provider bootstrap, trasporto autenticato, recupero dopo riapertura e rollout.

## 67. Setup locale del runner cloud — 14/09/2026

Base `3018e202`. Aggiunto setup Linux x86_64 senza privilegi globali: installa dai lock npm, estrae Chrome ed Edge sotto `.codex-tmp`, prepara con la Firebase CLI bloccata la cache Firestore e genera gli export dei tre percorsi. La guida elenca domini, file e punto di allowlist richiesti. La modalità `--check` non usa rete. Il commit base non risultava verificabile su GitHub dal workspace: clone privo di remote e GitHub CLI non autenticata; non viene quindi dichiarato pubblicato. Nessun deploy o dato Firebase reale.

## 68. Revisione e collaudo locale della PR #59 — 14/09/2026

Verificato su origin lo snapshot `a3f7f28`, derivato da `65a5d0e7`, sul ramo `codex/trasferire-codici-e-password-su-cloud` verso `experiment/vault-shell-v124`. Nessun contributo dai checkout documentali estranei. La prima prova browser ha riprodotto `UI_REPROPOSAL_NOT_APPLIED`: fixture privata incompleta (URL mancante) e confronto scorretto fra ciphertext prima/dopo una nuova cifratura. Corrette entrambe le aspettative senza allentare il preparatore canonico.

Chiusa la capability di proposta arrivata dopo abort prima di accedere al plaintext; azioni e proposta eliminate dopo scarto. Distinto il mancato lease della sostituzione da quello del flush successivo: dopo esito incerto si conserva l'identità nuova per la ricevuta e si riprova soltanto la coda esistente. Aggiunte quattro regressioni e rafforzata quella sul mancato lease iniziale. Corretto e provato con fixture senza rete lo script Linux, eliminando la cancellazione ricorsiva derivata da un percorso personalizzato.

Esiti locali Windows: 101 test offline, 155 shell nella suite completa `npm test`, Functions, Firestore/Storage Rules ed emulatori superati; runner Chrome/Edge `--fenced-browser` superato (5 scenari generici e 12 privati per browser, incluso scarto verificato nello scenario privato). Sintassi Bash e fixture di setup superate. Il collaudo Linux cloud con download effettivi resta distinto e aperto. Rollback del candidato al checkpoint `65a5d0e7`, senza migrazione. Provider bootstrap, trasporto autenticato, recupero dopo riapertura e rollout non sono attivati da questo lavoro; produzione 1.2.124 invariata.


## 69. Collaudo finale dell'ambiente Linux cloud — 14/09/2026

Base verificata: HEAD `ff78f4d3`, discendente di `bdb952365b2f1b25f26c8b63219968f8efb4dcb8`, working tree iniziale pulito e script setup presente. Dopo `source .codex-tmp/cloud-tools/environment.sh` nella stessa shell, `--check` ha rilevato Node 24.15.0, npm 11.4.2, OpenJDK 25.0.2, Chrome 153.0.8010.36, Edge 153.0.4234.32 e Firestore 1.22.0 in cache. La fixture setup è passata.

`npm test` ha superato i gate fino a Firestore Rules incluso, poi Storage Rules ha tentato di scaricare `cloud-storage-rules-runtime-v1.1.3.jar`: lo setup preparava soltanto Firestore e la rete della fase agente era già disattivata. Il primo runner `--fenced-browser` ha avviato Auth/Firestore esclusivamente su `demo-vault-shell`, ma entrambi i browser estratti terminavano perché il processo gira come root senza `--no-sandbox`. Nessun dato o account reale è stato usato.

Correzione candidata limitata all'ambiente: lo setup usa anche `setup:emulators:storage`, inventaria entrambi i JAR e la fixture ne verifica le invocazioni; il runner aggiunge `--no-sandbox` solo su Linux quando `getuid()` è zero. La fixture aggiornata passa e il runner corretto supera 5 scenari generici e 12 privati per ciascuno di Chrome ed Edge. La cache Storage non è scaricabile con la rete agente disattivata: occorre rieseguire lo setup nella fase con rete, poi ripetere la suite completa. Nessun gate ulteriore M6, versione, deploy, migrazione, configurazione globale o modifica a master.


## 70. Chiusura del collaudo Linux cloud su ambiente nuovo — 14/09/2026

HEAD iniziale `3070d01db3786463c4f7dc833af0c92e4eb7671c`, discendente richiesto verificato e working tree pulito. Senza importare checkout precedenti, la shell persistente ha caricato l’ambiente preparato dalla nuova base. Il controllo ha confermato Chrome, Edge, Java ed entrambi i JAR Firestore/Storage; la fixture setup è passata.

La prima suite completa ha individuato un errore reale al gate Storage condiviso: il runtime inoltrava attraverso il proxy ereditato le proprie letture Firestore loopback, che venivano annullate e producevano rifiuti impropri per proprietario e destinatario. La correzione è confinata al runner Storage: una entry preload seleziona il dispatcher diretto soltanto per gli host esatti `127.0.0.1`, `[::1]` e `localhost`; tutte le altre destinazioni usano il `ProxyAgent` originale e conservano integralmente l'ambiente proxy. Non modifica `node_modules` o configurazioni globali. Due test con dispatcher finti provano sia i loopback ammessi sia host esterni, falsi suffissi localhost, indirizzi diversi e protocolli non HTTP(S). Il test Storage mirato e la successiva `npm test` completa sono terminati con codice 0.

Il runner `--fenced-browser` è poi passato con 5 scenari generici e 12 privati in Chrome e altrettanti in Edge: 34 esecuzioni su Auth/Firestore `demo-vault-shell`, dati sintetici e backend originali emulati. Il trasferimento dell’ambiente Linux è pertanto collaudato. Rimangono aperti, senza avanzamento implicito, provider bootstrap della shell persistente, trasporto autenticato/App Check, recupero dopo riapertura, rollout e prove fisiche M6. Vault Key soltanto in RAM; nessun account reale, deploy, migrazione, bump o master modificato.

## 71. Recupero candidato della nota alla riapertura — 14/09/2026

Base `b5ab595c`. Ispezione della coda cifrata sotto lease, selezione del record senza payload restituito alla vista e rifiuto delle identità ambigue. Il pannello impedisce una seconda preparazione quando esiste un comando pendente e non invia automaticamente all'apertura. Errore di lettura o lock negato conserva la coda e lascia l'editor bloccato; abort chiude il client anche durante l'ispezione. Nessuna modifica del formato o upgrade del database.

23 test pannello superati; suite offline superata prima dell'ultimo test aggiunto, poi pannello rieseguito integralmente. Runner Chrome/Edge con backend emulato superato: 6 scenari generici e 14 privati per browser, inclusi ambiguità e chiusura/riapertura IndexedDB con nuova istanza del pannello. Nessuna prova fisica PWA o attivazione bootstrap. Rollback del solo candidato al commit base, senza trasformazioni persistenti.

## 72. Esportazione vincolata alla sessione — 14/09/2026

Base `4dd2f0a2`, ramo `experiment/m8-export-session`. Export e raccolta dati verificano UID, abort, Vault lock e pagehide prima e dopo le operazioni asincrone. Il sink viene annullato dopo il ritorno dell'operazione pendente; errori provider sanitizzati. La Recovery Key viene rimossa dal dialogo su chiusura o invalidazione, senza riaperture tardive o interferenze fra azioni successive.

Suite completa npm test superata, inclusi emulatori demo; 11 prove servizio e 17 prove UI superate. L'ultima regressione UI sul rimontaggio è passata separatamente dopo l'avvio della suite. Picker nativo, operazioni pendenti e clipboard già avviata non sono annullabili retroattivamente. Nessuna garanzia di azzeramento fisico dello heap, nuovo formato, migrazione o deploy. Limiti aggregati export, staging, journal e compensazione restano aperti.

## 73. Buffer cifrato di esportazione limitato — 14/09/2026

Base `fc3927d2`, ramo `experiment/m8-export-buffer-limit`: fallback Blob con soglia cumulativa di 64 Mi caratteri, rilascio su overflow e nessun download parziale. Percorso progressivo invariato; messaggio di capacità distinto dall'errore generico. 90 prove backup superate; manifest offline aggiornato e controlli offline, riferimenti, performance e sintassi superati. La prima verifica offline ha rilevato il nuovo modulo non ancora inventariato: risolto rigenerando il manifest, senza allentare il controllo. Non certifica lo heap totale o la raccolta iniziale; gate fisici/staging/journal aperti. Nessun nuovo formato o deploy.

## 74. Raccolta dei descrittori backup limitata — 14/09/2026

Base `29263519`, ramo `experiment/m8-export-record-limits`. Ammessi 10.000 record/16 Mi caratteri JSON come nell'import; controllo incrementale prima dell'accumulo, eliminato l'array intermedio per Account. 93 prove backup, budget e sintassi superati; prova overflow impedisce letture aziendali successive, cifratura e chiusura dello stream. Le snapshot SDK e i temporanei non sono inclusi nel limite, quindi nessuna certificazione dello heap o completamento M8. Nessun deploy.

## 75. Chiusura della capability della coda — 14/09/2026

Base `d4d2e644`, ramo `experiment/m6-queue-client-disposal`. Chiavi derivate rilasciate dal writer su close, opzioni client prive del materiale dopo derivazione, abort collegato a close. Writer chiuso e callback sospesi non possono leggere/scrivere la coda. 106 test offline e 44 esecuzioni Chrome/Edge/backend demo superati; la successiva guardia isActive rientra nella suite finale. Nessuna migrazione o attivazione del provider, nessuna garanzia di cancellazione fisica delle stringhe o annullamento di effetti remoti già avviati.

## 76. Navigazione da tastiera Salute credenziali — 14/09/2026

Base `3ed53656`, ramo `experiment/m9-health-keyboard`. Regione risultati nominata/focalizzabile, indicatore focus, ciclo Tab/Shift+Tab ed Escape con ritorno al comando iniziale. Listener rimosso alla chiusura e callback inattivi dopo lock. 20 test UI, CSS e suite completa finale npm test superati, inclusi tutti i checkpoint 71–76. Nessun collaudo fisico attribuito alle fixture DOM, provider di rete o deploy.

## 77. Collegamento candidato del client fenced al callable Firebase — 14/09/2026

Base `82ab2002`, ramo `experiment/m6-firebase-queue-adapter`. Adattatore concreto con Auth/Functions della stessa app, allowlist di due domini/callable, UID verificato, snapshot del comando e dismissione su Auth/abort. Sette regressioni dell'adattatore; 113 test offline e suite completa superati (l'ultima regressione è inclusa nella riesecuzione offline successiva).

52 esecuzioni Chrome/Edge con dati sintetici e backend demo: SDK callable reale, Auth emulato con verifica del JWT, header App Check sintetico richiesto dal bridge; comando accettato, ricevuta, logout e risposta trattenuta dopo commit. L'abort conserva la coda e la sessione successiva verifica la ricevuta senza riscrivere. Nessuna attestazione remota/App Check reale né certificazione del middleware onCall; la richiesta SDK già invocata non è annullabile retroattivamente. Provider e rollout restano aperti; nessun deploy o modifica a master.

## 78. Proprietà della coda nel Vault della shell — 14/09/2026

Base `32db005f`, ramo `experiment/m6-shell-owned-queue`. Factory crittografica iniettata dal bootstrap, facciata di operazioni senza key/DB/SDK, assente dai contesti route. Dismissione immediata su lock, timeout, Auth, segnale della vista, dispose e logout fallito; chiusura dei client tardivi e rifiuto di risposte fuori sessione.

npm test completo superato; 165 test shell e 15 test Firebase emulati inclusi. Chrome/Edge: 52 esecuzioni demo, con apertura della coda attraverso la sessione, commit remoto seguito da lock e retry dopo nuovo unlock senza aggiornare il record una seconda volta. Materiale estratto dall'envelope verificato nella prova Firebase; nessuna chiave restituita alla vista. App Check sintetico e middleware remoto non certificato. Provider UI/entry e rollout restano aperti, nessuna attivazione o migrazione.

## 79. Provider del pannello nota privata — 14/09/2026

Base c4e1a1a8, ramo experiment/m6-private-note-provider. Pannello collegato alla capability della shell con record e UID fissi, revisione catturata alla visualizzazione, preparazione canonica della sola nota e observer revocati insieme alla sessione. Comandi recuperati o alterati non vengono dichiarati note-only: confronto disponibile senza riproposta automatica. Richiesta esplicita evidenza dei collegamenti inversi dal lettore fidato, mai dedotta dal documento incompleto.

Suite completa superata; suite shell finale 178 test dopo l'ulteriore integrazione del pannello DOM simulato. 52 esecuzioni Chrome/Edge della catena coda/sessione/SDK superate. Queste prove browser non coprono ancora il nuovo provider. Entry principale non attivata, lettore fidato concreto e prova browser dedicata ancora aperti; restano rollout e verifiche remote/fisiche. Nessun deploy, migrazione o modifica di master. Dettagli e limiti nel checkpoint corrispondente di M6.

## 80. Lettore fidato e browser del provider nota — 14/09/2026

Da 840128de, stessa PR #63. Lettura server di Account, profilo e aziende con identità controllata prima e dopo le attese. Riutilizzo della policy pura backend; nessuna assenza di link dedotta da cache, scritture pendenti o query troncate. Limite candidato di 200 aziende verificato con il documento aggiuntivo. Metadati id/ownerId derivati dal percorso, senza modificare i documenti.

Il browser monta il provider reale e salva con SDK Firestore/callable e backend emulato; verificati anche rifiuti per link inversi personali/aziendali prima dell'editor. L'entry principale del laboratorio resta da collegare e la prima apertura offline non è coperta; il controllo transazionale server resta autorevole. Nessuna chiusura dei gate di rollout o App Check remoto, nessuna modifica a master o deploy. Esiti finali riportati nel checkpoint di validazione seguente.

Validazione finale audit 80: npm test completo superato (183 test shell e 114 offline inclusi); Chrome/Edge superati, 9 scenari generici e 20 privati per browser, 58 esecuzioni totali. Compresi lettore Firebase reale, blocco dei link inversi e salvataggio del provider. App Check resta sintetico e il laboratorio principale non è ancora attivato.

## 81. Entry del laboratorio e refresh confermato — 14/09/2026

Da 8343282e, stessa PR #63: attivati provider e trasporto esclusivamente su loopback/emulatori per la fixture alfa. Code nuove create in schema 2, nessun upgrade delle esistenti; chiusura su dismissione. Il bridge limita utenti, origine e record e richiede JWT emulato e attestazione sintetica. Gli Account incompatibili mantengono la consultazione.

Il collaudo end-to-end dell'entry ha rilevato e corretto il refresh da cache: dopo la ricevuta viene usata la lettura canonica server-confirmed, senza fallback. Aggiunte regressioni su dettaglio consultabile, prevalidazione, modalità confermata e apertura/chiusura della coda demo. Prova ripetibile con --entry-browser; nessuna attivazione nella PWA pubblicata. Gate offline iniziale, rollout e verifiche remote/fisiche restano aperti.

Validazione finale audit 81: suite completa npm test superata, inclusi 189 test shell e 114 offline. Regressioni Chrome/Edge della coda: 58 esecuzioni superate. Nuovo collaudo dell'entry: 5 verifiche per browser, 10 esecuzioni superate (68 totali). Dopo le ultime guardie di chiusura, rieseguiti i 21 test mirati di coda/dettaglio e il collaudo dell'entry. Nessuna prova App Check remota o su dispositivo fisico.

## 82. Recupero offline con rete realmente disabilitata — 14/09/2026

Da 48b1eae6, stessa PR #63: apertura del solo recupero coda in assenza di rete, senza letture server o preparazione di nuovi comandi. Coda vuota e ritorno online non abilitano implicitamente l'editor. Le verifiche online fallite restano fallimenti, senza fallback che inventi assenza di link.

DevTools disabilita la rete del browser di prova, confermata dal fallimento di HTTP. La sequenza comprende salvataggio offline, blocco e nuovo sblocco del Vault, riapertura del record, retry offline conservativo, ritorno online e aggiornamento della nota dopo ricevuta. Cache e autenticazione erano già disponibili nella stessa sessione; avvio a freddo e riapertura fisica PWA restano non certificati. Nessuna persistenza della chiave, migrazione o deploy.

Validazione finale audit 82: npm test completo superato, inclusi 191 test shell e 116 offline. Chrome/Edge: 58 regressioni coda/provider e 18 verifiche dell'entry (9 per browser), 76 esecuzioni totali. La rete viene disabilitata dal protocollo DevTools, con HTTP effettivamente bloccato; superati recupero, nuovo sblocco offline e retry al ritorno online. Questa prova non certifica avvio a freddo o PWA fisica.

## 83. Consultazione dei domini in cache e password dei profili — 14/09/2026

Da 3af7006b, stessa PR #63. Corretta la sola lettura delle password collegate nei profili privati/aziendali: cache offline, server confermato online, controllo UID e proprietario prima della decifratura. Test dei quattro incroci profilo/Account e del mancato accesso a record assenti o discordanti.

Matrice sintetica del repository canonico e della decifratura protetta: Account personali/aziendali, profili, contatti, indirizzi, dati documenti, IBAN/PIN/CCV, widget del profilo, scadenze e metadati allegati. Caricamento online esplicito prima della rete DevTools disabilitata; documento mai caricato correttamente indisponibile. Non è collaudo di tutte le schermate: file Storage, foto/QR, Widget Account, credenziali condivise, avvio a freddo e gate fisico bancario rimangono distinti. Matrice e limiti dettagliati in M6; nessun deploy.

Validazione finale audit 83: npm test completo superato (inclusi 191 test shell, 116 offline e 65 test dei collegamenti dei profili). Collaudo entry su Chrome ed Edge: 25 verifiche per browser, 50 esecuzioni superate, con rete DevTools disabilitata e ripristinata. Questa matrice certifica letture dei dati sintetici già caricati nella sessione del laboratorio, non avvio a freddo, tutte le UI o file Storage offline.

### Audit 84 — ciclo online/offline e blocco della consultazione (14/09/2026)

Base 2dc18daa, stessa PR #63. Il collaudo dell'entry verifica esplicitamente che la matrice dei dati già caricati sia ancora consultabile dopo il ritorno online e che il probe protetto rifiuti la lettura dopo blocco del Vault, sia offline sia online. Chrome ed Edge: 28 verifiche per browser, 56 esecuzioni superate con emulatori e fixture locali. Modifica limitata al collaudo: nessun cambiamento runtime produttivo. La suite completa resta quella superata sul checkpoint precedente; non viene dichiarata rieseguita in questo incremento.

Programma: avanzamento della verifica M6, senza chiusura globale. Restano avvio a freddo/cache persistente, file Storage, copertura delle UI e compatibilità estesa, rollout e prove fisiche/remoti. M8 conserva staging/journal e verifiche memoria/dispositivi; M9 conserva le prove fisiche di accessibilità. Nessun master, versione o deploy.

### 85. Ricaricamento offline con cache persistente — 14/09/2026

Base 613dece6, stessa PR #63. Aggiunta modalità locale `--cold-browser`: build dedicata con Auth IndexedDB e cache Firestore persistente multischeda, mentre il laboratorio ordinario conserva la configurazione in memoria. Un service worker esclusivamente locale precarica sei risorse statiche ammesse; non intercetta Auth, Firestore, callable, POST, query string o origini esterne. Tre test del confine della cache sono inclusi nella suite shell. Non vengono introdotti cache di chiavi, wrapping della Vault Key in sessionStorage o modifiche alla PWA pubblicata.

Il browser autentica la fixture A, sblocca e carica la matrice sintetica; poi disabilita realmente le richieste tramite DevTools e ricarica il documento dalla cache. La nuova sessione recupera l'identità Firebase, ma il Vault resta bloccato e la consultazione viene rifiutata. Dopo nuova richiesta della Master Password vengono riletti e decifrati i quindici campioni già caricati, inclusi IBAN/PIN/CCV. Una risorsa HTTP mai precaricata resta irraggiungibile. Il ritorno online conserva la consultazione; logout la impedisce e svuota la vista. In sessionStorage viene conservato soltanto un marker di fase del test, senza dati o materiale crittografico.

Il primo collaudo ha individuato una particolarità DevTools: dopo reload navigator.onLine veniva ripristinato a true mentre le richieste restavano bloccate. La prova riapplica lo stesso stato di rete al nuovo contesto, senza riattivare la connessione; verifica poi il fallimento HTTP. Il controllo d'errore ripristina la rete anche quando il flag del browser è incoerente. Il runner raccoglie uno stato diagnostico limitato al laboratorio in caso di timeout.

Esito del nuovo collaudo: 22 verifiche per browser, 44 esecuzioni superate in Chrome ed Edge. È una prova di reload del documento con dati persistenti, non di terminazione del processo o riavvio fisico del dispositivo. Cache preparata esplicitamente, nessuna prova di pre-caricamento automatico completo, eviction, Safari/iPhone, UI bancaria completa, file Storage o foto/QR. Il gate iPhone del 10/09 resta aperto. Nessun master, bump, deploy o dato reale.

Validazione finale audit 85: npm test completo superato, inclusi 194 test shell e 116 offline. Nuovo collaudo persistente: 44 esecuzioni Chrome/Edge superate; regressione entry ordinaria: 56 esecuzioni superate, 100 verifiche browser complessive nei due collaudi. Nessuna certificazione di chiusura processo, riavvio dispositivo o PWA produttiva.

### 86. Riavvio del processo browser senza rete — 14/09/2026

Base ba529553, stessa PR #63. Il comando `node scripts/run-vault-session-emulators.mjs --restart-browser` esegue due processi distinti per ciascun browser. La prima fase autentica e sblocca la fixture, prepara la cache persistente e gli asset statici e comunica soltanto lo stato prepared al runner. Il runner chiude il browser tramite DevTools e attende l'evento di uscita del processo prima di riaprire lo stesso profilo temporaneo.

Il secondo processo parte da about:blank: il controllo DevTools blocca la rete prima della navigazione verso il laboratorio. La fase del test viene passata al nuovo documento dal runner; non si conserva alcuna chiave o contenuto decifrato per trasferire lo sblocco fra processi. La shell viene recuperata dalla cache, l'identità Firebase è ripristinata, il Vault rimane bloccato e la consultazione è rifiutata fino alla nuova Master Password. Vengono verificati i quindici campioni cifrati già caricati, una risorsa HTTP non in cache irraggiungibile, ritorno online e logout.

Nuova prova superata in Chrome ed Edge: 23 verifiche per browser, 46 esecuzioni complessive. Il runner rifiuta una fase di preparazione non confermata e una chiusura che non termina entro il limite. Restano i percorsi ordinari e il collaudo del solo reload; profili esclusivamente temporanei, senza interferire con i browser dell'utente.

Limiti: chiusura controllata del processo, non arresto forzato o spegnimento del dispositivo. La prova non certifica Safari/iPhone/PWA installata, eviction della cache, archivio interamente precaricato, tutte le UI o contenuto dei file Storage. Il gate bancario fisico del 10/09 resta aperto. Nessun runtime produttivo, master, bump, deploy o dato reale modificato.

Validazione finale audit 86: npm test completo superato (194 test shell e 116 offline inclusi). Chrome/Edge: 46 verifiche del riavvio processo, 44 del reload e 56 dell'entry ordinaria, 146 esecuzioni complessive superate. Nessun test su dispositivo fisico o dati reali; nessun deploy.

### 87. Arresto forzato e recupero della nota pendente — 14/09/2026

Base 1947b5c1, stessa PR #63. Aggiunto `node scripts/run-vault-session-emulators.mjs --crash-browser`. Il runner verifica PID vivo e profilo temporaneo del processo da lui creato; su Windows termina forzatamente quell'albero di processi e ne attende l'uscita. Il percorso Linux usa un gruppo dedicato, ma non è stato collaudato fisicamente in questo incremento. Non vengono cercati o chiusi i browser dell'utente.

La preparazione carica la matrice cifrata, apre l'editor della nota privata compatibile online, disattiva la rete e attende la conferma della conservazione locale della modifica. Un messaggio di controllo DevTools segnala prepared senza ripristinare la rete e senza trasferire chiavi o contenuto della nota. Il runner interrompe quindi il browser senza chiusura applicativa e riapre lo stesso profilo con rete bloccata prima della navigazione.

Il nuovo processo recupera l'identità ma mantiene il Vault bloccato. Dopo nuova Master Password legge i dati già caricati e recupera la nota dalla coda esistente: nuovo editor disabilitato, nessun reinserimento. Il retry esplicito al ritorno online applica la nota e aggiorna il dettaglio con il testo atteso; logout nega nuovamente la consultazione. Chrome ed Edge su Windows: 25 verifiche per browser, 50 esecuzioni superate.

Limiti: arresto dopo conferma dell'accodamento locale, non durante una transazione IndexedDB o un commit backend in volo; non simula perdita di alimentazione, corruzione del disco, eviction o riavvio del sistema operativo. Nessuna certificazione iPhone/Safari, PWA installata, tutte le UI, precaricamento completo o contenuto Storage. Nota privata isolata, non nuovi domini di scrittura. Nessun master, versione, deploy o dato reale modificato.

Validazione finale audit 87: npm test completo superato (194 test shell e 116 offline inclusi). Chrome/Edge Windows: 50 verifiche arresto forzato/nota pendente, 46 riavvio controllato, 56 entry ordinaria e 44 reload; 196 esecuzioni browser superate. Percorso Linux di terminazione non collaudato in questo incremento. Nessun test su dati reali o deploy.

### 88. Bootstrap privato bloccato da refresh Auth offline — 14/09/2026

Segnalazione dell'utente: PWA installata sulla Home di iPhone, versione pubblicata 1.2.124; Account visitati online, ritorno alla Home, modalità aereo, lista Account non visualizzata. La sequenza è valida e il gate fisico resta non superato. Non sono stati cancellati dati o cache e non è stata richiesta una reinstallazione.

Confronto con master 9e5335d9: main-v129.js esegueva sempre await user.reload() prima di inizializzare qualunque pagina privata. Senza rete il rifiuto interrompeva l'intero bootstrap nel catch globale, prima della lettura della lista dalla cache. Lo stesso codice era presente sul ramo sperimentale. I collaudi precedenti della shell usano un bootstrap distinto e non coprivano questo passaggio della PWA 1.2.124.

Correzione candidata da 1b341c74, stessa PR #63: il refresh Auth viene richiesto online; offline si usa l'identità Firebase già ripristinata, controllando ancora UID corrente e email verificata prima di continuare. Errori online non degradano a verifica in cache. Logout o cambio UID durante il refresh interrompono il vecchio bootstrap. Non si aggiungono flag di autenticazione, chiavi persistenti o bypass dello sblocco Vault.

Il test esegue il blocco di controllo estratto dal sorgente reale del bootstrap. Sul codice precedente falliscono la navigazione offline e i controlli delle risposte tardive (4 scenari); sulla correzione passano tutti i 7 scenari: utente verificato offline, utente non verificato, verifica aggiornata online, errore online senza fallback, logout/cambio identità durante attesa e successo online. Inclusi nella suite security. È una riproduzione del blocco compatibile con il sintomo, non una nuova certificazione iPhone o prova completa dell'interfaccia sul dispositivo.

Restano disponibilità effettiva della cache e delle dipendenze sul telefono, retest Home → modalità aereo → lista dopo pubblicazione autorizzata, gate iPhone e altri limiti M6. Nessun master, bump di versione o deploy; app pubblicata ancora 1.2.124.

Validazione finale audit 88: npm test completo superato, inclusi 88 controlli statici sicurezza, 11 test security (7 nuovi sul bootstrap), 194 test shell e 116 offline. Inventario aggiornato e controllo whitespace superato. I 196 scenari browser dell'audit 87 non sono stati rieseguiti né attribuiti a questa modifica del bootstrap produttivo; retest iPhone ancora necessario dopo rilascio autorizzato.

### Audit 89 — profilo nella preparazione offline e messaggi di lettura (15/09/2026)

Base db329bee, stessa PR #63. La preparazione già prevista delle raccolte non includeva esplicitamente il documento principale users/{uid}. Ora lo legge online insieme alle priorità della pagina; la cache resta quella Firebase e la Vault Key resta in memoria. I marker precedenti senza profileIncluded non saltano il nuovo caricamento. Documento assente o lettura fallita non attestano completezza. Il gestore condiviso comunica l'indisponibilità offline solo per codici di connettività, preservando i fallimenti di permessi/autenticazione/decifratura. Integrato nelle pagine principali di profilo, liste aziende/Account e dettagli Account; dati aziendali non falliscono più soltanto nel log.

npm test completo superato; sei nuove regressioni eseguono il preparatore reale con server/cache simulati e verificano la classificazione degli errori. Nessuna estensione alle scritture o certificazione degli allegati. Prove riferite dall'utente su iPhone 1.2.125: dati già caricati leggibili anche dopo chiusura/riapertura e nuovo sblocco; profilo prima non visitato falliva, poi leggibile dopo visita online. Nuovo candidato ancora da distribuire e collaudare fisicamente. Master e versione invariati.

### Audit 90 — Widget Account e credenziali comuni offline (15/09/2026)

Base 9f769aab, stessa PR #63. Su richiesta dell'utente la verifica riguarda Widget Account e credenziali comuni; foto e byte degli allegati sono esplicitamente esclusi dal requisito di consultazione offline, per evitare carichi eccessivi nella cache. Non chiedere il loro caricamento offline come condizione per chiudere questo requisito. L'utente intende mantenere la sessione autenticata (nessun logout), anche chiudendo e riaprendo l'app.

Riscontro: i componenti di consultazione già leggono accountWidgets e sharedVaultData tramite il repository con cache e decifrano localmente dopo sblocco. Queste due raccolte mancavano però dalla preparazione automatica. Ora sono incluse; un nuovo marker widgetsIncluded impedisce che il precedente stato completo salti il caricamento. Un fallimento di una delle due mantiene la preparazione incompleta. I riferimenti condivisi usati nelle schede Account risiedono in accountWidgets; non occorre scaricare file Storage.

Validazione: test:data-access, test:offline, test:js-syntax e controllo whitespace superati. Sette nuove regressioni: tre sulla preparazione (inclusione senza visita, fallimento di ciascuna raccolta) e quattro sulla UI reale eseguita in ambiente simulato, con letture server vietate offline, per Widget/credenziali e Account personali/aziendali. Verificati rendering, rivelazione del valore e rimozione al blocco; zero scritture. Crittografia nei test UI simulata: non attribuire una nuova prova fisica iPhone o end-to-end a questi risultati. La suite completa era passata su 9f769aab; questo incremento ha eseguito i controlli mirati indicati.

Nessun deploy, bump, modifica a master, scrittura dati o estensione delle modifiche offline. Produzione resta 1.2.125; il candidato sperimentale richiede il riallineamento già previsto prima del rilascio.

## Verifica della visibilità prima di Auth — candidata del 15/09/2026

**Base pubblicata esaminata:** 1.2.126, master a14d0198. **Stato:** correzione candidata separata; nessun deploy e nessuna modifica ai dati utente.

### Esito e requisito già previsto

Riprodotta con Chrome headless in un profilo temporaneo nuovo, senza credenziali: la struttura della Home è visibile prima della conferma Auth e poi avviene il redirect a /login-v115.html. La verifica registra soltanto visibilità e pathname. Non è una dimostrazione di accesso a dati personali: la struttura statica è pubblica su Hosting e i controlli dei dati rimangono Firebase Rules e cifratura. La segnalazione è fondata sul rendering preventivo; in questa prova la Home non rimane accessibile dopo il controllo della sessione assente.

Il Piano prevede già un bootstrap protetto unico; Architettura Sicurezza V1 §10 e Contratto Vault Key §3 richiedono pulizia del materiale sbloccato al logout/cambio identità. Mancava la regressione sul primo frame della pagina pubblicata. Le correzioni storiche nel ramo sperimentale non certificano la conformità di master: questa candidata parte dalla produzione e non importa la shell.

### Correzione

- Tutte le 22 pagine private nascono hidden e inert, con CSS che impedisce override del display; bootstrap sincrono nel head. Le nove eccezioni pubbliche (accesso/recupero, informazioni, contatto condiviso e laboratorio viewport) sono censite dal test.
- private-auth-gate.js coordina attesa, identità verificata, timeout di 15 secondi, rifiuto delle risposte tardive e blocco al cambio UID. main-v129.js conferma la visibilità soltanto dopo onAuthStateChanged e il controllo esistente dell'email, prima delle letture dati. Offline resta valida l'identità Firebase restaurata e verificata senza reload di rete.
- Errore/timeout vanno al login senza rivelare il contenuto. Un callback nullo reindirizza al percorso assoluto. pagehide nasconde la pagina e pageshow da BFCache ricontrolla tramite reload.
- logout-session.js chiude il gate, notifica la pulizia RAM e rimuove i contenitori locali della sessione Vault prima di signOut; redirect anche su errore/timeout. Il marker non segreto della scheda impedisce auto-rientro dopo logout fallito e viene rimosso soltanto da un nuovo login esplicito riuscito. Header, logout comune, Impostazioni e cambio password usano la pulizia condivisa, conservando i redirect di riautenticazione.

### Validazione e limiti

Quattordici nuove regressioni Auth/logout e sette regressioni del precedente bootstrap offline superate. Dieci scenari browser locali, cinque ciascuno in Chrome ed Edge: anonimo, identità valida, errore, timeout reale e logout. Il browser usa l'HTML/CSS e la validazione Auth reali con identità sintetica; non legge Firestore. Test live separato in sola lettura sulla Home pubblicata. npm test completo comprende il nuovo gate.

Il controllo sincrono aggiunge un modulo iniziale: tetti statici aggiornati esplicitamente da 42 a 43 moduli e da 336 a 337 KB gzip, con massimo misurato 336.8 KB; invariati limite CSS e altri criteri. Questo costo di difesa non è una riduzione di sicurezza per migliorare prestazioni.

Restano il collaudo fisico iPhone/PWA dopo eventuale rilascio, la gestione della revoca remota in assenza rete e l'audit generale Vault. Il contenitore legacy di session wrapping della base produttiva NON viene dichiarato conforme né riprogettato qui: la shell persistente è già la direzione scelta sul ramo sperimentale. Il gate DOM non sostituisce Rules, cifratura o protezione XSS. Nessuna lettura/scrittura/cancellazione di dati reali; nessuna migrazione, bump, modifica Functions/Rules o deploy.

Rollback: revert della candidata come insieme (HTML nascosto, bootstrap, CSS e cablaggio); non distribuire solo una parte, altrimenti la pagina potrebbe restare intenzionalmente bloccata.

## Riallineamento sicurezza 1.2.127 e ingresso nella shell — 15/09/2026

Ramo integration/vault-shell-v127-security, base sperimentale 04d297c9. Merge locale di master 0ba2332b registrato in 1089cde8: risolti i conflitti mantenendo il ciclo di vita/invalidazione dei componenti sperimentali e il nuovo logout fail-closed. Riferimenti asset riallineati alla versione già pubblicata 1.2.127, senza nuovo bump. Suite completa sul merge superata. Il ramo è una candidata di integrazione, non una release: nessuna modifica a master o deploy.

Verifica read-only delle Rules effettivamente distribuite tramite API Firebase Rules, senza leggere Firestore o Storage degli utenti: corrispondenza esatta con i file produttivi dopo sola normalizzazione CRLF/LF. Firestore ruleset 73bf1d91-5f5e-4779-976e-f31b27060ec2, SHA256 90cb830421c1cc94de97eb29ff68d3058cf6c9096ad05ed2b700723b4c6d63a4; Storage ruleset 205f26e1-37a7-4883-8e6d-94c39ef5f50e, SHA256 4929d9034cbda16c8a56013273c92bf84dcf99cd35b0466e555ee7aefe2715c7. Sono configurazioni, non prove di assenza di vulnerabilità. L'audit di isolamento separato è nel commit 27099764.

La shell usa già createMemoryVault e createLegacyAdapter per decifrare envelope originali in RAM. Mancava la cancellazione dei residui della sessione multipagina all'ingresso: ora createFirebaseSession elimina esclusivamente quattro chiavi legacy, senza leggerne il contenuto e prima di costruire la nuova sessione. Storage presente ma inaccessibile interrompe l'ingresso. Nessuna cancellazione di identità Firebase, ciphertext, coda IndexedDB, preferenze o marker di logout.

Aggiunto confine browser: pagehide, freeze e ripristino BFCache bloccano la Vault, interrompendo anche risultati di decifratura tardivi; private-auth-blocked dispone definitivamente la sessione e impedisce nuovo unlock sullo stesso oggetto. La normale navigazione interna non scatena pagehide. La disposizione rimuove i listener. Sette nuove prove con sessione RAM reale e verifica aggiuntiva dell'ingresso Firebase con storage fittizio. Test shell: 201 superati. I test logout verificano ora lo stato RAM/storage catturato prima di signOut fuori dal callback che può essere intercettato, evitando falsi positivi.

Stato cutover: non completato. Il laboratorio monta liste personali/aziendali, dettaglio e nota privata compatibile; la matrice offline legge altri domini ma non sostituisce tutte le relative UI. Occorre integrare le pagine canoniche ancora multipagina (profili/editor, scadenze, impostazioni e relativi flussi) nel bootstrap unico, collaudare la compatibilità e poi rimuovere dal runtime produttivo saveVaultSession/restoreVaultSession e la persistenza legacy. Non distribuire questo ramo come sostituzione completa e non dichiarare risolto VS-P0-01 in produzione. La scelta shell persistente è già autorizzata; non richiederla nuovamente. Foto e byte allegati restano esclusi dal requisito offline.

Validazione finale dell'incremento: npm test completo superato sulla nuova boundary, inclusi 201 test shell e SDK Firebase/emulatori; successiva verifica mirata dei tre test logout superata dopo spostamento delle asserzioni fuori dal callback. Chrome/Edge: 56 verifiche entry online/offline e 50 arresto forzato/riapertura con nuova Master Password, 106 complessive. Il crash riguarda esclusivamente processi temporanei creati dal runner. Nessuna prova fisica iPhone del nuovo ramo e nessuna garanzia contro eviction/corruzione del disco. Inventario rigenerato dopo la risoluzione del merge: 568 file (il conteggio intermedio durante il merge includeva le voci non risolte dell'indice).

Regressione browser Auth del ramo integrato: dieci scenari Chrome/Edge superati (anonimo, valido, errore, timeout reale e logout). Le verifiche browser complessive di questo incremento sono 116, sempre con dati sintetici.

## Consultazione profilo nella shell — 15/09/2026

Base 0fc581a0, stessa candidata integration/vault-shell-v127-security e PR #67. Aggiunta la route profilo al laboratorio Firebase: Anagrafica, Contatti, Indirizzi e Documenti in sola consultazione, selezione interna senza reload. Si tratta di una migrazione parziale, non della pagina produttiva completa: panoramica, editor, utenze, collegamenti Account, password collegate, foto, Widget e tessera digitale non vengono dichiarati integrati da questo incremento. La vista esplicita il proprio perimetro.

Il nuovo lettore usa getUserProfile del repository canonico e una proiezione fissa dei soli campi previsti; le decifrature passano dalla capability della route, senza ricevere o esporre chiavi. Aggiunta assertUnlocked al contesto protetto per verificare la Vault viva anche sui campi legacy in chiaro: scadenza, UID diverso e vista annullata impediscono la lettura. Compatibilità plaintext ammessa soltanto per i campi espliciti del profilo dopo autorizzazione; nessun fallback da decifratura fallita, nessuna scrittura o migrazione. Password/PIN/PUK, file, foto e proprietà estranee non vengono proiettati o decifrati nella nuova vista.

La UI usa textContent; cambio linguetta annulla la pubblicazione di risultati precedenti. Uscita/lock cancella il testo dai nodi dei valori anche se trattenuti da riferimenti del vecchio DOM, rimuove listener e contenitore senza toccare la vista successiva. Errori offline riusano read-error-message.js della produzione; permessi e decifratura non vengono riclassificati come cache assente.

Corrette le fixture e la matrice offline: telefono number (prima value), indirizzo address (prima street), documento num_serie (prima numero). I test precedenti dimostravano decifratura dei campioni, non corrispondenza di quei tre nomi con il profilo reale. Le nuove prove del rendering usano lo schema canonico effettivo. Nessun dato reale modificato.

Validazione: npm test completo superato sulla nuova route (214 test shell); dopo l'ultimo riuso del messaggio offline, suite shell mirata superata con 215 test, inclusa la distinzione errori. Chrome/Edge: 64 verifiche entry online/offline (quattro sezioni profilo, ritorno alla lista senza reload, pulizia testi inclusi) e 52 arresto/riapertura (profilo e contatti consultati per la prima volta dopo riavvio offline e nuovo sblocco), 116 esecuzioni. Il controllo browser entry viene ripetuto sulla versione finale del messaggio condiviso. Nessuna nuova prova fisica iPhone, eviction o cache non preparata; foto e file restano esclusi dall'offline.

Produzione invariata alla 1.2.127, nessun deploy o bump. VS-P0-01 resta aperto finché il percorso produttivo multipagina non viene sostituito: la nuova vista non autorizza la rimozione isolata del vecchio gestore di sessione. Prossime parti: parità del profilo (azioni e collegamenti) e profilo aziendale, poi i restanti percorsi canonici.

Conferma finale: entry Chrome/Edge ripetuta dopo il riuso del messaggio offline, 64 verifiche superate. Workflow di validazione esteso alle PR con base experiment/**; il deploy rimane esclusivamente workflow_dispatch. Il risultato GitHub del nuovo commit va verificato separatamente dai test locali.

## Account collegati al profilo nella shell — 15/09/2026

Base 3fff87bc, stessa PR #67. Contatti email/telefono e documenti con collegamento canonico possono aprire l'Account nella shell e tornare al profilo, mostrare/nascondere e copiare la password. Nessun reload o passaggio della chiave ai componenti. Lo stesso Account rimane consultabile da più contatti; sono ammessi Account personali e aziendali. Non vengono implementate in questo incremento creazione, modifica o dissociazione dei collegamenti.

Il lettore convalida ID e provenienza del collegamento sul profilo dell'UID corrente, esige un solo elemento sorgente e verifica il collegamento nuovamente dopo le attese. Online usa letture confermate dal server; offline usa il repository/cache canonico. Account assente, archiviato, proprietario diverso, collegamento cambiato, blocco o cambio UID impediscono la restituzione. La password viene letta solo su azione esplicita e solo dall'Account collegato; nessun fallback alla vecchia password del contatto. Cambio tab e uscita cancellano i valori e impediscono copie o navigazioni tardive. Una copia già consegnata al sistema operativo non è revocabile dalla vista.

Validazione: npm test completo superato (231 test shell); aggiunta finale di una regressione sulla proiezione dei collegamenti, suite shell mirata 232/232. Chrome/Edge: 72 verifiche entry online/offline e 54 arresto/riapertura offline con nuova Master, tutte superate, esclusivamente su fixture. Mostra/nascondi, Account condiviso tra email e telefono, Account aziendale e ritorno al profilo verificati nel browser; copia e operazioni tardive verificate con clipboard fittizia. Nessun dato reale letto o modificato.

Il primo test browser ha rilevato una preparazione incompleta della matrice: una precedente lettura del dettaglio aziendale aveva popolato la cache di un solo Account. Il probe ora carica online le tre liste mediante letture confermate prima della simulazione offline. Questa correzione del laboratorio non dimostra che l'apertura generica dell'app prepari automaticamente tutti i domini; la completezza del pre-caricamento produttivo rimane da verificare nel cutover. Cache non preparata, eviction e iPhone fisico non sono coperti da queste nuove prove; foto e byte allegati restano esclusi.

Produzione invariata alla 1.2.127, nessun bump, merge in master o deploy. Restano parità dei profili/editor, azioni sui collegamenti, utenze, Widget, tessera digitale e gli altri percorsi canonici. VS-P0-01 resta aperto sul runtime produttivo legacy: questo incremento non completa la sostituzione della sessione multipagina.
