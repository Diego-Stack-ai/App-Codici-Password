# Decisioni

## 05/10/2026 — M8-RP-01 e M8-TS-01: conferma esplicita

Fonte: Diego risponde in questa chat «Confermo 30 giorni e blocco con spiegazione» alle due proposte illustrate.

- **M8-RP-01:** conservare per 30 giorni il piano minimo di ripresa del ripristino interrotto, composto da identificativi e versioni, senza password, chiavi o contenuti del backup. Alla scadenza occorre una nuova anteprima; i dati già ripristinati restano. La durata non si estende alle ricevute, agli upload incompleti o ad altre categorie.
- **M8-TS-01:** se una data nel backup non può essere conservata esattamente dal database, bloccare il ripristino con una spiegazione; non arrotondare silenziosamente e non applicare l'alternativa della perdita di precisione.

Chiusi i quesiti decisionali, non l'implementazione o il gate M8. Proseguono sviluppo e prove locali già autorizzati; nessuna autorizzazione a deploy, produzione, modifica Rules o riattivazione purge.

04/10/2026 — Diego conferma «si» alla proposta di bloccare temporaneamente la cancellazione definitiva nel codice locale, mantenendo archivio/ripristino disponibili mentre prosegue l'integrazione sicura. Nessuna autorizzazione a deploy o modifica produzione. È mitigazione temporanea dei due difetti concorrenti, non loro soluzione definitiva.

## 27/09/2026 — sessione tecnica recupero MFA: autorizzazione locale esplicita

Diego risponde «Autorizzo soltanto progettazione e prove locali» alla domanda sulla sessione Firebase temporanea creata dal server dopo password e codice di recupero validi. Autorizzati esclusivamente progettazione e collaudo con dati sintetici: sessione solo in memoria server, mai inviata al browser o salvata nei documenti. Nessuna attivazione online, accesso produttivo o autorizzazione al rilascio. Superata soltanto la precedente mancanza di consenso al collaudo locale del meccanismo; sicurezza selettiva, concorrenza e ripresa di 15 minuti devono ancora essere dimostrate.

## 27/09/2026 — recupero Authenticator obbligatorio

Diego richiede esplicitamente di implementare il recupero con password e codice di emergenza dopo perdita dell'Authenticator. Conferma del requisito, non attestazione che il percorso sia già funzionante. Alla domanda sulla nuova sessione tecnica Firebase interna ha chiesto a cosa servisse: non registrare quella risposta come consenso esplicito al meccanismo custom-token. Restano autorizzati gli altri lavori locali; produzione e rilascio esclusi. Il codice di recupero MFA non sostituisce la password separata del Vault.

## 27/09/2026 — recupero MFA, alternativa 1 confermata

Fonte: risposta esplicita di Diego «risposta 1» dopo spiegazione delle tre alternative. Correggere il recupero perché rimuova soltanto i fattori originari dell'operazione e preservi quelli aggiunti successivamente, anche in concorrenza. La funzione non è pronta al rilascio finché questa protezione non è verificata. Non è rinuncia al recupero, né approvazione della sua esclusione temporanea dal prodotto o del rischio di rimozione indiscriminata. Rimane valida la decisione 5: ripresa della medesima operazione per 15 minuti con nuova verifica password. Gli altri lavori locali già autorizzati proseguono indipendentemente; nessuna modifica di produzione o autorizzazione al rilascio.

## 27/09/2026 — frequenza notifiche, risposta esplicita di Diego

Confermato: conservare il registro opaco per 30 giorni e limitare a 30 giorni l’intervallo massimo tra avvisi. Nessuna estensione della conservazione. Nuovi valori e modifiche ammettono interi 1–30; vecchie frequenze superiori non vengono riscritte né accelerate automaticamente: richiedono correzione esplicita nella configurazione. Il guard backend preesistente blocca gli invii anticipati non supportati, mantenendo l’avviso nel giorno della scadenza. Nessuna migrazione di produzione eseguita.

## 27/09/2026 — programma locale unificato, conferme definitive di Diego

Fonte: risposte in questa chat alle domande 1A–5 e conferma successiva «I due anni partono dall'ultima archiviazione. Confermo comunque 1 e 2. Ora procedi a completare tutto il programma». Decisioni di comportamento e autorizzazione a implementazione/prove locali; non attestazioni di implementazione. Nessun commit/merge/push/deploy o modifica dei dati produttivi.

- **1A, conflitti purge:** prevale la conservazione dei dati. Se ripristino/caricamento e cancellazione entrano in conflitto, fermare la cancellazione e consentire una nuova richiesta dopo verifica; non promettere reversibilità di byte già eliminati. Progettare serializzazione/versionamento prima del passo distruttivo e stato esplicito per errori parziali.
- **1B, archivio:** due anni dall'ultima archiviazione, anche dopo ripristino e nuova archiviazione. Purge automatico non prima di almeno dieci giorni dalla creazione persistita dell'avviso interno; un avviso non creato rinvia il purge. Lettura/conferma dell'avviso non richiesta. Mancata consegna push non blocca se l'avviso interno è regolarmente registrato. Restano verifica organizzativa/legale D8 e autorizzazione separata all'attivazione distribuita.
- **2A, M8 riaperto:** staging/verifica degli allegati prima della disponibilità del relativo blocco; blocchi completati conservati senza promessa di rollback globale; ripresa dei soli elementi mancanti anche in nuova sessione; modifiche concorrenti mai sovrascritte silenziosamente. Riepilogo di recuperati/mancanti/conflitti; riparazione allegati delle sole voci selezionate, incluse voci testuali invariate con byte mancanti. Superata la sospensione precedente, non dichiarato chiuso il gate M8.
- **2B, D5:** backup precedente può ricreare un elemento purgato soltanto mediante ripristino esplicito con avviso; non riattivare automaticamente condivisioni pregresse. Nessuna distruzione retroattiva dei backup posseduti dall'utente.
- **3A:** pulizia server riprovabile dei file sicuramente non più referenziati dopo salvataggio riuscito (avatar sostituiti, allegati rimossi, upload abbandonati). Identità/percorso e riferimenti verificati, mai omonimia. Upload temporanei incompleti riprendibili per sette giorni, poi pulizia escludendo operazioni attive; durata non estesa ad altre categorie.
- **3B:** impedire eliminazione Azienda finché contiene Account, da spostare o eliminare prima tramite le rispettive procedure; non cascata implicita degli Account.
- **3C:** eliminare scadenze dimostrate derivate dall'Account, preservare autonome anche omonime; origine ambigua sospende quella parte con segnalazione. Copie esportate e dispositivi offline non eliminabili immediatamente a distanza: limite da comunicare.
- **4:** approvato registro anti-duplicati degli invii destinatari push/email per 30 giorni, identificativi opachi/stato/date, senza contenuti/email/token. Distinto dal precedente N1. Ritentativi incerti già consentiti, nessuna promessa exactly-once; non autorizza invii oltre eleggibilità/scadenza.
- **5:** ripresa della stessa operazione di recupero MFA per 15 minuti con nuova verifica della password; nessun riuso generale del codice consumato. Stato minimo utente/operazione/date/esito, nessuna password o codice in chiaro. Scaduta la finestra serve altro metodo valido; nessun bypass manuale dell'identità né garanzia di recupero a metodi esauriti. Non estende automaticamente la retention audit; pulizia dello stato transitorio da verificare.

