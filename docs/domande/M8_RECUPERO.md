# M8 recupero

> Esito pubblicato 09/10/2026: versione `1.2.145` verificata con backup cifrato sintetico. Anteprima integra, 0 mancanti, 0 modificati, 1 profilo invariato; `settings/security` escluso prima della callable e sicurezza corrente preservata. Nessuna scrittura applicata. I gate del motore riprendibile hard-off restano separati.

> Aggiornamento 09/10/2026: nella candidata `1.2.145` il runtime corrente autentica e conta `settings/security`, poi lo esclude prima dell'anteprima e della callable, conservando la sicurezza Vault attuale con avviso esplicito. Test backup 110/110; resta il collaudo pubblicato finale con dato sintetico.

> Chiusura operativa 09/10/2026: le domande storiche restano conservate come evidenza, ma il ciclo corrente termina con il motore riprendibile hard-off. Attivazione e prove GCS/dispositivo richiedono un nuovo incarico.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

**RIAPERTA per implementazione e prove locali, 27/09/2026.** Diego approva il comportamento consolidato 2A/2B e la pulizia temporanei 3A: decisione corrente in [DECISIONI](../progetto/DECISIONI.md). Superata la sospensione; Q1–Q5, N1–N4 e S1–S2 sotto conservano la storia, non sono domande da riproporre se coperte dalle nuove risposte. Il gate resta aperto fino a implementazione/verifica, senza autorizzazione al deploy.

## Indice delle fonti conservate

### M8-RP-01 — piano persistente di ripresa, decisione ricevuta 05/10/2026

**Risposto:** 30 giorni, poi nuova anteprima senza rimuovere i dati già ripristinati. Fonte e limiti in [DECISIONI](../progetto/DECISIONI.md), requisito in [BACKUP](../regole/BACKUP.md). Non riproporre la scelta; restano implementazione e collaudi. Il paragrafo seguente conserva la domanda del 04/10, superata dalla risposta.

La ripresa in nuova sessione è già approvata (2A), non viene rimessa in discussione. Per ritrovare l'esatta operazione servono identità/selezione/versioni originarie e associazione ai chunk, non soltanto backupId. L'implementazione attuale conserva il piano in RAM; le ricevute candidate non ricostruiscono da sole i comandi. Quale durata approvare per il piano minimo server di un ripristino interrotto e quale comportamento alla sua scadenza? I sette giorni approvati riguardano esclusivamente upload incompleti (3A), non vengono estesi al piano o alle ricevute. Prima della decisione resta sospesa soltanto l'attivazione di questa nuova persistenza; nessun contenuto, chiave o backup sarà salvato come espediente. Restano proseguibili prove pure e coordinamento purge. Le alternative tecniche e i metadati minimi vanno precisati prima di implementare il registro; nessuna durata o eliminazione automatica scelta dall'agente.

### M8-TS-01 — precisione timestamp, decisione ricevuta 05/10/2026

**Risposto:** blocco del ripristino con spiegazione per precisione non conservabile esattamente; nessun arrotondamento silenzioso. Fonte in [DECISIONI](../progetto/DECISIONI.md), requisito in [BACKUP](../regole/BACKUP.md). Restano implementazione e prove; i paragrafi seguenti conservano il riesame e la domanda precedenti alla conferma.

Riesame provenienza: backup-export-service usa esclusivamente funzioni get/listBackup del repository; tutte passano da getDoc(s)ServerConfirmed e quindi getDoc(s)FromServer. L'encoder copia seconds/nanoseconds senza generarli. Il caso456ns è stato immesso dalla fixture, non osservato in backup reale dell'app. Lettura statica non esclude overlay di scritture pendenti o altri produttori di backup: non generalizzare a impossibilità assoluta. Priorità del quesito circoscritta agli input non rappresentabili; nessuna risposta necessaria per proseguire il lavoro indipendente.

Prova candidata su Firestore emulato: timestamp456ns riletto0ns,456000ns conservato. Il formato/validatore accetta nanosecondi arbitrari; nessuna decisione specifica trovata nella ricerca in DECISIONI, BACKUP e questa raccolta. Per timestamp non rappresentabili esattamente, rifiutare il ripristino con spiegazione oppure accettare esplicitamente la riduzione al microsecondo? Nessuna risposta presunta e nessuna modifica semantica applicata. Verificare prima se un backup prodotto dall'app possa effettivamente contenere questi valori; il quesito non blocca le prove indipendenti. Evidenza in COLLAUDI, non difetto dichiarato risolto.

