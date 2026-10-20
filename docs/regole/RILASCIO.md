# Rilascio

## Esito operativo 1.2.213 — Documenti personali compatti ed espandibili — 20/10/2026

La pagina **Regole invio scadenze** non mostra più il badge «RICONCILIATE». Nella linguetta **Documenti personali** il pannello necessario alle schede non introduce più un contenitore visivo aggiuntivo e ogni Documento è una card nativa espandibile, accessibile anche da tastiera, con freccia di stato. La card chiusa conserva nome e stato; data, configurazione, destinatari e comando di gestione restano disponibili all’espansione, senza modificare Documenti o Scadenze reali.

I test mirati sono verdi **5/5**, i18n **14/14**, documentazione **11/11** e la suite completa locale è terminata con codice **0**, inclusi sicurezza, Functions, Rules, Storage, Vault e tutti gli emulatori. La shell offline contiene **309 risorse** e Graphify principale è riallineato a **13.479 nodi, 35.340 archi e 786 comunità**. La PR `#191` è stata unita nel commit `a3521b5c`; il workflow manuale `39421438256` ha validato in 7m59s e pubblicato esclusivamente Firebase Hosting in 52s. La verifica HTTP pubblica restituisce `200` e conferma versione e asset `1.2.213`. Functions, Firestore Rules, Storage Rules, indici, migrazioni e dati reali non sono stati modificati o distribuiti.

## Esito operativo 1.2.212 — editor Automezzi tradotto e riferimenti coerenti — 20/10/2026

L’editor contestuale **Configurazione Automezzi** carica ora il catalogo Regole scadenze e non mostra più chiavi tecniche nei campi, nei comandi o nell’anteprima. La proiezione delle configurazioni storiche separa i mezzi per automobile, motociclo, rimorchio o camion quando il testo è esplicito; i testi generici restano conservativi e nessun dato viene riscritto senza un salvataggio volontario.

I test mirati sono verdi **17/17**, i18n **14/14**, documentazione **11/11** e la catena completa locale, inclusi sicurezza, Functions, Rules, Storage, Vault ed emulatori, si è conclusa con codice **0**. Graphify principale è riallineato a **13.464 nodi, 35.340 archi e 771 comunità**. La PR `#189` è stata unita in `master` nel commit `bfd6b878`; il workflow manuale `39416691715` ha ripetuto la validazione completa in 8m12s e pubblicato esclusivamente Firebase Hosting in 45s. La verifica HTTP pubblica restituisce `200` e conferma la `1.2.212` e i nuovi asset. Functions, Firestore Rules, Storage Rules, indici, migrazioni e dati reali non sono stati modificati o distribuiti.

## Esito operativo 1.2.211 — regole Automezzi contestuali — 20/10/2026

Le linguette di **Regole invio scadenze** mostrano soltanto le regole disponibili, senza duplicare riferimenti, testi e Scadenze collegate. Il conteggio di ciascuna regola apre il contenitore canonico **Scadenze** con un filtro visibile e removibile. In Automezzi ogni card apre un editor contestuale che comprende uno o più oggetti email con pianificazione, modelli e targhe distinti e compositore guidato; i token Oggetto, Modello e Targa sono protetti, mentre i segmenti linguistici restano modificabili e persistiti. La pagina offre un solo comando **Nuova regola** e blocca rinomina o eliminazione quando esistono Scadenze collegate.

Le strutture storiche restano leggibili senza riscrittura automatica e vengono convertite solo dopo un salvataggio esplicito. Il flusso Codice fiscale usa il numero di serie del Documento e riallinea la Scadenza già collegata senza crearne una seconda. I test mirati sono verdi **32/32**; `npm test` ha codice **0**, inclusi documentazione **11/11**, navigazione **170/170**, i18n **14/14**, Profilo **169/169**, sintassi su **220 moduli**, sicurezza, Functions (**473 prove, 0 errori**), Rules, Storage, Vault e tutti gli emulatori. Anche i **6** scenari browser della Guida e `git diff --check` sono verdi. Graphify principale è riallineato a **13.451 nodi, 35.332 archi e 780 comunità**.

