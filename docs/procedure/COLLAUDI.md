# Collaudi

## Banco Google Cloud reale per M7/M8

Questo banco serve a colmare il limite noto dell'emulatore Storage, che non certifica `ifGenerationMatch`. Prerequisiti: Google Cloud CLI (`gcloud`) installata; autenticazione con identità a privilegi minimi sul solo progetto `appcodici-password`; bucket e regione verificati; prefisso sintetico univoco registrato nel verbale; nessun oggetto o documento appartenente a utenti reali.

Sequenza minima obbligatoria: creare un oggetto sintetico; acquisirne la `generation`; sostituirlo; verificare che la cancellazione condizionata alla generazione precedente fallisca senza rimuovere la replacement; cancellare la generazione corrente; ripetere il comando per verificare idempotenza/esito mancante; provare staging e cleanup M8 con generazione fissata; inventariare e rimuovere soltanto le risorse sintetiche create. Conservare comandi redatti, timestamp, identità non segreta, bucket/prefisso, generazioni e risultati. Un esito verde autorizza esclusivamente il successivo canary allowlisted; non abilita automaticamente il rollout generale.

Stato 10/10/2026: installato Google Cloud SDK 588.0.0, autenticati account utente e ADC sul progetto `appcodici-password`. Il banco reale sul bucket `appcodici-password.firebasestorage.app` ha creato due generazioni dello stesso oggetto sotto `codex-synthetic-gcs-gate/2026-10-10/`, ha respinto la cancellazione della generazione obsoleta con 404 generation-pinned, ha riletto e preservato la replacement, ha cancellato la generazione corrente e ha verificato 404 finale. Il successivo `gcloud storage ls` non trova oggetti nel prefisso sintetico. Nessun percorso o dato utente è stato letto o modificato.

Il primo run reale ha individuato che `File#delete` dell'SDK installato ignora l'opzione write-style `preconditionOpts` passata a `delete()`. Corretto il runner e l'helper candidato M8 `deleteStageGeneration` usando un file generation-pinned e i campi diretti `generation`/`ifGenerationMatch`. Verifiche locali combinate 23/23; runner GCS 2/2. Il run reale successivo è verde con cleanup verificato. Questo supera il gate puntuale delle precondizioni GCS, ma non certifica ancora il flusso distribuito completo M7/M8 né autorizza da solo il cutover generale.

Regressione M8 successiva alla correzione dell'helper: suite Functions backup **67/67** e laboratorio ripresa/staging/bridge **34 pass, 3 skip esterni dichiarati, 0 fail**. Il primo avvio confinato aveva prodotto esclusivamente errori `EACCES` sull'apertura di server loopback; la ripetizione fuori dal sandbox ha isolato un mock storico ancora basato su `preconditionOpts`, aggiornato al contratto reale `generation`/`ifGenerationMatch`, e ha chiuso la suite. Tutti i dati erano fixture sintetiche; nessun endpoint produttivo è stato esportato o attivato.

Primo incremento del blocco globale M7: introdotto il contratto CAS backend `archivePurgeLocks/{uid}` con binding opaco a proprietario, operazione e percorso Account; acquisizione e rilascio sono idempotenti soltanto per lo stesso binding, record attivi o malformati bloccano i writer. La prima copertura Firestore Rules rende il namespace backend-only e applica il fence ai writer client del proprietario, inclusi radice, discendenti, Aziende e inviti. Prove pure **5/5**, piano riferimenti **11/11**, Rules Emulator complessivo **78/78** (tre casi specifici: lock attivo blocca, release valida riapre, lock malformato fallisce chiuso). Il purge resta hard-off: prima dell'acquisizione reale devono essere raccordati anche tutti i writer Admin/Functions, che bypassano le Rules.

Secondo incremento M7: il bundle deployabile dei tredici writer Account/Profilo usa ora un proxy transazionale con contesto proprietario isolato; ogni transazione legge `archivePurgeLocks/{uid}` prima di ricevute o dati dominio. Un lock attivo produce `PURGE_LOCK_ACTIVE` depurato e il test dimostra che nessuna lettura Account precede il fence. Contratto/adattatore e confine callable **12/12**, bundle rigenerato e controllo build verde. Restano da raccordare gli altri writer Admin esterni al bundle prima di acquisire realmente il lock nel purge.