- [M8_DOMANDE_RIPRISTINO_CAS_PARZIALE.md](#fonte-docs-m8-domande-ripristino-cas-parziale-md-l1)
- [M8_DOMANDE_RIPRISTINO_INTERROTTO.md](#fonte-docs-m8-domande-ripristino-interrotto-md-l1)
- [M8_DOMANDE_RIPRISTINO_NUOVA_SESSIONE.md](#fonte-docs-m8-domande-ripristino-nuova-sessione-md-l1)

<a id="fonte-docs-m8-domande-ripristino-cas-parziale-md-l1"></a>

## Fonte: M8_DOMANDE_RIPRISTINO_CAS_PARZIALE.md — righe originali 1–55

> Provenienza: `docs/M8_DOMANDE_RIPRISTINO_CAS_PARZIALE.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m8-domande-ripristino-cas-parziale-md-m8-ter--domande-per-diego-modifica-dopo-lanteprima-e-ripristino-parziale"></a>

## M8-ter — Domande per Diego: modifica dopo l'anteprima e ripristino parziale

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica «modifiche
> intervenute dopo l'anteprima» (ultima parte del sotto-gate `docs/M8_BACKUP_RECUPERO.md:59`).
> **Commit delle prove tecniche:** `tests/restore-stale-preview.emulator.test.mjs`,
> `scripts/run-restore-stale-emulators.mjs`, aggiornamento di `docs/M8_BACKUP_RECUPERO.md`.
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce
> politiche, compensazioni, staging o retry.
> **Non duplica** le domande già raccolte: `docs/M8_DOMANDE_RIPRISTINO_INTERROTTO.md` (Q1-Q5,
> buco fra record e byte e piano bloccato), `docs/M8_DOMANDE_RIPRISTINO_NUOVA_SESSIONE.md`
> (N1-N4, riapertura dello stesso backup). Qui il caso è diverso: **il ripristino si ferma perché
> i dati sono cambiati dopo l'anteprima**, non perché un upload è fallito.

<a id="fonte-docs-m8-domande-ripristino-cas-parziale-md-che-cosa-è-stato-osservato"></a>

### Che cosa è stato osservato

Sul percorso reale (client di produzione + callable reale, emulatori Firestore/Storage, dati
sintetici):

- **un blocco**: la modifica concorrente dopo l'anteprima fa rifiutare il blocco
  (`BACKUP_PREVIEW_STALE`) **senza** scrivere dati, ricevute o audit e **senza** upload; il valore
  concorrente sopravvive e il piano viene invalidato;
- **più blocchi** (403 record → blocchi da 400 e 3): il primo blocco viene **applicato** (con
  ricevuta e audit) e il secondo è rifiutato: il ripristino resta **parziale**. Poiché la fase
  Storage parte solo dopo **tutti** i blocchi, il metadato dell'allegato applicato nel primo blocco
  resta **senza byte** (`storage/object-not-found`): il rifiuto del controllo di versione **crea**
  un riferimento orfano, come già osservato per l'upload fallito.

**Nessuna correzione è stata introdotta.**

<a id="fonte-docs-m8-domande-ripristino-cas-parziale-md-domande"></a>

### Domande

1. **S1 — La fase Storage nei flussi a più blocchi.**
   Oggi gli upload partono solo dopo che **tutti** i blocchi sono stati applicati: se un blocco
   successivo viene rifiutato, i record già applicati restano senza i loro byte. I byte vanno
   caricati **blocco per blocco** man mano che i blocchi vengono applicati, oppure lo stato parziale
   va accettato e dichiarato? (La Q1 di `M8_DOMANDE_RIPRISTINO_INTERROTTO.md` riguarda lo staging e
   la compensazione dopo un **upload fallito**; qui il trigger è il rifiuto del controllo di
   versione e la domanda è sull'**ordine della fase Storage** rispetto ai blocchi.)

2. **S2 — Che cosa vede l'utente in un ripristino parziale per dati cambiati.**
   Con blocchi già applicati, la UI mostra il messaggio generico «Ripristino interrotto: alcuni dati
   potrebbero essere già stati applicati» (`impostazioni.js:507-510`) e resta **una** ricevuta e
   **un** audit del blocco applicato. Va indicato esplicitamente **quanto** è stato applicato (quali
   blocchi, quali ricevute, quali allegati restano senza byte) e chi approva il testo (D6)? La Q4 di
   `M8_DOMANDE_RIPRISTINO_INTERROTTO.md` riguarda l'allegato senza byte in generale; qui si chiede se
   il **ripristino parziale da modifica concorrente** merita una segnalazione propria.

<a id="fonte-docs-m8-domande-ripristino-cas-parziale-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: formato, import, export, Rules e
runtime sono **invariati**; nessun dato o backup reale è stato letto o creato; il codice di
produzione è stato mutato **solo** per il controllo di discriminazione (esito del CAS reso vuoto) e
poi ripristinato con hash identico a `HEAD`. Le prove tecniche sono in un commit separato; questo
documento non le ripete e non le sostituisce. **M8 resta aperto**: questo caso non conclude l'intero
gate.

<a id="fonte-docs-m8-domande-ripristino-interrotto-md-l1"></a>

## Fonte: M8_DOMANDE_RIPRISTINO_INTERROTTO.md — righe originali 1–50

> Provenienza: `docs/M8_DOMANDE_RIPRISTINO_INTERROTTO.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m8-domande-ripristino-interrotto-md-m8--domande-per-diego-ripristino-interrotto-fra-record-e-allegati"></a>

## M8 — Domande per Diego: ripristino interrotto fra record e allegati

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M8.
> **Commit delle prove tecniche:** `425e68d0` (banco, aggiornamento di `docs/M8_BACKUP_RECUPERO.md`, runner e registrazione).
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce
> staging, compensazione, retry o nuove politiche. **Contesto:** `docs/M8_BACKUP_RECUPERO.md`
> (gate «dimostrare assenza di riferimenti orfani», ora dichiarato **non chiuso**) e
> `tests/interrupted-restore-orphan-refs.emulator.test.mjs`.

<a id="fonte-docs-m8-domande-ripristino-interrotto-md-che-cosa-è-stato-osservato"></a>

### Che cosa è stato osservato

Con il percorso reale `executeBackupRestore` su emulatori (dati sintetici): i **record** vengono
applicati a blocchi **prima** degli upload; se un `uploadBytes` fallisce, il piano si blocca
(`BACKUP_STORAGE_RETRY_BLOCKED`) e in Firestore resta il **riferimento** all'allegato **senza i
byte** in Storage (`storage/object-not-found`). Il caso è complementare a quello già dichiarato
nel documento M8 («byte senza riferimento», riga 120). Il controllo positivo (upload riuscito)
mostra riferimento e byte coerenti. **Nessuna correzione è stata introdotta.**

<a id="fonte-docs-m8-domande-ripristino-interrotto-md-domande"></a>

### Domande

1. **Q1 — Come chiudere il buco fra record e byte.**
   (a) **Staging**: caricare i byte **prima** di scrivere il record, così un fallimento non lascia
   riferimenti; (b) **compensazione**: cancellare il riferimento se l'upload fallisce; (c)
   **ripresa**: rendere riprovabile il piano bloccato e completare gli upload mancanti; (d)
   lasciare com'è e documentare il limite. Quale?

2. **Q2 — Il caso inverso.**
   Con lo staging (o con un upload riuscito e record non scritto) si creano **byte senza
   riferimento**. Vanno accettati e dichiarati, marcati in qualche modo, o puliti da un job per
   prefisso (D4)?

3. **Q3 — Il piano bloccato.**
   Oggi, dopo un errore in fase `storage`, il piano è **bloccato** e un nuovo tentativo è
   rifiutato: l'utente deve rifare l'intero ripristino. Va reso riprovabile (retry esplicito dei
   soli upload mancanti) o è accettabile così?

4. **Q4 — Che cosa vede l'utente.**
   Un allegato con riferimento senza byte va segnalato nell'interfaccia (es. «allegato non
   disponibile: ripristino incompleto») o resta invisibile finché non lo si apre? Chi approva il
   testo (D6)?

5. **Q5 — Rapporto con le decisioni esistenti.**
   Questa voce è autonoma o rientra in **D5** (backup e ricevute) e **D16** (ripristino dopo un
   purge)? Il gate M8 resta **aperto** finché non c'è una decisione.

<a id="fonte-docs-m8-domande-ripristino-interrotto-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: formato, import, export, Rules e
runtime sono **invariati**; nessun dato o backup reale è stato letto o creato. Le prove tecniche
sono nel commit `425e68d0`; questo documento non le ripete e non le sostituisce.

<a id="fonte-docs-m8-domande-ripristino-nuova-sessione-md-l1"></a>

## Fonte: M8_DOMANDE_RIPRISTINO_NUOVA_SESSIONE.md — righe originali 1–55

> Provenienza: `docs/M8_DOMANDE_RIPRISTINO_NUOVA_SESSIONE.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m8-domande-ripristino-nuova-sessione-md-m8-bis--domande-per-diego-nuovo-tentativo-in-una-nuova-sessione-di-ripristino"></a>

## M8-bis — Domande per Diego: nuovo tentativo in una nuova sessione di ripristino

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica «retry fra
> esecuzioni diverse» (sotto-gate di `docs/M8_BACKUP_RECUPERO.md:59`).
> **Commit delle prove tecniche:** `tests/restore-retry-new-session.emulator.test.mjs`,
> `scripts/run-restore-retry-emulators.mjs`, aggiornamento di `docs/M8_BACKUP_RECUPERO.md`.
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce
> retry automatici, staging, compensazione, migrazione o nuove politiche.
> **Non duplica** le domande di `docs/M8_DOMANDE_RIPRISTINO_INTERROTTO.md` (Q1-Q5), che restano
> aperte: quelle riguardano il buco fra record e byte e il piano bloccato, queste riguardano che
> cosa deve accadere quando l'utente **riapre lo stesso backup** dopo un'interruzione.

<a id="fonte-docs-m8-domande-ripristino-nuova-sessione-md-che-cosa-è-stato-osservato"></a>

### Che cosa è stato osservato

Con il percorso reale su emulatori e dati sintetici: dopo un ripristino interrotto (record
applicati, primo upload fallito, piano bloccato), una **nuova** sessione di ripristino dello stesso
file classifica i record già scritti — **compreso il metadato dell'allegato i cui byte mancano** —
come «invariato»; l'esecuzione è rifiutata con `BACKUP_RESTORE_NOTHING_SELECTED` (senza selezione e
anche selezionando gli «invariato») e **non** tenta alcun caricamento, quindi il riferimento resta
senza byte. Se invece il metadato manca, la nuova sessione lo ripristina **con** i byte; se cambia
solo un altro record, la nuova sessione riesce ma i byte mancanti **non** vengono ricaricati.
**Nessuna correzione è stata introdotta.**

<a id="fonte-docs-m8-domande-ripristino-nuova-sessione-md-domande"></a>

### Domande

1. **N1 — L'allegato «invariato» senza byte.**
   Oggi la classificazione guarda solo il documento Firestore: un allegato il cui riferimento
   esiste ma i cui byte sono assenti risulta «invariato». Deve l'anteprima **verificare anche i
   byte** in Storage e classificare quel caso a parte (es. «allegato da ricaricare»)? È una scelta
   di prodotto: nessuna modifica è stata fatta.

2. **N2 — Selezionare un «invariato» per ricaricarne i byte.**
   Nel ripristino selettivo le voci «Invariato» non sono selezionabili e vengono comunque escluse
   dall'esecuzione. Deve essere possibile selezionare un «invariato» **al solo scopo** di
   ritrasferire i suoi allegati mancanti?

3. **N3 — Ripristino riuscito e allegati dei record esclusi.**
   Quando una nuova sessione applica solo i record «mancante»/«modificato», gli allegati dei record
   esclusi non vengono ricaricati: l'orfano sopravvive a un ripristino **riuscito**. Deve un
   ripristino riuscito lasciare il Vault in uno stato dichiaratamente incompleto (con un elenco
   degli allegati non recuperati) o tentare di ricaricare **tutti** gli allegati del file?

4. **N4 — Che cosa legge l'utente quando riapre lo stesso backup.**
   Con tutti i record già applicati, l'esecuzione viene rifiutata e l'interfaccia mostra «Backup
   non valido, incompleto o non applicabile» (`impostazioni.js:520-522`), che non descrive il caso
   reale («questo backup risulta già applicato; N allegati non hanno byte»). Va previsto un esito e
   un testo dedicati, e chi li approva (D6)?

<a id="fonte-docs-m8-domande-ripristino-nuova-sessione-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: formato, import, export, Rules e
runtime sono **invariati**; nessun dato o backup reale è stato letto o creato; il codice di
produzione è stato mutato **solo** per il controllo di discriminazione e poi ripristinato con hash
identico. Le prove tecniche sono in un commit separato; questo documento non le ripete e non le
sostituisce.