La PR `#187` è stata unita in `master` nel commit `6ff6c4ae` dopo i gate GitHub verdi. Il workflow manuale `39396442063` ha ripetuto la validazione completa in 8m00s e pubblicato esclusivamente Firebase Hosting in 50s. La verifica HTTP pubblica restituisce `200` e conferma versione e asset `1.2.211`. Functions, Rules, indici, migrazioni e dati reali non sono stati modificati o distribuiti. Le voci **Contratto** e **Comodato d'uso** ridondante e il valore FIV da 70 a 14 giorni restano correzioni manuali dell'utente dopo la pubblicazione.

## Esito operativo 1.2.210 — riconciliazione Scadenze per ambito — 20/10/2026

Le configurazioni storiche e le Scadenze non personali sono state presentate nelle nuove linguette di **Regole invio scadenze** senza migrare o riscrivere i record: 17 regole, 7 riferimenti/mezzi e 18 testi email sono rimasti inventari indipendenti; le 24 Scadenze riconciliate hanno conservato i propri valori effettivi e i collegamenti agli editor esistenti. Le card storiche separate sono state rimosse, mentre Destinatari email è rimasta condivisa.

I test mirati sono risultati verdi **13/13** e `npm test` si è concluso con codice **0**; Graphify è stato riallineato a **13.411 nodi, 35.159 archi e 753 comunità**. La PR `#185` è stata unita in `master` nel commit `e84ac87a` dopo i gate GitHub verdi. Il workflow manuale `39343048542` ha ripetuto la validazione in 6m34s e pubblicato esclusivamente Firebase Hosting in 43s. La verifica HTTP pubblica ha restituito `200` per Home, pagina Regole e moduli interessati, confermando la `1.2.210`; il collaudo autenticato ha confermato la selezione delle linguette e il rendering dei dati reali riconciliati. Functions, Firestore Rules, Storage Rules, indici, migrazioni e dati reali non sono stati modificati o distribuiti.

## Esito operativo 1.2.209 — selettore Account/Memorandum simmetrico — 19/10/2026

Diego ha autorizzato la pubblicazione sul solo Firebase Hosting della correzione ai moduli Account privato e aziendale. I quattro modi **Account**, **Account condiviso**, **Memorandum** e **Memorandum condiviso** appartengono ora allo stesso gruppo: durante la modifica il modo corrente resta nascosto e sono sempre disponibili le altre tre conversioni, senza il lampeggio della scelta poi rimossa.

Il primo gate integrale ha bloccato correttamente un import che portava i due form oltre il budget prestazionale. La logica è stata consolidata nel modello Account già caricato; budget e prove mirate sono tornati verdi. Dopo l'allineamento della Guida alla nuova base, la ripetizione completa di `npm test` è terminata con codice **0**, inclusi tutti gli emulatori.

La PR `#183` è stata unita in `master` nel commit `dc7d0955` dopo gate GitHub verdi. Il workflow manuale `39259111507` ha ripetuto la suite in 6m38s e pubblicato esclusivamente Firebase Hosting in 41s. La verifica HTTP pubblica restituisce `200` per Home, i moduli Account privato e aziendale e il modello condiviso, confermando la `1.2.209`. Functions, Firestore Rules, Storage Rules, indici, migrazioni e dati reali non sono stati modificati o distribuiti.

## Esito operativo 1.2.208 — card aziendali per tipologia — 19/10/2026

Diego ha autorizzato la pubblicazione del lotto frontend che separa, su ogni card Azienda, **Dati azienda**, **Account**, **Condivisi**, **Memorandum** e **Memo condivisi**. I quattro contatori derivano dai record non archiviati già esistenti; le azioni aprono la Lista Account con il filtro corrispondente e il comando Aggiungi eredita la categoria selezionata. Nessuna collezione, Rule o Function cambia.

La candidata `1.2.208` ha superato integralmente `npm test` dopo la rigenerazione della shell offline con 307 risorse. La PR `#181` è stata unita in `master` nel commit `eeb67bf7` dopo gate GitHub verdi. Il workflow manuale `39243406078` ha ripetuto la suite e pubblicato esclusivamente Firebase Hosting; la verifica HTTP `200` conferma versione e nuovi moduli. Functions, Firestore Rules, Storage Rules, indici, migrazioni e dati reali non sono stati modificati o distribuiti.