Chiusura locale del protocollo M7: gli entry point Admin inventariati sono recintati, inclusa la cancellazione contatto, e il purge acquisisce/rilascia `archivePurgeLocks/{uid}` nelle transazioni di preparazione/finalizzazione. Le prove che alterano direttamente lo stato durante la cancellazione sono avversariali e non rappresentano un writer applicativo non recintato. Evidenze complessive: Functions/security **428 pass, 9 skip dichiarati, 0 fail**; Rules Emulator **78/78**. Il risultato non abilita il motore: canary, attivazione e deploy restano gate separati.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

Le istruzioni sono riutilizzabili, gli esiti sono in evidenze/COLLAUDI. Una checklist non compilata non è una prova riuscita. Nessuna raccolta di segreti in screenshot, report o chat. Il collaudo M4 storico non riapre automaticamente M4; nuove regressioni si riferiscono al gate fisico pertinente (M10). M6 resta da eseguire nei limiti della checklist.

## Indice delle fonti conservate

- [M4_VISUAL_ACCEPTANCE.md](#fonte-docs-m4-visual-acceptance-md-l1)
- [M5_COLLAUDO_DUE_DISPOSITIVI.md](#fonte-docs-m5-collaudo-due-dispositivi-md-l1)
- [M6_CHECKLIST_IPHONE.md](#fonte-docs-m6-checklist-iphone-md-l1)

<a id="fonte-docs-m4-visual-acceptance-md-l1"></a>

## Fonte: M4_VISUAL_ACCEPTANCE.md — righe originali 1–38

> Provenienza: `docs/M4_VISUAL_ACCEPTANCE.md` a `2900ccc0`.

<a id="fonte-docs-m4-visual-acceptance-md-collaudo-visivo-m4--header-footer-e-overscroll"></a>

## Collaudo visivo M4 — header, footer e overscroll

Questo documento conserva il collaudo che ha completato M4 sulla versione pubblicata. I test automatici verificano struttura e regressioni CSS, mentre la composizione grafica è stata confermata sui dispositivi usati durante il lavoro.

Il contratto delle due famiglie e del viewport è definito in `PAGE_SHELL_CONTRACT.md`; il relativo gate statico è `npm run test:page-shells`.

<a id="fonte-docs-m4-visual-acceptance-md-iphone"></a>

### iPhone

Eseguire in tema chiaro e scuro sulle pagine Home, Area privata, Account privati, Aziende, Scadenze, Archivio e Impostazioni:

1. aprire la pagina dall’icona installata in Home;
2. scorrere lentamente dall’inizio alla fine;
3. ripetere con movimenti rapidi e inversioni di direzione;
4. raggiungere il limite superiore e inferiore tentando un breve overscroll;
5. aprire e chiudere una tastiera o un pannello modale e ripetere lo scroll.

Esito richiesto:

- [ ] header stabile, senza lampi o cambi di luminosità;
- [ ] footer stabile, senza lampi o cambi di luminosità;
- [ ] nessuna fascia bianca oltre il contenuto;
- [ ] nessuna linea netta fra fondale della pagina e area esterna;
- [ ] pulsanti sempre selezionabili e non spostati dalle safe area;
- [ ] contenuto mai nascosto permanentemente sotto header o footer.

<a id="fonte-docs-m4-visual-acceptance-md-windows"></a>

### Windows

Ripetere sulle stesse pagine con finestra massimizzata e ridotta a circa 390 px di larghezza:

- [ ] nessun flash durante scroll con mouse e touchpad;
- [ ] nessun salto di layout quando compare la barra di scorrimento;
- [ ] header e footer restano allineati al contenitore massimo;
- [ ] tema chiaro e scuro mantengono contrasto leggibile.

<a id="fonte-docs-m4-visual-acceptance-md-registrazione-esito"></a>

### Registrazione esito

Annotare dispositivo, versione del sistema operativo, browser/PWA, tema e pagina dell’eventuale difetto. Una sola voce negativa mantiene M4 aperta e richiede correzione prima di M5.


<a id="fonte-docs-m5-collaudo-due-dispositivi-md-l1"></a>

## Fonte: M5_COLLAUDO_DUE_DISPOSITIVI.md — righe originali 1–16

> Provenienza: `docs/M5_COLLAUDO_DUE_DISPOSITIVI.md` a `2900ccc0`.

<a id="fonte-docs-m5-collaudo-due-dispositivi-md-m5--collaudo-identità-su-due-dispositivi"></a>

## M5 — Collaudo identità su due dispositivi

Il test automatico `sharing-two-device.test.mjs` simula il trasferimento serializzato dal dispositivo A al dispositivo B e dimostra che la chiave privata resta cifrata, l'identità può essere riaperta con la stessa Vault Key e il destinatario può decifrare la chiave per-record. Un dispositivo con materiale Vault errato viene respinto.

<a id="fonte-docs-m5-collaudo-due-dispositivi-md-prova-fisica-non-produttiva"></a>

### Prova fisica non produttiva

1. usare due account e due dispositivi dedicati al collaudo, senza dati reali;
2. creare sul dispositivo A l'identità del destinatario e verificare che Firebase riceva soltanto la chiave pubblica;
3. accedere allo stesso account sul dispositivo B e riaprire la busta privata con la Vault Key corretta;
4. condividere un record fixture dal proprietario e verificarne la decifratura sul dispositivo B;
5. provare Vault Key errata, UID differente, busta alterata e chiave pubblica sostituita: tutti devono essere bloccati;
6. revocare il destinatario, ruotare la chiave per-record e verificare che il nuovo contenuto non sia leggibile dalla vecchia sessione offline;
7. cambiare Master Password senza cambiare la Vault Key e ripetere la riapertura;
8. registrare soltanto esito, versione schema e codice errore, mai chiavi o contenuti.

Il test fisico non autorizza il cutover. L'attivazione resta separata e richiede backup M8 realmente ripristinato e approvazione delle Rules di produzione.

<a id="fonte-docs-m6-checklist-iphone-md-l1"></a>

## Fonte: M6_CHECKLIST_IPHONE.md — righe originali 1–163

> Provenienza: `docs/M6_CHECKLIST_IPHONE.md` a `2900ccc0`.

<a id="fonte-docs-m6-checklist-iphone-md-m6--checklist-iphone-per-diego-prova-fisica-evidenza-circoscritta"></a>

## M6 — Checklist iPhone per Diego (prova fisica, evidenza circoscritta)

> **Stato: APERTA e NON ESEGUITA.** Questa checklist **non è stata eseguita**, non contiene esiti e non
> certifica nulla finché non è compilata da Diego sul proprio dispositivo.
>
> **Un esito fisico positivo è evidenza circoscritta**: riguarda i passi qui elencati, su quella build e
> quel dispositivo, e **non chiude M6**, **non chiude M6-F3**, **non chiude i gate PWA, di produzione o di
> deploy** e non autorizza alcun rilascio. I **gate M6 restano quelli elencati** in
> [STATO_CORRENTE_M0_M10.md](../progetto/STATO.md#fonte-docs-stato-corrente-m0-m10-md-l1) e [CENSIMENTO_GATE_M6_M10.md](../storico/REGISTRO.md#fonte-docs-censimento-gate-m6-m10-md-l1)
> (M6-1, M6-2, M6-3 e la matrice delle copie PWA); lo stato delle decisioni di prodotto è in
> [REGISTRO_DECISIONI.md](../progetto/DECISIONI.md#fonte-docs-registro-decisioni-md-l1).
>
> **Autorità:** contratto [M6 — Sincronizzazione e scritture offline](../regole/OFFLINE.md#fonte-docs-m6-sincronizzazione-offline-md-l1);
> prevale la baseline di sicurezza.
> **Perimetro:** sola consultazione. Nessuna modifica ai dati, nessuna nuova credenziale di prova, nessun
> logout, nessun deploy. **Nessuna prova su dispositivi o ambienti reali è stata eseguita per produrre
> questo documento.**
> **Build da provare:** la sceglie **Diego**. Questa checklist non indica, non presume e non sostituisce
> la scelta della build o dell'ambiente.

<a id="fonte-docs-m6-checklist-iphone-md-perché-serve"></a>

### Perché serve

Il test del 10/09/2026 con un Account bancario aperto integralmente online non ha superato la
consultazione offline: dopo il distacco della rete la lista risultava vuota o non disponibile. Nessun
esito di laboratorio sostituisce questa prova. Questa checklist ripete il flusso in modo verificabile e
raccoglie **evidenze circoscritte**, senza catturare segreti.

<a id="fonte-docs-m6-checklist-iphone-md-1-anagrafica-del-test--da-compilare-prima-di-iniziare"></a>

### 1. Anagrafica del test — da compilare **prima** di iniziare

| Campo | Valore (a cura di Diego) |
|---|---|
| Data e ora di inizio | |
| Esecutore | |
| Dispositivo e versione iOS | |
| Browser / PWA usati (installata sulla Home?) | |
| **Versione e build effettive** lette nell'app (piè di pagina o schermata versione) | |
| **Ambiente provato** | ☐ produzione (app pubblicata) ☐ preview/laboratorio **esplicitamente autorizzati** |
| Riferimento dell'autorizzazione, se preview/laboratorio | |
| Rete disponibile per il ritorno online (Wi-Fi / dati) | |
| Note su fixture o account dedicati **già autorizzati** (se usati) | |

**Regole sull'ambiente.** Produzione e preview/laboratorio **non sono intercambiabili**: un esito su
preview **non** vale come prova di produzione e viceversa. Una prova su preview o laboratorio si esegue
**solo** se esiste un'autorizzazione esplicita e separata, da citare nel campo sopra. Se l'autorizzazione
non c'è, il test su quell'ambiente **non si esegue**.

Se il test si svolge in più sessioni, indicare la **data accanto a ogni riga** compilata.

<a id="fonte-docs-m6-checklist-iphone-md-2-regole-di-evidenza-nessun-segreto-nessun-dato-reale"></a>

### 2. Regole di evidenza (nessun segreto, nessun dato reale)

1. **Vietato** consegnare screenshot, foto, video, testi o report che contengano **PIN, CCV, password,
   credenziali, valori in chiaro, token o dati personali** (nomi, indirizzi, email, IBAN, documenti).
2. **Non trascrivere mai il valore** di un PIN, CCV, password o credenziale: si verifica solo il
   **comportamento** di mascheramento e rivelazione. La verifica è «il campo era mascherato, l'azione di
   rivelazione ha mostrato un valore, il campo è tornato mascherato», **senza registrare il valore**.
3. Ammesse come evidenza **solo**: (a) la **tabella compilata** con esiti strutturati; (b) i campi
   dell'anagrafica; (c) eventuali screenshot di schermate **prive di segreti e di dati personali**;
   (d) eventuali **fixture dedicate esplicitamente autorizzate**, dichiarate in anagrafica.
4. Se una schermata **può contenere** segreti o dati personali, **non acquisirla**; se serve comunque
   documentarla, **oscurarla sul dispositivo prima che l'immagine lo lasci**.
5. Non consegnare log, dump di IndexedDB, esportazioni o allegati che possano contenere valori cifrati
   con le relative chiavi, token o dati personali.
6. Se un'evidenza acquisita per errore contiene segreti o dati personali, **non consegnarla**: va
   eliminata dal dispositivo e sostituita con una descrizione strutturata dell'esito.

<a id="fonte-docs-m6-checklist-iphone-md-3-prerequisiti"></a>

### 3. Prerequisiti

- PWA installata sulla schermata Home (Safari → Condividi → Aggiungi a Home), **oppure** preview
  autorizzata secondo l'anagrafica.
- Versione e build **registrate in anagrafica** prima di iniziare.
- Master Password disponibile; Vault sbloccato prima del distacco.
- Sessione mantenuta: **non eseguire il logout** in nessun momento del test.
- Dati già presenti e non modificati nel profilo usato (almeno un Account personale e uno aziendale con
  banche e carte, Widget bancari, credenziali comuni, profilo, indirizzi, documenti, scadenze).
- Wi-Fi e rete mobile disponibili per il ritorno online.
- Circa 15 minuti. Nessuna nuova credenziale di prova va inserita.

<a id="fonte-docs-m6-checklist-iphone-md-4-preparazione-online-obbligatoria"></a>

### 4. Preparazione online (obbligatoria)

1. Apri l'app con rete attiva e sblocca il Vault con la Master Password.
2. Attendi che la preparazione offline automatica arrivi allo stato pronto. Non procedere prima.
3. Visita una volta, sempre online: lista Account personali, dettaglio degli Account bancari con le
   banche e le relative carte, Widget bancari, credenziali comuni, profilo (anagrafica, contatti,
   indirizzi, documenti), scadenze. Solo ciò che è stato caricato è garantito leggibile.
4. Non eseguire il logout.

<a id="fonte-docs-m6-checklist-iphone-md-5-distacco-della-rete"></a>

### 5. Distacco della rete

5. Attiva la Modalità aereo, oppure disattiva Wi-Fi e dati cellulare.
6. Verifica che l'app mostri lo stato offline. Da qui in avanti **non riattivare la rete** fino al §8.
7. Chiudi e riapri la PWA: è atteso un nuovo sblocco con la Master Password (le chiavi non sopravvivono
   alla chiusura: è il comportamento corretto).

<a id="fonte-docs-m6-checklist-iphone-md-6-verifiche-offline"></a>

### 6. Verifiche offline

Una riga per verifica. Segna **`OK`**, **`KO`** oppure **`NON ESEGUITO`**. Nessun valore segreto o dato
personale va trascritto: la colonna «Esito» contiene solo l'esito e, se serve, una nota di comportamento.

| # | Passo | Atteso (verifica di comportamento) | Esito |
|---|---|---|---|
| 1 | Apri la lista Account personali | Gli Account già caricati sono elencati; non una lista vuota | |
| 2 | Apri un Account bancario personale | Dettaglio visibile; presenza delle banche attese (nessun valore trascritto) | |
| 3 | Rivela e rimaschera PIN e CCV della prima carta | Campo **mascherato** prima della rivelazione; la rivelazione mostra un valore; il campo torna mascherato. **Non registrare il valore** | |
| 4 | Controlla la seconda banca e la sua carta | Stesso comportamento di mascheramento/rivelazione del punto 3; nessun valore mancante (**senza** trascriverlo) | |
| 5 | Apri la lista Account aziendali e un Account bancario aziendale | Stessi controlli dei punti 2–4 per il perimetro aziendale, **senza** trascrivere valori | |
| 6 | Apri i Widget bancari | Valori presenti e coerenti; **nessun dato di un altro Account** (nessun valore trascritto) | |
| 7 | Apri le credenziali comuni | Voci presenti con campi **mascherati**; comportamento di rivelazione come al punto 3 | |
| 8 | Apri il profilo: anagrafica, contatti, indirizzi, documenti | Dati già caricati leggibili (nessun dato personale trascritto) | |
| 9 | Apri gli allegati di un Account | Nome e metadati già caricati; **non** è richiesto che il contenuto del file sia disponibile offline | |
| 10 | Apri le scadenze | Dati già caricati leggibili | |
| 11 | Blocca il Vault e tenta di rileggere i dati | Accesso negato finché non si sblocca di nuovo | |
| 12 | Sblocca di nuovo con la Master Password | La matrice precedente torna leggibile | |
| 13 | Cambia sezione e torna indietro | I valori rivelati vengono **azzerati** quando si lascia la vista | |

<a id="fonte-docs-m6-checklist-iphone-md-7-chiusura-riapertura-e-cache-mancante"></a>

### 7. Chiusura, riapertura e cache mancante

14. Chiudi completamente la PWA e riaprila **senza rete**; sblocca e ripeti i punti 1, 2, 5 e 6.
15. Opzionale ma più severo: riavvia l'iPhone senza rete e ripeti i punti 1, 2, 5 e 6.
16. Se una lista o un dettaglio **già caricato** appare vuoto o «non disponibile» offline, registra
    **`KO`**: una lista vuota non significa «nessun dato».
17. Verifica un dominio mai aperto online (per esempio il profilo di un'azienda mai visitata): deve
    comparire un messaggio di indisponibilità, **non** un record vuoto o inventato. Se il dato non viene
    mostrato come valido, registra **`OK`**.
18. Un documento mai caricato non è garantito offline: è un limite noto, **se** non viene presentato come
    dato valido. Le domande aperte su questo tema restano in
    [M6_DOMANDE_CACHE_ESPULSA.md](../domande/M6_OFFLINE.md#fonte-docs-m6-domande-cache-espulsa-md-l1).

<a id="fonte-docs-m6-checklist-iphone-md-8-ritorno-online"></a>

### 8. Ritorno online

19. Disattiva la Modalità aereo e attendi il ritorno della connessione.
20. Verifica di essere ancora autenticato senza nuovo login.
21. Riapri un dettaglio bancario: gli stessi dati devono essere presenti e coerenti (nessun valore
    trascritto).

<a id="fonte-docs-m6-checklist-iphone-md-9-condizioni-di-stop"></a>

### 9. Condizioni di stop

Interrompi il test e riferisci subito, **senza tentare riparazioni**, se:

- un valore segreto è visibile in chiaro dove dovrebbe essere mascherato;
- compaiono dati di un altro Account o di un altro utente;
- il Vault si sblocca senza Master Password, oppure la sessione cambia utente da sola;
- un Account o una lista caricati integralmente online appaiono vuoti o non disponibili offline: è il
  difetto originale, va registrato e non aggirato;
- l'app richiede un nuovo login o esegue il logout da sola;
- un dato risulta modificato;
- **un'evidenza acquisita contiene segreti o dati personali**: non consegnarla, eliminala dal dispositivo
  e sostituiscila con una descrizione strutturata dell'esito.

Non modificare dati, non rifare la preparazione, non reinstallare l'app e non eseguire alcun deploy
durante il test.

<a id="fonte-docs-m6-checklist-iphone-md-10-esito-e-limiti"></a>

### 10. Esito e limiti

- Consegna la **tabella compilata** (anche con righe `NON ESEGUITO`) e l'**anagrafica**: sono le evidenze
  ammesse. Aggiungi screenshot **solo** se privi di segreti e dati personali.
- **Un esito positivo è evidenza circoscritta**: vale per i passi elencati, su quella build e quel
  dispositivo. **Non chiude M6**, **non chiude M6-F3**, **non chiude i gate PWA, di produzione o di
  deploy** e non autorizza alcun rilascio.
- I **gate M6** restano quelli di [STATO_CORRENTE_M0_M10.md](../progetto/STATO.md#fonte-docs-stato-corrente-m0-m10-md-l1) e
  [CENSIMENTO_GATE_M6_M10.md](../storico/REGISTRO.md#fonte-docs-censimento-gate-m6-m10-md-l1); un esito **`KO`** o **`NON ESEGUITO`** non
  chiude nulla e non va presentato come superato.
- La build e l'ambiente li sceglie **Diego**: questa checklist non li seleziona e non presume che la
  prova sia già avvenuta su produzione, preview o laboratorio.

> Evidenza locale 10/10/2026 — M7 blocco globale: regressione sintetica dei writer Admin già recintati (recupero sync, restore backup, risposta inviti, allegati condivisi e contratto lock) **63/63**. Nessun dato reale, deploy o attivazione; il risultato non certifica ancora tutti i writer Admin né il ciclo acquire/release della purge.
> Evidenza locale 10/10/2026 — M7 writer di riferimento: Widget Account e Credenziale comune bloccano le mutazioni con lock globale attivo prima delle letture di dominio; regressione mirata **34/34**. Prova sintetica, senza deploy e senza attivazione del purge.
> Evidenza locale 10/10/2026 — M7 writer offline: anche Account privato e sync offline falliscono chiusi sul lock globale prima delle letture di dominio. Contratto mirato **17/17**, regressione combinata **34/34**; solo fixture sintetiche, nessun deploy.
> Evidenza locale 10/10/2026 — M7 ciclo lock/purge: acquire CAS, resume, persistenza del lock dopo interruzione e release atomica finale verificati nella regressione sintetica **31/31**. Il motore rimane hard-off; la prova non usa Storage o dati reali e non autorizza il rollout.
> Evidenza locale 10/10/2026 — regressione Functions completa dopo il blocco globale: controlli sintattici e lint verdi; **427 pass, 9 skip, 0 fail**. Gli skip rimandano a profili emulatore dedicati e non vanno contati come gate superati.
> Evidenza locale 10/10/2026 — Firestore Rules Emulator: **78/78**, zero fallimenti; lock attivo, release valida, fail-closed su record malformato e namespace backend-only verificati senza dati reali.
> Evidenza locale 10/10/2026 — governance documentale: **31 MD**, **615 link**, **11/11** controlli superati nel rerun locale autorizzato.
> Evidenza release 10/10/2026 — candidata `1.2.152`: regressione completa attraversata dopo il nuovo fence globale; corretto il caso di riacquisizione del lock da parte di una nuova purge dopo una release. Ultimi profili rieseguiti con esito verde: QR **2/2**, allegati documento Firestore/Storage **9/9**, collegamenti profilo **2/2**, note Account **1/1**, Account standard **1/1**. Solo fixture ed emulatori sintetici; non equivale a prova su GCS o dispositivi reali e non abilita i motori hard-off.
