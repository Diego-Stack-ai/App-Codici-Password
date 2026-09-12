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