## Esito operativo 1.2.207 — 19/10/2026

PR `#179` unita in `master` nel commit `1d91eee1` dopo gate documentali e validazione GitHub completa verdi. Il workflow manuale `39221884870` ha ripetuto la suite e pubblicato esclusivamente Firebase Hosting. La verifica remota HTTP `200` conferma versione `1.2.207`, cache-bust Push `20261019c`, precontrollo della registrazione e recupero del dispositivo già non attivo. Functions, Firestore Rules, Storage Rules, indici, migrazioni e dati reali non sono stati modificati o distribuiti. La ricezione della notifica di sistema resta da confermare sull'iPhone.

## Esito operativo 1.2.206 — 19/10/2026

PR `#177` unita in `master` nel commit `7ce91633` dopo due controlli documentali e validazione GitHub completa verde. Il workflow `39212436454` ha ripetuto i gate e pubblicato esclusivamente Firebase Hosting. La verifica remota HTTP `200` conferma versione `1.2.206`, rotazione della sottoscrizione Push iPhone, selezione delle tre taglie AI.2 compatibili e CSP mirata per WebAssembly senza abilitare `'unsafe-eval'` JavaScript. Functions, Firestore Rules, Storage Rules, indici, migrazioni e dati reali non sono stati modificati o distribuiti. La ricezione effettiva della Push richiede un nuovo collaudo sull'iPhone.

## Esito operativo 1.2.200 — 17/10/2026

PR `#165` unita in `master` nel commit `572ad57b` dopo due controlli documentali e validazione GitHub completa verdi. Pubblicati **343 file** sul solo Firebase Hosting. La verifica remota ha restituito HTTP `200` e confermato versione `1.2.200`, data del Documento vincolante nell'editor Scadenza, campi Preavviso/Frequenza, ritorno protetto dalla rubrica Destinatari e catalogo guida aggiornato. Functions, Firestore Rules, Storage Rules, indici, migrazioni e dati reali non sono stati modificati o distribuiti.

## Esito operativo 1.2.199 — 17/10/2026

PR `#163` unita in `master` nel commit `5917cc93` dopo controlli documentali e validazione GitHub completa verdi. Pubblicati Firebase Hosting e Functions: **342 file** Hosting e Functions Node.js 22 in `europe-west1`, incluse le funzioni di scheduler, Email/Push e lifecycle delle Scadenze. La verifica remota ha restituito HTTP `200` per Home, Profilo e Regole scadenze, confermando versione `1.2.199` e moduli `profile-document-deadline-v1` online. Firestore Rules, Storage Rules, indici, migrazioni e dati reali sono rimasti invariati. Il collaudo reale Email/Push e la cancellazione manuale delle tre vecchie Scadenze personali restano attività dell'utente; gli allegati sono consultabili nell'app ma non vengono inviati come file nell'email.

## Esito operativo 1.2.175 — 12/10/2026

PR #130 unita in `master` (`83f70213`) dopo gate GitHub verdi. Pubblicato sul solo Hosting il componente **Seleziona sorgente** condiviso da Documenti del Profilo e Account privati/aziendali, mantenendo lo scanner guidato ID-1. Workflow di produzione `38285339424` verde; verifica remota HTTP 200 con versione `1.2.175` e nuovi asset presenti. Functions, Firestore Rules, Storage Rules e dati reali non sono stati modificati.

## Esito operativo 1.2.174 — 12/10/2026

Il rilascio unifica le sorgenti allegato dei Documenti del Profilo con quelle degli Account e collega alle nuove Scadenze gli allegati cifrati già presenti su Account o Documento, senza duplicazione Storage. Introduce inoltre il tipo Data e il flag Scadenza nei Widget Account. PR #128 unita in `master` (`7705aa04`); gate GitHub verdi, deploy Hosting e della sola callable `uploadProfileDocumentAttachment` riusciti. Verifica remota HTTP 200 con versione `1.2.174`. Firestore Rules, Storage Rules, indici, migrazioni e dati reali sono rimasti invariati.

## Esito operativo 1.2.170 — 12/10/2026