Lingue, AI ed esportazione Excel rinviati a un secondo momento, esclusi dall'attuale sequenza tecnica. Non è autorizzazione al rilascio prima dei gate. Diego eseguirà successivamente controlli sull'app locale integrata; le demo separate non equivalgono a tale consegna.

**27/09/2026 — ordine pre-finale di riconciliazione:** Diego richiede di completare il lavoro descritto negli MD e aggiungere, prima di lingue/AI/esportazione Excel, riconciliazione completa dell'app e risoluzione verificata dei difetti noti, compresi quelli caratterizzati da prove verdi. Sequenza e criteri in PROGRAMMA, incarico in INCARICO_CORRENTE. Il rinvio delle tre funzionalità a dopo pubblicazione è un'opzione da decidere, non un rinvio definitivo approvato. Nessuna chiusura automatica dei gate o autorizzazione Git/rilascio.

**27/09/2026 — preparazione locale autonoma e invii incerti:** Diego autorizza correzioni e prove locali fino alla preparazione al rilascio, continuando sui lavori indipendenti quando una parte richiede decisioni. Approvato ritentare gli invii dall'esito incerto, accettando possibili duplicati. Non è approvazione di una durata di conservazione nuova, di registri ulteriori o di tentativi oltre scadenza. Quesiti da raccogliere insieme; niente commit, merge, push, deploy o modifica produzione senza ordine successivo.

**26/09/2026 — NOTIFICHE-08, recupero fallimento totale:** Diego conferma con «procedi» la proposta di ritentare al controllo giornaliero successivo, entro la scadenza, quando nessun push ai destinatari riesce per errore temporaneo. Successi parziali invariati per evitare reinvii indiscriminati; niente nuovi registri o migrazioni. Non autorizza tentativi oltre scadenza o una nuova politica email.

**26/09/2026 — NOTIFICHE-08, calendario backend approvato:** Diego risponde «sì» alla scelta di usare sempre il giorno italiano (Europe/Rome) per gli avvisi, indipendentemente dal fuso del server. Autorizzata correzione locale e prove; vecchie registrazioni inalterate, nessuna migrazione o modifica delle regole di retry, nessun deploy. I marcatori date-only precedenti restano letti letteralmente: il loro istante/fuso originale non è ricostruibile con certezza.

**26/09/2026 — PROMEMORIA-06, soglia Urgenze approvata da Diego:** «sì confermo» alla regola proposta: il giorno di scadenza resta «Scade oggi» nei promemoria per tutta la giornata; dal giorno successivo passa nelle Urgenze e scompare dai promemoria. Uniformare Home e lista Urgenze su questa regola di giorno di calendario, senza cambiare la scadenza originale o le politiche di invio push/email.

## CORREZIONI-05-N1 — conservazione anti-duplicati approvata il 25/09/2026

Diego ha risposto «approvo» alla proposta in questa chat: registro tecnico minimo anti-duplicati per **30 giorni**, senza nomi, email o contenuti degli Account; eventi più vecchi ignorati per impedire che un avviso cancellato ricompaia per riconsegna tardiva. Approvazione limitata a progettazione, implementazione e test locali, non distribuzione o accesso ai dati reali. La finestra riguarda il registro N1, non cambia la conservazione generale delle notifiche, audit, backup o purge. Implementazione, pulizia effettiva e limiti operativi vanno verificati separatamente: questa decisione non certifica cancellazioni già eseguite.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](STATO.md).

Questo registro indicizza decisioni e loro successioni: non crea da solo incarichi. Una decisione di prodotto, una realizzazione nel ramo e un rilascio sono tre eventi distinti. Le date Git non sono date di approvazione. I riferimenti `:N` nelle fonti migrate sono riferiti ai vecchi file alla base indicata e si ricostruiscono dalla mappa di migrazione.

## M6-C1/C2/C3 — decisioni già registrate, ora indicizzate

- **M6-C1 DECISA:** avviso esplicito di indisponibilità locale, senza affermare perdita sul server o chiedere reinserimenti. Prova fisica della causa ancora aperta. [DEEPSEEK_COORDINATION (base, riga 7689)](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l7689).
- **M6-C2 DECISA:** ripreparazione al ritorno online quando possibile, con sessione valida; non estendere il timer e non dichiarare riuscita senza verifica. Vault bloccato/scaduto richiede normale sblocco. Attuazione distinta dalla decisione. [DEEPSEEK_COORDINATION (base, riga 7882)](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l7882).
- **M6-C3 APERTA:** la risposta sui duplicati della coda non decide lo sblocco offline dopo espulsione/perdita di identità e non autorizza cancellazioni. [DEEPSEEK_COORDINATION (base, riga 7884)](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l7884).

## Indice delle fonti conservate