PR #122 unita in `master` (`219f9dc7`) con gate GitHub verdi. Pubblicato sul solo Hosting lo scanner Tessera/Carta negli allegati dei Documenti del Profilo, riusando guida ID-1, conferma regolabile e upload cifrato esistenti. Verifica remota HTTP 200 su home, Profilo, modulo e stile camera. Functions, Firestore Rules, Storage Rules e dati reali sono rimasti invariati.

## Esito operativo 1.2.169 — 12/10/2026

PR #120 unita in `master` (`ad06df59`) con gate GitHub verdi. Pubblicata sul solo Hosting la conferma Tessera/Carta dedicata con trascinamento, pinch/cursore, zoom limitato e upload diretto senza editor generale. Verifica remota HTTP 200 su home, dettagli e modulo camera. Functions, Firestore Rules, Storage Rules e dati reali sono rimasti invariati.

## Esito operativo 1.2.168 — 12/10/2026

PR #118 unita in `master` (`00297d21`) con gate GitHub verdi. Pubblicata sul solo Hosting l'acquisizione guidata Tessera/Carta per i dettagli Account privati e aziendali, con guida ID-1, ritaglio dell'area inquadrata e apertura diretta dell'editor Carta. Verifica remota HTTP 200 su home, dettagli e modulo camera. Functions, Firestore Rules, Storage Rules e dati reali sono rimasti invariati.

## Esito operativo 1.2.167 — 12/10/2026

PR #116 unita in `master` (`ba9cb84a`) con gate GitHub verdi. Pubblicato sul solo Hosting il filtro Galleria immagini+video nei dettagli Account privati e aziendali; verifica remota HTTP 200 con versione e attributi `accept` attesi. Functions, Firestore Rules, Storage Rules e dati reali sono rimasti invariati.

## Esito operativo 1.2.166 — 12/10/2026

PR #114 unita in `master` (`db5e4e1d`) con gate GitHub verdi. Pubblicate l'opzione **Allega originale**, la dicitura **Salva ritaglio** e la soglia coerente di 32 MiB. Deploy coordinato riuscito per Hosting, Storage Rules e `manageBackupRestoreV2`; controllo remoto HTTP 200 e callable attiva. Firestore Rules, migrazioni e dati reali sono rimasti esclusi.

## Esito operativo 1.2.164 — 12/10/2026

PR #111 unita in `master` (`d929601a`) con gate GitHub verdi. Il comando **Abbandona** è visibile sulla card ricevuta ed è collegato al flusso di uscita già autorizzato e confermato. Deploy del solo Hosting riuscito; controllo remoto HTTP 200, versione `1.2.164`, modulo e stile aggiornati. Nessuna modifica a Functions, Rules o dati.

## Esito operativo 1.2.163 — 12/10/2026

PR #109 unita in `master` (`4aef788b`) con gate GitHub verdi. Pubblicate quattro correzioni Account: conteggio confermato dopo rinomina, uscita del destinatario da un Account condiviso, azzeramento effettivo delle statistiche e conversione reversibile fra Account/memorandum privati o condivisi con revoca esplicita dei destinatari precedenti. Gate locali: sintassi **183 moduli**, navigazione **156/156**, condivisione **43/43**, Functions/security **454 pass, 9 skip, 0 fail**. Deploy riuscito per Hosting e `respondToInvitation`; controllo remoto HTTP 200 e versione `1.2.163`. Nessuna modifica a Rules o dati.

## Esito operativo 1.2.154 — 10/10/2026

PR #97 unita in `master` (`eb1380c0`). Pipeline completa verde sulla PR e nuovamente su `master`. Deploy riuscito sul progetto originale per Hosting, Firestore Rules, Storage Rules e le quattro callable necessarie ai profili Widget e agli allegati dei documenti personali. Verifica HTTP post-rilascio positiva con asset `1.2.154`.

Il rilascio non abilita i motori ancora safe-off: purge M7 generale, restore M8 riprendibile, recupero MFA automatico e writer CPFE2. Le prove fisiche, l'audit indipendente e la verifica privacy/legale restano gate esterni e non sono dichiarati superati.

## Esito operativo 1.2.150 — 09/10/2026

PR #90 unita in `master` (`326b83a3`) e Firebase Hosting pubblicato con successo. Il gate funzionale aggiuntivo ha eseguito due salvataggi consecutivi sullo stesso Account sintetico e due riletture server-confirmed riuscite. Il rilascio riguarda il caricamento versionato del modulo lazy e la stabilità dei valori catturati; Functions, Rules e migrazioni dati restano invariati.

## Esito operativo 1.2.144 — 09/10/2026

Il ciclo di rilascio corrente è chiuso: deploy completo riuscito sul progetto originale e verifica HTTP post-rilascio positiva. I gate esterni non eseguiti restano requisiti per una futura dichiarazione di maturità/certificazione, ma non mantengono aperto questo incarico. Le funzionalità non dimostrate rimangono disabilitate.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

<a id="checklist-operativa-prima-dellintegrazione--24092026"></a>

## Checklist operativa prima dell'integrazione — 24/09/2026

Promemoria datato, subordinato ai contratti e alle decisioni: non autorizza merge, deploy, variazioni di versione né chiude i gate conservati sotto.

1. **Preservare il PDF di master:** scheda, moduli, asset, build e test del rilascio 1.2.128 (`9d0f7065`, merge `4efda528`). È una divergenza master-only, non una cancellazione compiuta dai commit del ramo. Unire gli script di build e test dei due lati senza perdere le suite del ramo.
2. **Ricalcolare i conflitti:** i 22 file della simulazione HEAD–origin/master sono una fotografia della base `2900ccc0` rispetto a `4efda528`. Il riordino non committato è escluso da quella simulazione: dopo la sua integrazione occorre ripetere il confronto, senza presumere che le cancellazioni documentali non generino conflitti.
3. **Verificare rollout e rollback:** per ogni callable coinvolta serve una matrice client nuovo/vecchio × backend nuovo/vecchio, inclusi Rules, indici, errori mostrati e recupero. Le nuove richieste di `expectedOwnerUid` respingono i client precedenti che non inviano il campo; Functions-first non è una strategia sicura per questi percorsi. La matrice non è ancora approvata.
4. **Nessun ordine generale garantito:** una sequenza unica Rules → client → trigger non dimostra compatibilità. Verificare ogni percorso e il rollback; conservare i controlli di proprietà e non introdurre fallback permissivi.
5. **Distinguere i componenti:** Hosting, Functions, Rules e indici sono rilasci distinti, con dipendenze da verificare. Il workflow locale esaminato avvia il deploy Hosting solo con `workflow_dispatch`; non verifica automazioni esterne o stato di produzione.
6. **Provare la candidata integrata:** build, asset/versioni, PDF e suite pertinenti dopo la risoluzione dei conflitti. Test locali precedenti, 435 commit censiti e revisione mirata dei diff non certificano l'app integrata né tutti i 128 file frontend. I gate fisici e produttivi restano separati.

## Indice delle fonti conservate