- [REGISTRO_DECISIONI.md](#fonte-docs-registro-decisioni-md-l1)

<a id="fonte-docs-registro-decisioni-md-l1"></a>

## Fonte: REGISTRO_DECISIONI.md — righe originali 1–257

> Provenienza: `docs/REGISTRO_DECISIONI.md` a `2900ccc0`.

<a id="fonte-docs-registro-decisioni-md-registro-indicativo-delle-decisioni--indice-non-normativo"></a>

## Registro indicativo delle decisioni — indice NON normativo

> **Natura del documento.** Indice **breve, datato e NON normativo**: elenca decisioni, rinvii e stati
> **già dimostrabili nelle fonti esistenti**, con il collegamento alla fonte originale. **Non sostituisce
> le fonti**: in caso di divergenza valgono i documenti originali, e la baseline di sicurezza e i
> contratti specialistici restano **normativi**. Questo file non crea, non estende e non reinterpreta
> alcuna decisione.
>
> **Revisione del documento:** **D02 R2 — 23/09/2026** (correzione finale). Allinea le approvazioni esterne
> **M6-A-8b / 8c R1 / 8d / 8e** alla loro **provenienza dichiarata** (autore, conversazione, citazione
> testuale, commit, metadati **non esposti dalla UI**) e registra **M6-A-8c base** come **non approvata**;
> per M7 distingue **decisione**, **implementazione nel ramo** e **distribuzione** e aggiunge le decisioni
> **successive del 22/09/2026**; i **richiami puntuali** sono stati ricontrollati. Revisione precedente:
> **D02 R1**.
>
> **Base:** ramo `integration/vault-shell-v127-security`, commit `9be970201a26f1e1df1efa425b8ff74c18ca56ec`
> (`9be97020`, **D01 R1**), working tree pulito, **23/09/2026**. Il registro è stato creato con **D02**
> (`e7b97080`) e corretto con **D02 R1** (`4e0ee70d`) e **D02 R2** (correzione finale, commit locale
> successivo che **non riscrive** i precedenti).
>
> **Perimetro:** solo documentazione versionata. Nessun accesso a console, ambienti distribuiti, PWA o
> dati reali; nessuna modifica a codice, test, versione, Rules/Functions.

<a id="fonte-docs-registro-decisioni-md-come-leggere-le-voci"></a>

### Come leggere le voci

**Stati:** **DECISA** = scelta registrata con autorità e perimetro; **PARZIALE** = parte decisa e parte
ancora aperta, dichiarate separatamente; **RINVIATA** = rinvio esplicito registrato; **APERTA** = nessuna
decisione rintracciata (o solo una proposta/preferenza, che **non** è una decisione).

**Campi obbligatori di ogni voce:** ID · titolo · stato · perimetro e residuo aperto · tipo · autorità,
data e fonte originale · *sostituisce/integra* · effetti consentiti · effetti **non** autorizzati.

**Tipi:** decisione tecnica · decisione di prodotto · approvazione consegna · chiusura gate ·
autorizzazione deploy.

<a id="fonte-docs-registro-decisioni-md-regole-di-autorità"></a>

### Regole di autorità

1. Il registro **indicizza** le fonti originali e **non le sostituisce**.
2. Baseline e contratti specialistici restano **normativi**.
3. Una **decisione tecnica** non equivale a **approvazione della consegna**.
4. **Approvazione della consegna**, **chiusura di un gate** e **autorizzazione al deploy** sono eventi **distinti**.
5. Una **proposta**, un'**analisi** o una **prova** non diventano decisioni.
6. **Non** si reinterpretano retroattivamente cronologie o formulazioni: le contraddizioni si indicano, non si risolvono per presunzione.

<a id="fonte-docs-registro-decisioni-md-1-m6--adozione-messaggi-copie-pwa"></a>

### 1. M6 — adozione, messaggi, copie PWA

<a id="fonte-docs-registro-decisioni-md-m6-f1--upgrade-additivo-della-coda-allo-schema-v2-opzione-a"></a>

#### M6-F1 — Upgrade additivo della coda allo schema v2 (opzione A)

- **Stato:** DECISA
- **Perimetro e residuo:** si adotta l'**opzione A** (upgrade additivo controllato della coda IndexedDB esistente allo schema v2 con store `queueLeases`). Il perimetro riguarda la **coda delle scritture offline già abilitate**; la consultazione offline resta un gate distinto. **Residuo aperto:** prova mista vecchia/nuova, compatibilità delle copie PWA, rollback v2-compatibile, collaudi fisici.
- **Tipo:** decisione tecnica (con ricadute di prodotto)
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7679`, «Decisione Diego — M6-F1 = A»)
- **Sostituisce/integra:** integra il piano `M6-ADOZIONE-PIANO R1` (opzione A); **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** preparazione e verifica **nel solo ramo** `integration/vault-shell-v127-security`.
- **Effetti NON autorizzati:** upgrade delle copie PWA installate; modifica di dati reali; deploy; chiusura dei gate M6.

<a id="fonte-docs-registro-decisioni-md-m6-f2--testo-generico-riferito-al-tipo-di-operazione-errori-di-salvataggio-senza-web-locks"></a>

#### M6-F2 — Testo generico riferito al tipo di operazione (errori di salvataggio senza Web Locks)

- **Stato:** DECISA
- **Perimetro e residuo:** per gli errori del salvataggio offline in browser senza Web Locks si usa un testo **generico ma riferito al tipo di operazione** che l'utente stava compiendo (es. creazione/modifica di Account privato o modifica di memorandum), **senza** nomi, valori o segreti del record; il testo deve indicare che **quella operazione non ha un salvataggio confermato** e invitare a riprovare; **non** deve affermare che la modifica sia conservata, persa o sincronizzata finché lo stato non è verificato. La formulazione per ciascun tipo di operazione va preparata **quando** si arriverà all'incarico UI. **Residuo aperto:** la formulazione concreta per i tipi di operazione abilitati non è ancora prodotta.
- **Tipo:** decisione di prodotto (testo all'utente)
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7685`, «Decisione Diego — M6-F2»)
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**; distinta dall'avviso alla vecchia PWA (M6-F3).
- **Effetti consentiti:** vincola la futura formulazione dei messaggi nel perimetro dichiarato.
- **Effetti NON autorizzati:** ampliare i domini offline; promettere conservazione non verificata; modificare l'incarico tecnico attivo (allora M6-A-1, limitato al lettore).