- [M10_HARDENING_RILASCIO.md](#fonte-docs-m10-hardening-rilascio-md-l1)

<a id="fonte-docs-m10-hardening-rilascio-md-l1"></a>

## Fonte: M10_HARDENING_RILASCIO.md — righe originali 1–98

> Provenienza: `docs/M10_HARDENING_RILASCIO.md` a `2900ccc0`.

<a id="fonte-docs-m10-hardening-rilascio-md-m10--hardening-e-rilascio-maturo"></a>

## M10 — Hardening e rilascio maturo

> **Stato:** gate automatico superato per le versioni indicate; verifica reale e certificazione ancora aperte\
> **Autorità:** contratto di rilascio ed evidenza, subordinato ad [Architettura Sicurezza V1](SICUREZZA.md#fonte-docs-architettura-sicurezza-v1-md-l1)\
> **Ultima revisione documentale:** 11 settembre 2026

<a id="fonte-docs-m10-hardening-rilascio-md-stato-verificabile"></a>

### Stato verificabile

> “Verificabile” indica l’esecuzione dei controlli documentati nel repository. Non dimostra da solo il deploy effettivo, l’enforcement della Firebase Console, i dati reali, la resistenza crittografica o tutti i dispositivi.

Il gate automatico controlla header di sicurezza Hosting, assenza della sorgente generale `'unsafe-eval'`, presenza della sola sorgente mirata `'wasm-unsafe-eval'` richiesta dal motore AI locale, protezione anti-framing, vincoli UID nelle Rules, App Check obbligatorio su tutte le callable e lockfile moderno. La suite completa comprende inoltre sintassi, dipendenze circolari, CSP/riferimenti statici, sicurezza dei dati, emulatori Firestore e Storage e tutti i laboratori M5–M9.

L'audit del 08/09/2026 rileva zero vulnerabilità note nelle dipendenze di produzione. Le pagine non contengono script inline e la CSP non concede più `unsafe-inline` a `script-src`; sono inoltre vincolati `base-uri`, `object-src` e `form-action`. La sorgente `'wasm-unsafe-eval'` autorizza soltanto la compilazione WebAssembly degli artefatti AI fissati e same-origin e non autorizza `eval()` JavaScript. `unsafe-inline` resta per i soli stili perché alcuni componenti runtime impostano ancora proprietà visive dinamiche: è un debito esplicito da eliminare componente per componente, senza una rimozione globale non collaudata.

<a id="fonte-docs-m10-hardening-rilascio-md-gate-che-richiedono-ambiente-reale"></a>

### Gate che richiedono ambiente reale

Aggiornamento documentale 15/09/2026, riferimento candidato `054b045d`: [riepilogo delle chiusure verificate](../storico/REGISTRO.md#fonte-docs-piano-maturita-professionale-md-chiusura-documentale-dellincremento-054b045d--15092026). CI GitHub 34947029981 superata e controlli locali conclusi; non chiudono M10 né autorizzano il rilascio della shell. Il confronto delle Rules distribuite è documentato nell'audit Vault; non attesta App Check Enforcement o gli altri gate sotto elencati. Produzione 1.2.127 invariata.

- verificare App Check Enforcement, Firestore Rules e Storage Rules dalla console del progetto pubblicato;
- eseguire la matrice su iPhone, Windows e browser supportati, inclusi rete lenta, offline, riapertura e overscroll;
- provare backup, cancellazione e ripristino esclusivamente su una copia non produttiva;
- sottoporre crittografia e condivisione a un audit indipendente prima di dichiararle mature;
- ottenere approvazione esplicita prima di modificare Rules, Functions o dati di produzione.

Finché questi punti non sono firmati, la build è una candidata tecnica e non una release professionale definitiva.

<a id="fonte-docs-m10-hardening-rilascio-md-collaudo-esplorativo-v1264"></a>

### Collaudo esplorativo v1.2.64

L'8 settembre 2026 il product owner ha navigato nell'app pubblicata e nelle sue pagine senza rilevare malfunzionamenti. Questo costituisce un esito positivo di smoke test generale e conferma l'assenza di regressioni evidenti dopo il rilascio M0–M10. Non sostituisce la matrice M10: dispositivo, sistema, browser, tema, rete offline, riapertura, tastiera e modali non sono stati registrati come singoli casi verificati.

<a id="fonte-docs-m10-hardening-rilascio-md-gate-automatico-v1290"></a>

### Gate automatico v1.2.90

Il 10 settembre 2026 la suite M0–M10 è stata rieseguita integralmente con esito positivo. Sono risultati verdi shell offline, 88 controlli di sicurezza, contratto Vault, repository dati, navigazione, 29 pagine canoniche, fondazioni UI, purezza HTML, riferimenti statici, budget prestazionali, sintassi, CSS, dipendenze, crittografia, allegati, condivisione, coda offline, cronologia, backup, Salute credenziali, hardening di rilascio, Functions e Rules Firestore/Storage tramite emulatori.

Questo chiude il gate automatico della candidata v1.2.90. Restano separati e non mascherati: matrice fisica Windows, audit indipendente e consultazione offline reale già registrata in `M6_SINCRONIZZAZIONE_OFFLINE.md`.

La successiva evoluzione dell'Agente Codex è stata sottoposta ad audit prima dell'implementazione. Architettura, confini D0–D4 e nuovo ordine operativo post M0–M10 sono registrati in `AGENTE_CODEX_EVOLUZIONE.md`; modelli locali e servizi remoti non sono stati abilitati.

Prima di implementare tale evoluzione è stato aggiunto il blocco di coerenza Profilo/Account/Widget/Cache, descritto in `PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md`. Il lavoro parte dall'audit dei dati e assegna priorità alla proprietà read-your-writes; nessuna migrazione o modifica strutturale dei dati legacy è autorizzata dalla sola registrazione della roadmap.

<a id="fonte-docs-m10-hardening-rilascio-md-checklist-operativa-di-rilascio"></a>

### Checklist operativa di rilascio

1. working tree pulita, versione unica e suite completa verde;
2. inventario e budget prestazionali aggiornati;
3. backup cifrato della copia di collaudo e prova di ripristino riuscita;
4. deploy Preview e matrice fisica firmata;
5. controllo manuale di CSP, App Check, Rules, indici e log privi di dati sensibili;
6. piano di rollback identificato prima del deploy produzione;
7. monitoraggio errori tecnici senza contenuti del Vault;
8. chiusura o rollback immediato se autenticazione, cifratura, sync o recupero regrediscono.

<a id="fonte-docs-m10-hardening-rilascio-md-gate-aggiuntivo-authvault--12092026"></a>

### Gate aggiuntivo Auth/Vault — 12/09/2026

`npm run test:vault-emulators` verifica il collegamento SDK Authentication/Firestore e lettore v2 su progetto demo locale, con una copia identica delle Rules correnti. Undici test superati. Integrato nella suite completa; non modifica il canale pubblicato né dimostra enforcement remoto, MFA/PRF, App Check o recupero completo. [Audit §20](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-20-sdk-firebase-e-sessione-protetta-in-emulatore--12092026).


<a id="fonte-docs-m10-hardening-rilascio-md-compatibilità-dei-controlli-proprietario--candidata-13092026"></a>

### Compatibilità dei controlli proprietario — candidata 13/09/2026

La protezione delle chiamate differite deve essere verificata su entrambi i lati: il token Firebase può essere acquisito dopo l'invocazione del client. Il confronto locale prima di chiamare `httpsCallable` non sostituisce la validazione del proprietario previsto nel backend. Il blocco backup è verificato al commit `273de41b`; l'estensione M6/widget è un blocco successivo, non inclusa nei 700 test di quel commit: i due ingressi M6 confrontano `data.uid`, mentre widget e Credenziali comuni richiedono `expectedOwnerUid`. I client M6 canonici già conservavano lo UID nella coda; il laboratorio è stato riallineato. I vecchi client widget/shared senza il nuovo campo vengono respinti.

| Combinazione backup | Esito atteso |
|---|---|
| Client nuovo + backend nuovo | `expectedOwnerUid` obbligatorio, confronto prima di Firestore |
| Client nuovo + backend vecchio | Campo ignorato dal backend: protezione completa non dimostrata |
| Client vecchio + backend nuovo | Campo mancante: ripristino respinto, Vault non modificato |
| Client vecchio + backend vecchio | Comportamento precedente, inclusa la race identificata |

Il rilascio deve prevedere aggiornamento delle copie PWA e un messaggio comprensibile durante eventuale incompatibilità temporanea. Non inserire un fallback che accetti il comando senza proprietario. Prima del deploy: provare entrambe le identità, chiamate in attesa, missing/mismatch e nessuna lettura/scrittura dopo rifiuto; collaudare anche il client già installato prima dell'aggiornamento.

Il rollback backend deve conservare sia il confronto proprietario sia il registro attendibile M6; una vecchia build integrale non soddisfa questo requisito. Un'eventuale disabilitazione temporanea del ripristino è diversa da una perdita di dati e va dichiarata. Nessun deploy o rollback eseguito da questa registrazione; resta necessaria approvazione esplicita per il backend di produzione.


Il candidato backup del 13/09 aggiunge ricevute vincolate al comando nel registro `mutationResults`, non scrivibile dai client. La matrice di collaudo e il rollback devono preservare anche questa verifica, oltre al proprietario: testare retry identico, riuso dell'ID con contenuti diversi, ricevuta storica e ricevuta malformata. Non migrare automaticamente gli esiti pregressi. Il gate di distribuzione backend resta aperto.


Compatibilità CAS backup candidata: il client richiede una risposta preview versione 1 completa e coerente; il backend richiede la versione attesa per ciascun record applicato. Provare anche vecchio client/nuovo backend e nuovo client/vecchio backend: devono interrompere il ripristino, senza fallback alla scrittura senza precondizioni. Il rollback conserva proprietario, ricevute attendibili e confronto con anteprima. Staging e Storage non diventano atomici per effetto di questo controllo.

Il candidato purge richiede anch’esso `expectedOwnerUid` prima di ogni accesso. Includere nelle prove di distribuzione e rollback i client Archivio precedenti, il cambio Auth durante conferma/token e lo svuotamento interrotto. Nessun fallback senza proprietario e nessun deploy eseguito.

Il rollback del purge candidato deve conservare anche il registro protetto e la verifica completa delle ricevute. Provare legacy processing/purged, binding diverso, ricevuta finale assente/alterata e interruzione dopo recursiveDelete. Non ripristinare un writer che considera attendibili gli esiti creati dal client.

Gestione Scadenze ricevute candidata: anche manageReceivedDeadline richiede expectedOwnerUid del destinatario autenticato prima di Firestore. I client precedenti privi del campo vengono rifiutati. Distribuzione e rollback devono conservare il vincolo e i controlli su destinatario, permesso manage e revoca. La correzione UI associata cattura il contesto prima della conferma; nessun fallback permissivo o deploy eseguito. Suite Functions: 110 test superati.

<a id="fonte-docs-m10-hardening-rilascio-md-candidata-integrata--13-settembre-2026"></a>

### Candidata integrata — 13 settembre 2026

Codice `4a431ec3`, versione 1.2.118: suite completa 887 test superati dopo integrazione UI Account/Vault e riconciliazione master 1.2.117. Versione, budget, Rules e Functions verificati localmente; nessuna pubblicazione o migrazione. Il risultato non sostituisce i gate reali elencati sopra. [Audit §51](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-51-integrazione-account-ui-e-vault--candidata-13092026).

<a id="fonte-docs-m10-hardening-rilascio-md-distribuzione-widget-bancari--candidata-12119-13092026"></a>

### Distribuzione Widget bancari — candidata 1.2.119, 13/09/2026

Base a6699e8d: suite completa locale 352 test superati; budget invariati. La modifica backend riguarda solo manageAccountWidget e il validatore dedicato. Ordine previsto: pubblicare questa Function, poi Hosting; gli altri callable e Rules restano invariati. Vecchio client Widget che omette bankId conserva l'associazione via backend nuovo. Il frontend nuovo con backend vecchio non è una combinazione valida: il vecchio validatore scarterebbe bankId.

Aggiornare la PWA prima di modificare i conti: i vecchi form aziendali possono omettere gli identificativi bancari aggiunti. Un Widget con target mancante resta recuperabile dalla sezione generica, può essere spostato o eliminato; non viene cancellato automaticamente. Il blocco UI dell'eliminazione del conto non è un vincolo globale contro vecchi writer concorrenti. Nessuna migrazione o lettura di dati reali eseguita. Per rollback del frontend conservare il backend compatibile: ripristinare un validatore precedente può perdere l'associazione al successivo salvataggio. L'autorizzazione precedente era limitata a Hosting 1.2.118; la distribuzione di questa Function richiede approvazione esplicita.

<a id="fonte-docs-m10-hardening-rilascio-md-stato-successivo-ai-rilasci-ui--13092026"></a>

### Stato successivo ai rilasci UI — 13/09/2026

Il paragrafo precedente descrive la preparazione storica della 1.2.119. Successivamente autorizzati e pubblicati: Hosting 1.2.118–1.2.121 e la sola Function `manageAccountWidget` per i collegamenti bancari. Master è `6fc3546e`, versione 1.2.121. Le modifiche strutturali Vault, le nuove ricevute e i prerequisiti backend del ramo sperimentale non sono stati distribuiti.

Il merge `e2edd2b9` riconcilia questi rilasci nel solo ramo `experiment/vault-shell-v121`. Il push sperimentale non autorizza merge master o deploy: restano necessari distribuzione coordinata dei prerequisiti, compatibilità/rollback e i gate aperti del programma. Il coordinatore ibrido M6 è soltanto di laboratorio, senza upgrade IndexedDB né import nell'app.