<a id="fonte-docs-registro-decisioni-md-m6-f3--vecchia-pwa-avviso-aggiorna-lapp"></a>

#### M6-F3 — Vecchia PWA: avviso «Aggiorna l'app»

- **Stato:** PARZIALE
- **Perimetro (parte decisa):** per «vecchia PWA» si intende la versione **già installata o ancora aperta** prima dell'aggiornamento della coda; l'utente deve ricevere un avviso **esplicito e operativo** che chieda di **aggiornare** alla nuova versione (non un semplice «la versione è cambiata»), formulato secondo il **meccanismo effettivo di aggiornamento** disponibile (es. aggiornare/riaprire l'app dal browser), **senza** presupporre un download dallo store. Nella stessa fonte è registrato che, **in caso di versione non compatibile**, le **scritture vanno fermate in sicurezza** e i **dati pendenti conservati**.
- **Residuo aperto:** prova della **convivenza delle copie già aperte**; **conservazione della coda** in caso di upgrade bloccato o dispositivo offline; **rollback v2-compatibile**; collaudo delle **PWA installate**; **sequenza di rilascio**; **criterio di blocco** (solo *proposto*, non deciso); **tempi**; **compatibilità reale**; **testo definitivo**.
- **Tipo:** decisione di prodotto (comunicazione all'utente) — non è un'autorizzazione al rilascio
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:8118`, «Decisione Diego M6-F3 — messaggio alla PWA precedente»). Il chiarimento su matrice e prove è in `:7687` ed è **esplicitamente** «non ancora decisione di rilascio»: **un chiarimento non è una decisione**.
- **Sostituisce/integra:** integra M6-F1 e M6-F2; **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** definisce la comunicazione all'utente e il requisito di fermare in sicurezza le scritture con dati pendenti conservati.
- **Effetti NON autorizzati:** distribuire lo schema v2; cancellare operazioni offline pendenti; chiudere M6-F3; considerare approvati tempi, criterio di blocco, compatibilità reale o testo definitivo.

<a id="fonte-docs-registro-decisioni-md-m6-a-8e--approvazione-della-consegna-esterna-al-repository"></a>

#### M6-A-8e — Approvazione della consegna (esterna al repository)

- **Stato:** DECISA (limitatamente all'evento «approvazione consegna»)
- **Perimetro e residuo:** approvazione della **sola consegna M6-A-8e** (casi 6, 6-bis, 6-ter come **evidenza di laboratorio**) sul commit **`3b7b96a6`**. Nel repository la voce resta `DA_VERIFICARE`. **Residuo aperto:** M6 e i gate fisici, PWA e produttivi restano aperti; **M6-F3** resta aperto.
- **Tipo:** approvazione consegna (distinta da chiusura gate e da autorizzazione deploy)
- **Autorità, data, fonte:** **Sol** — comunicazione esterna nella conversazione **«DeepSeek Harness — sessione Codici & Password»**; l'attribuzione a Sol e la data **23/09/2026** provengono dall'incarico D02 ricevuto nella **stessa** conversazione, **non** dal messaggio di approvazione. **Citazione:** «APPROVATO M6-A-8e — commit 3b7b96a6. La chiusura riguarda esclusivamente questa consegna verificata e non chiude M6 né i gate fisici, PWA o produttivi.» **ID messaggio non esposto dalla UI**; **data del messaggio non recuperabile**. Prova nel repository: [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:8757`, rapporto `DA_VERIFICARE`); limiti dichiarati in [M6_SINCRONIZZAZIONE_OFFLINE.md](../regole/OFFLINE.md#fonte-docs-m6-sincronizzazione-offline-md-l1) (§M6-A-8e).
- **Sostituisce/integra:** **integra** il rapporto `DA_VERIFICARE` di M6-A-8e; **non sostituisce** le revisioni Codex precedenti né le fonti di M6.
- **Effetti consentiti:** considerare approvata **quella** consegna su **quel** commit, nei limiti in cui è dimostrata dalle prove del repository.
- **Effetti NON autorizzati:** chiusura di M6 o di M6-1/M6-2/M6-3/M6-F3; chiusura dei gate fisici, PWA o produttivi; deploy, push, merge o rilascio; estensione dell'approvazione ad altri commit.

<a id="fonte-docs-registro-decisioni-md-altre-approvazioni-esterne-della-serie-m6-a-8-chat-harness"></a>

#### Altre approvazioni esterne della serie M6-A-8 (chat Harness)

Le consegne seguenti hanno una **comunicazione esterna esplicita** nella chat Harness, con gli **stessi
limiti** di M6-A-8e: nel repository restano registrate come `DA_VERIFICARE` e l'approvazione copre
**solo** la consegna e **solo** il commit indicato.

<a id="fonte-docs-registro-decisioni-md-m6-a-8b--approvazione-della-consegna"></a>

##### M6-A-8b — Approvazione della consegna

- **Stato:** DECISA (limitatamente all'evento «approvazione consegna»)
- **Perimetro e residuo:** sola consegna M6-A-8b (coordinatore lease isolato) sul commit **`583c3d7c`**, con le relative prove di laboratorio. Nel repository resta `DA_VERIFICARE`. **Residuo aperto:** M6, i gate fisici/PWA/produttivi e M6-F3 restano aperti.
- **Tipo:** approvazione consegna
- **Autorità, data, fonte:** comunicazione esterna nella conversazione **«DeepSeek Harness — sessione Codici & Password»**; **autore non nominato nel messaggio**, che attribuisce la revisione a **Codex**. **Citazione:** «APPROVATO M6-A-8b — commit 583c3d7c, albero pulito, 167/167 test superati anche nella revisione Codex.» **ID messaggio non esposto dalla UI**; **data non recuperabile dal messaggio**: la data 2026-09-22 è quella **Git del commit** `583c3d7c`, non dell'approvazione. Prova nel repository: [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:8749`, rapporto `DA_VERIFICARE`).
- **Sostituisce/integra:** **integra** il rapporto `DA_VERIFICARE` di M6-A-8b; **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** considerare approvata quella consegna su quel commit, nei limiti delle prove del repository.
- **Effetti NON autorizzati:** chiusura di M6 o dei gate; deploy, push, merge o rilascio; estensione ad altri commit o deduzione di approvazioni da incarichi successivi.

<a id="fonte-docs-registro-decisioni-md-m6-a-8c-r1--approvazione-della-consegna"></a>

##### M6-A-8c R1 — Approvazione della consegna

- **Stato:** DECISA (limitatamente all'evento «approvazione consegna»)
- **Perimetro e residuo:** sola consegna M6-A-8c R1 (fencing atomico delle scritture della coda) sul commit **`d0a1d71c`**, con le relative prove Node e di banco. Nel repository resta `DA_VERIFICARE`. **Residuo aperto:** M6, i gate fisici/PWA/produttivi e M6-F3 restano aperti; il rinnovo durante task lunghi resta non implementato.
- **Tipo:** approvazione consegna
- **Autorità, data, fonte:** comunicazione esterna nella conversazione **«DeepSeek Harness — sessione Codici & Password»**; **autore non nominato nel messaggio**, che attribuisce la revisione a **Codex** («Revisione Codex completata»). **Citazione:** «APPROVATO M6-A-8c R1 — commit d0a1d71c.» **ID messaggio non esposto dalla UI**; **data non recuperabile dal messaggio**: la data 2026-09-23 è quella **Git del commit** `d0a1d71c`, non dell'approvazione. Prova nel repository: [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:8753`, rapporto `DA_VERIFICARE`).
- **Sostituisce/integra:** **integra** il rapporto `DA_VERIFICARE` di M6-A-8c R1; **non** estende l'approvazione alla consegna **M6-A-8c base** (`a200a334`).
- **Effetti consentiti:** considerare approvata quella consegna su quel commit, nei limiti delle prove del repository.
- **Effetti NON autorizzati:** chiusura di M6 o dei gate; deploy, push, merge o rilascio; estensione ad altri commit; considerare approvata la consegna base 8c.

<a id="fonte-docs-registro-decisioni-md-m6-a-8d--approvazione-della-consegna"></a>

##### M6-A-8d — Approvazione della consegna

- **Stato:** DECISA (limitatamente all'evento «approvazione consegna»)
- **Perimetro e residuo:** sola consegna M6-A-8d (prova pagina + Worker sul pilota lease, caso 5 della matrice) sul commit **`6ab70723`**, con le relative prove Node e di banco. Nel repository resta `DA_VERIFICARE`. **Residuo aperto:** M6, i gate fisici/PWA/produttivi e M6-F3 restano aperti.
- **Tipo:** approvazione consegna
- **Autorità, data, fonte:** comunicazione esterna nella conversazione **«DeepSeek Harness — sessione Codici & Password»**; **autore non nominato nel messaggio**, che attribuisce la revisione a **Codex** («Revisione Codex: …»). **Citazione:** «APPROVATO M6-A-8d — commit 6ab70723. … Il caso 5 della matrice M6 è coperto come evidenza di laboratorio.» **ID messaggio non esposto dalla UI**; **data non recuperabile dal messaggio**: la data 2026-09-23 è quella **Git del commit** `6ab70723`, non dell'approvazione. Prova nel repository: [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:8755`, rapporto `DA_VERIFICARE`).
- **Sostituisce/integra:** **integra** il rapporto `DA_VERIFICARE` di M6-A-8d; **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** considerare approvata quella consegna su quel commit, nei limiti delle prove del repository.
- **Effetti NON autorizzati:** chiusura di M6 o dei gate; deploy, push, merge o rilascio; estensione ad altri commit o deduzione di approvazioni da incarichi successivi.

<a id="fonte-docs-registro-decisioni-md-m6-a-8c-base--approvazione-non-rintracciata-correzione-richiesta"></a>

#### M6-A-8c (base) — Approvazione **non rintracciata**; correzione richiesta

- **Stato:** APERTA
- **Perimetro e residuo:** il commit **`a200a334`** (M6-A-8c base) risulta nel repository **solo** con un rapporto `DA_VERIFICARE` ([DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) `:8751`); la comunicazione esterna in chat Harness relativa a quella consegna è una **richiesta di correzione** («M6-A-8c non ancora approvato»), seguita dalla correzione **R1** approvata. **Non** esiste una comunicazione esplicita di approvazione della consegna base. **Residuo aperto:** la consegna base resta **non approvata**.
- **Tipo:** approvazione consegna (non accordata)
- **Autorità, data, fonte:** comunicazione esterna nella conversazione **«DeepSeek Harness — sessione Codici & Password»**; **autore non nominato nel messaggio**. **Citazione:** «CORREZIONE RICHIESTA — M6-A-8c non ancora approvato. … resta un difetto di sicurezza nel contratto richiesto». **ID messaggio non esposto dalla UI**; **data non recuperabile dal messaggio**: la data 2026-09-23 è quella **Git del commit** `a200a334`, non dell'approvazione; prova nel repository `:8751`.
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**: le fonti originali restano invariate e la correzione R1 è un evento distinto, registrato sopra.
- **Effetti consentiti:** trattare la consegna base come **non approvata** e la sua correzione R1 come l'evento approvato.
- **Effetti NON autorizzati:** dichiarare approvata la consegna base; estendere a essa l'approvazione di R1; dedurre approvazioni da incarichi successivi.

**Nota di completezza.** Nel primo contenuto di questo registro **nessun'altra** consegna della serie M6-A-8 resta priva di una comunicazione esplicita: 8b, 8c R1, 8d ed 8e hanno approvazioni esterne registrate sopra, mentre 8c **base** è registrata come non approvata. Restano **fuori** da questo primo contenuto le altre consegne e i gate, che non vengono dedotti da qui.

<a id="fonte-docs-registro-decisioni-md-2-m7--retention-e-audit-decisioni-del-21092026-e-successive-del-22092026"></a>

### 2. M7 — retention e audit (decisioni del 21/09/2026 e successive del 22/09/2026)

<a id="fonte-docs-registro-decisioni-md-m7-d1-a--account-archiviati-conservazione-senza-scadenza-automatica"></a>

#### M7-D1-a — Account archiviati: conservazione senza scadenza automatica

- **Stato:** DECISA
- **Perimetro e residuo:** gli **Account archiviati** sono conservati **senza scadenza automatica**, finché l'utente non sceglie di eliminarli; la **cancellazione definitiva manuale** resta disponibile con **conferma esplicita**. **Residuo aperto:** le altre famiglie e le scelte M7 non coperte da questa voce restano come indicato in M7-D3 e nelle contraddizioni sotto.
- **Tipo:** decisione di prodotto
- **Autorità, data, fonte:** Diego — **21/09/2026** — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:1212`, «gli Account archiviati sono conservati senza scadenza automatica…»); opzione **D1-a** in [M7_RETENTION_CENSIMENTO.md](../evidenze/INVENTARI.md#fonte-docs-m7-retention-censimento-md-l1) (`:501`).
- **Sostituisce/integra:** risponde a **D1** del censimento (opzione D1-a). **Come politica è integrata e superata** dalla decisione successiva del **22/09/2026** (M7-D1: cancellazione automatica dopo due anni con avviso dieci giorni prima): la decisione storica del 21/09 **resta registrata** e non viene cancellata. Integra [M7_RETENTION_CENSIMENTO.md](../evidenze/INVENTARI.md#fonte-docs-m7-retention-censimento-md-l1) (`:501`); **nessuna fonte originale modificata**.
- **Effetti consentiti:** definire il comportamento di prodotto per gli Account archiviati.
- **Effetti NON autorizzati:** cancellare dati reali; eseguire deploy; cambiare altre politiche M7; dedurre approvazioni ulteriori.

<a id="fonte-docs-registro-decisioni-md-m7-d2-account--comportamento-ordinario-confermato"></a>

#### M7-D2 (Account) — Comportamento ordinario confermato

- **Stato:** DECISA (limitatamente agli Account)
- **Perimetro e residuo:** la decisione **conferma il comportamento ordinario di D2 per gli Account**, **senza** introdurre eccezioni, obblighi legali o una nuova durata. **Residuo aperto:** D2 per le altre famiglie di dati resta fuori da questa conferma.
- **Tipo:** decisione di prodotto
- **Autorità, data, fonte:** Diego — **21/09/2026** — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:1212`).
- **Sostituisce/integra:** **integrata** dalla decisione successiva del **22/09/2026** (M7-D2: cancellazione definitiva **immediata** con conferma esplicita, senza attendere i due anni); la conferma storica del 21/09 resta registrata. **Nessuna fonte originale modificata**.
- **Effetti consentiti:** assumere il comportamento ordinario per gli Account.
- **Effetti NON autorizzati:** estendere la conferma ad altre famiglie; chiudere D2 in blocco.

<a id="fonte-docs-registro-decisioni-md-m7-d3--registro-tecnico-auditevents-a-24-mesi-solo-ramo-non-distribuito"></a>

#### M7-D3 — Registro tecnico `auditEvents` a 24 mesi (solo ramo, non distribuito)

- **Stato:** PARZIALE
- **Perimetro (parte decisa):** gli eventi tecnici di `users/{uid}/auditEvents` sono conservati **24 mesi di calendario** dal timestamp autorevole e poi cancellati da un processo **controllato dal backend**. La **rimozione della scrittura client** sul registro è **decisa e implementata nel ramo** (marcatori opachi nei tre scrittori client e Rules del ramo che la escludono): **non** è un residuo da decidere. Il **job pianificato** di retention è **montato nel ramo e inerte in produzione** (`functions/`), con cursori di servizio e cancellazione confermata sulla versione letta.
- **Residuo aperto (parte non decisa):** permanenza delle **altre famiglie** (ricevute di idempotenza, backup, log di piattaforma, Account archiviati restano **fuori** dalla finestra audit; per gli Account vale la successiva politica D1 richiesta, non ancora attiva); **bonifica dei record storici senza `at`**; **vista utente** del registro; **distribuzione** di job e Rules del ramo (in produzione non esiste ancora alcun job attivo e le Rules distribuite restano le precedenti).
- **Tipo:** decisione di prodotto (durata) + decisione tecnica (attuazione nel ramo)
- **Autorità, data, fonte:** Diego — **21/09/2026** — [M7_CRONOLOGIA_CESTINO_AUDIT.md](../regole/CANCELLAZIONE.md#fonte-docs-m7-cronologia-cestino-audit-md-l1) §«Retention del registro tecnico — decisione 21/09/2026 e progetto candidato» (`:114`–`:118`, `:125`) e §«Cancellazione a lotti»; registrazione in [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:1230`–`:1232`). Montaggio nel ramo **M7-AUDIT-6**: commit `65e0e776`, con correzioni `300e138b` e `2cfb19d1` ([DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) `:5178`, `:5239`, `:5297`).
- **Sostituisce/integra:** **sostituisce** la precedente indicazione di **12 mesi** per il solo registro ([DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) `:1253`: «la precedente indicazione di 12 mesi è superata»); integra D3 del censimento. Le successive decisioni M7 del 22/09/2026 **non** riducono né estendono questa finestra ad altre famiglie.
- **Effetti consentiti:** considerare decisa la durata di 24 mesi per il solo registro e ammettere, **nel ramo**, il job di retention non distribuito e la rimozione della scrittura client.
- **Effetti NON autorizzati:** estendere i 24 mesi ad altre famiglie; attivare o distribuire il job o le Rules; cancellare dati reali; deploy.

<a id="fonte-docs-registro-decisioni-md-m7-d8--obblighi-legali-di-conservazione-rinvio"></a>

#### M7-D8 — Obblighi legali di conservazione: rinvio

- **Stato:** RINVIATA
- **Perimetro e residuo:** il rinvio è **dichiarato** trattando gli obblighi legali come **dipendenza**, **senza** deroghe inventate. **Residuo aperto:** la verifica degli eventuali obblighi specifici resta da fare (dipendenza esterna).
- **Tipo:** decisione di prodotto (rinvio)
- **Autorità, data, fonte:** registro di coordinamento / censimento — 21/09/2026 — [CENSIMENTO_GATE_M6_M10.md](../storico/REGISTRO.md#fonte-docs-censimento-gate-m6-m10-md-l1) (gate **M7-1**, `:33`, «rinvio dichiarato di D8»); [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:1285`).
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** mantenere aperta la verifica senza assumere deroghe.
- **Effetti NON autorizzati:** dedurre una durata o una deroga; chiudere D8.

<a id="fonte-docs-registro-decisioni-md-decisioni-successive--22092026-in-successione-sulle-voci-d1-d2-e-d4d14"></a>

#### Decisioni successive — 22/09/2026 (in successione sulle voci D1, D2 e D4/D14)

Queste decisioni **integrano o superano come politica** le voci del 21/09/2026, che restano registrate
sopra. Per ciascuna si distingue **decisione richiesta**, **implementazione attuale nel ramo** e
**distribuzione/autorizzazione al rilascio**.

<a id="fonte-docs-registro-decisioni-md-m7-d1-22092026--cancellazione-automatica-degli-account-archiviati-dopo-due-anni"></a>

##### M7-D1 (22/09/2026) — Cancellazione automatica degli Account archiviati dopo due anni

- **Stato:** DECISA (politica di prodotto richiesta)
- **Perimetro (decisione):** gli Account nell'Archivio devono essere cancellati **automaticamente dopo due anni** dall'archiviazione; **dieci giorni prima** l'utente deve ricevere un **avviso interno all'app** e, se il dispositivo ha il canale Push attivo/consentito, anche una **notifica esterna** sul telefono. Il testo deve avvertire della cancellazione imminente e consentire di verificare gli elementi interessati. La decisione **non** estende automaticamente a due anni la durata di backup, ricevute, cache, allegati o altre famiglie di dati.
- **Implementazione attuale nel ramo:** **non attiva**. Il codice attuale dell'Archivio dichiara conservazione fino a **cancellazione manuale**; esistono Push e notifiche interne per le Scadenze, **non** una prova o implementazione equivalente per la scadenza dell'Archivio. Prima di qualsiasi purge automatico la fonte elenca come necessari: protocollo sicuro, idempotenza, prova su copia non produttiva, gestione delle notifiche non recapitate, decisione **D8** sugli eventuali obblighi di conservazione e precisazione del caso «Account ripristinato e poi riarchiviato».
- **Distribuzione / autorizzazione al rilascio:** **nessuna**. La fonte dichiara «Nessun incarico di implementazione o rilascio assegnato».
- **Tipo:** decisione di prodotto
- **Autorità, data, fonte:** Diego — **22/09/2026** — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7886`, «Decisione Diego — M7-D1 (22/09/2026), politica richiesta»)
- **Sostituisce/integra:** **integra e supera come politica** la decisione del 21/09/2026 (M7-D1-a, conservazione senza scadenza automatica), che resta registrata. **Nessuna fonte originale modificata**.
- **Effetti consentiti:** considerare **richiesta** la politica dei due anni con avviso a dieci giorni; preparare protocollo e prove **nel ramo**.
- **Effetti NON autorizzati:** attivare un purge automatico oggi; cancellare dati reali; inviare notifiche reali; considerare implementata o distribuita la politica; estendere i due anni ad altre famiglie; deploy.

<a id="fonte-docs-registro-decisioni-md-m7-d2-22092026--cancellazione-definitiva-immediata-di-un-account-archiviato"></a>

##### M7-D2 (22/09/2026) — Cancellazione definitiva immediata di un Account archiviato

- **Stato:** PARZIALE
- **Perimetro (parte decisa):** l'utente può cancellare definitivamente **subito** un Account già archiviato, **senza attendere i due anni**, con una **conferma esplicita** del tipo «Sei sicuro di voler cancellare definitivamente?».
- **Implementazione attuale nel ramo:** il comportamento attuale prevede **già** un percorso di purge manuale con conferma.
- **Distribuzione / autorizzazione al rilascio:** **nessuna**; la fonte dichiara che non è assegnato alcun nuovo incarico mentre M6-A-2 era in correzione.
- **Residuo aperto (parte non decisa):** **testo finale** e **verifiche**, da rivedere insieme a D6/D8.
- **Tipo:** decisione di prodotto
- **Autorità, data, fonte:** Diego — **22/09/2026** — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7888`, «Decisione Diego — M7-D2 (22/09/2026)»)
- **Sostituisce/integra:** **integra** la conferma del comportamento ordinario del 21/09/2026 (M7-D2 Account), che resta registrata. **Nessuna fonte originale modificata**.
- **Effetti consentiti:** considerare decisa la cancellazione immediata su richiesta esplicita dell'utente.
- **Effetti NON autorizzati:** cancellare dati reali; considerare approvati testo definitivo e verifiche; deploy.

<a id="fonte-docs-registro-decisioni-md-m7-d4--orientamento-d14-22092026--effetto-a-cascata-della-cancellazione"></a>

##### M7-D4 / orientamento D14 (22/09/2026) — Effetto a cascata della cancellazione

- **Stato:** PARZIALE
- **Perimetro (parte decisa):** quando il proprietario elimina definitivamente un Account — **manualmente (D2)** o **alla scadenza automatica richiesta (D1)** — la cancellazione deve avere **effetto a cascata su tutti i dati dell'app collegati a quell'Account**: documento principale, allegati e byte correlati, widget/riferimenti, dati e link condivisi, inviti e copie condivise ancora gestite dal servizio. I destinatari **non** devono continuare a vedere o raggiungere nell'app il contenuto eliminato tramite il collegamento ricevuto; accessi e indici correlati vanno revocati/ripuliti in modo coerente.
- **Implementazione attuale nel ramo:** **non descritta** da questa decisione: la fonte dichiara che «oggi il purge lascia alcune copie/inviti e oggetti Storage non elencati», quindi la decisione **non** descrive il comportamento attuale. Un **limite tecnico** è dichiarato: la revoca e la pulizia **sul servizio** possono essere richieste e verificate, ma una PWA del destinatario già offline, un file esportato, uno screenshot o una copia creata autonomamente **non** sono cancellabili istantaneamente dal dispositivo del destinatario.
- **Distribuzione / autorizzazione al rilascio:** **nessuna**; «nessuna cancellazione, commit, push, merge o deploy autorizzati da questa nota».
- **Residuo aperto (parte non decisa):** **D5, D10, D11** e il **confine** fra una Scadenza condivisa derivata dall'Account e una Scadenza indipendente; **testi al destinatario**, **prova di non accessibilità** e **gestione degli errori parziali**.
- **Tipo:** decisione di prodotto (copie derivate e controllate dall'app)
- **Autorità, data, fonte:** Diego — **22/09/2026** — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7959`, «Decisione Diego — M7-D4 / orientamento D14 (22/09/2026)»; limite tecnico a `:7961`)
- **Sostituisce/integra:** orienta **D14-Q1/Q2**; **non** sostituisce le voci D5/D10/D11, che restano da precisare. **Nessuna fonte originale modificata**.
- **Effetti consentiti:** considerare decisa la **politica di prodotto** per le copie derivate e controllate dall'app.
- **Effetti NON autorizzati:** cancellare record autonomi di altri utenti, backup o file già esportati; presentare la cascata come cancellazione retroattiva garantita di copie esterne; cancellare dati reali; deploy.

<a id="fonte-docs-registro-decisioni-md-contraddizioni-sulle-voci-m7-indicate-non-risolte"></a>

#### Formulazioni M7 precedenti conservate nelle evidenze

- [CENSIMENTO_GATE_M6_M10.md](../storico/REGISTRO.md#fonte-docs-censimento-gate-m6-m10-md-l1) (gate **M7-1**, `:33`) elenca ancora fra le decisioni **da approvare** «D1, D2, D4, D5, D6, D7, D9, D10–D16», mentre il registro del **21/09/2026** documenta D1-a e il comportamento ordinario D2 per gli Account e quello del **22/09/2026** documenta D1 (due anni), D2 (immediata) e D4/D14 (cascata): il censimento è **precedente** e non le riporta.
- [M10_REVISIONE_PRIVACY_PRELIMINARE.md](../evidenze/AUDIT.md#fonte-docs-m10-revisione-privacy-preliminare-md-l1) (§8, punto 1, 22/09/2026) elenca fra le **ancora aperte** «D1, D2, D4, D5, D6, D7, D9, D10–D16»: formulazione **più vecchia** delle decisioni del 22/09/2026.
- [M7_RETENTION_CENSIMENTO.md](../evidenze/INVENTARI.md#fonte-docs-m7-retention-censimento-md-l1) (`:208`, §8) tiene **D5** e le parti residue di **D1** (cestino e ricevute) aperti, coerentemente con il perimetro delle decisioni.
- Le formulazioni precedenti restano come **evidenze datate** nello storico e negli inventari. Le raccolte delle domande e la sezione iniziale del contratto CANCELLAZIONE ora distinguono la successione registrata e i residui: questa riconciliazione documentale non inventa approvazioni o attuazioni.

<a id="fonte-docs-registro-decisioni-md-3-m8--backup-e-recupero"></a>

### 3. M8 — backup e recupero

<a id="fonte-docs-registro-decisioni-md-m8--ripristino-interrotto-sospensione-richiesta-dal-proprietario"></a>

#### M8 — Ripristino interrotto: sospensione richiesta dal proprietario

- **Stato:** APERTA (nessuna decisione registrata; **rinvio operativo** richiesto)
- **Perimetro e residuo:** sulla domanda M8-Q2 il proprietario ha espresso una **preferenza preliminare** (annullare l'intera procedura se il record non viene salvato e rimuovere l'allegato senza riferimento) e ha chiesto di **sospendere M8** perché la sequenza dei casi Q1/Q2 non era chiara. La fonte dichiara **esplicitamente** che la preferenza **non** va registrata come decisione M8 e che **non** va assegnato lavoro di ripristino. **Residuo aperto:** tutte le scelte M8 restano aperte.
- **Tipo:** decisione di prodotto (non assunta) — sospensione operativa
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7890`, «M7-D3 e M8 — chiarimento, non nuove decisioni»)
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** considerare M8 **sospeso in attesa di chiarimento**; le domande restano nei documenti M8.
- **Effetti NON autorizzati:** trattare la preferenza su Q2 come decisione; avviare lavoro di ripristino; chiudere le voci M8.

<a id="fonte-docs-registro-decisioni-md-4-fuori-dal-primo-contenuto-di-questo-registro"></a>

### 4. Perimetro e voci ancora da indicizzare

**M6-C1/C2 e il residuo C3 sono ora indicizzati in apertura.** Restano fuori da questa raccolta le altre decisioni M7 non comprese nelle voci sopra e le voci M8/M9/M10 ulteriori: prima di assegnare lavoro pertinente occorre cercarne la fonte e indicizzarle, senza presumere nuove decisioni.

<a id="fonte-docs-registro-decisioni-md-5-limiti-di-questo-registro"></a>

### 5. Limiti di questo registro

- È un **indice**, non una fonte: ogni voce va letta nella fonte originale collegata.
- **Nessuna decisione è inventata** e **nessun residuo aperto è chiuso** implicitamente: dove la fonte non basta, lo stato è **APERTA**.
- Le date riportate sono quelle delle fonti; questo registro **non** rende attuali decisioni o prove storiche.
- **Riferimenti puntuali.** I richiami originali `:N` si riferiscono ai vecchi file alla base `2900ccc0`, ricostruibile tramite `scripts/docs-source-map.json`: dove possibile sono accompagnati da **sezione** e **commit**, che restano i riferimenti stabili. Un riferimento puntuale non è una fonte: vale il documento collegato.
- **Produzione e ambiente distribuito non sono verificati** da questo file: per lo stato corrente si veda [STATO_CORRENTE_M0_M10.md](STATO.md#fonte-docs-stato-corrente-m0-m10-md-l1), anch'esso **non normativo**.
- **Perimetro di D02.** Unico file creato: questo registro (commit D02 `e7b97080`); le correzioni **D02 R1** (`4e0ee70d`) e **D02 R2** (correzione finale, commit locale successivo) toccano **solo** questo registro e [STATO_CORRENTE_M0_M10.md](STATO.md#fonte-docs-stato-corrente-m0-m10-md-l1), **senza riscrivere** i commit precedenti. Nessuna modifica ad altri file, codice, test, versione, Rules/Functions, dati reali, PWA o produzione; nessun push, merge o deploy.
