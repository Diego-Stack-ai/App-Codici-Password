# M7 — Cronologia, cestino e audit

> **Stato:** funzioni implementate e collaudo storico registrato; retention complessiva non approvata.
> **Autorità:** contratto specialistico e registro prove; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** cronologia, cestino e purge.
> **Dipendenze:** [Guida progetto](./GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

## Contratto

- la cancellazione ordinaria sposta il record in un cestino cifrato;
- la conservazione senza scadenza automatica descritta dal primo laboratorio non è approvata come politica di produzione;
- prima del go-live deve essere definita una retention esplicita, con cancellazione, backup e possibili obblighi legali;
- il cestino conserva ID, proprietario, revisione e data di archiviazione; il contenuto resta ciphertext;
- il ripristino fallisce se l'ID è occupato e crea una nuova revisione;
- il purge è backend-only, esclusivamente manuale e richiede sempre conferma forte;
- revoca e ripristino non riattivano grant precedenti;
- la cronologia è limitata agli eventi necessari, non a snapshot illimitati;
- l'audit usa un'allowlist e non registra password, chiavi, token, ciphertext o testo libero.

Il laboratorio `experiments/history-recovery` dimostra una retention tecnica di prova, ripristino senza sovrascrittura, revisione, redazione dei segreti e limite della cronologia. Non modifica la produzione e non approva una conservazione indefinita.

## Gate

- [x] conservazione senza scadenza automatica e condizioni di purge manuale definite;
- [x] ripristino senza sovrascrittura silenziosa;
- [x] audit con allowlist e senza segreti;
- [x] cronologia limitata;
- [x] Archivio Account riutilizzato come UI cestino; i nuovi elementi ricevono data e revisione, senza scadenza automatica; anche gli eventuali record con il vecchio `purgeAfter` richiedono la cancellazione manuale;
- [x] Rules verificate e callable atomica/idempotente distribuita;
- [x] conferma forte della UI collegata alla callable backend `purgeArchivedAccount`, con controllo archivio/revisione, ripresa idempotente, rimozione degli allegati confinata allo UID e scollegamento delle email del Profilo;
- [x] archiviazione, ripristino, permanenza senza scadenza automatica e cancellazione definitiva manuale verificati fisicamente il 09/09/2026 con account di prova dopo la distribuzione del nuovo contratto.

Il 09/09/2026 è stato accettato il collaudo funzionale descritto sopra. Non costituisce approvazione della retention complessiva né certificazione rispetto alla baseline adottata l’11/09.

## Decisione di retention aperta

Per chiudere il requisito di retention della baseline occorre stabilire, senza annullare il collaudo storico delle funzioni già implementate:

- durata ordinaria del cestino;
- eliminazione immediata richiesta dall’utente e relative eccezioni legali;
- rapporto tra cestino, cronologia, allegati e backup;
- purge verificabile e idempotente;
- informazione mostrata all’utente;
- prova che il dato non resti raggiungibile nei percorsi applicativi.

La cifratura riduce l’esposizione ma non giustifica la conservazione illimitata.


## Riesame dopo evoluzione Profili — 13/09/2026

Base `141259d9`: la pulizia finale di `purgeArchivedAccount` considerava soltanto `contactEmails` privato e confrontava il solo ID. La stessa stringa ID in Account privato e aziendale non identifica lo stesso record: questa collisione può scollegare un contatto estraneo. Telefoni, documenti, utenze e riferimenti nelle aziende non erano inclusi. Il nuovo blocco candidato deve distinguere contesto/azienda e conservare dati del contatto, note e valori cifrati.

Restano distinti e aperti:

- `accountWidgets` e `sharedVaultLinks` sono collezioni sorelle del documento Account, quindi la cancellazione ricorsiva dell'Account non li include. La pulizia deve eliminare soltanto il collegamento dell'Account; il valore comune usato altrove va conservato.
- Ripristino da Archivio e preparazione del purge non condividono un protocollo transazionale che impedisca il ripristino fra verifica iniziale e cancellazione. Il solo aggiornamento della pulizia finale non chiude questa race.
- Ripristino e grant legacy richiedono una prova specifica di mancata riattivazione delle autorizzazioni precedenti.
- Storage, cancellazione ricorsiva e transazione finale sono passaggi distinti: l'atomicità globale e la ripresa completa non sono certificate.

L'audit finale attuale usa una allowlist di campi tecnici, senza segreti. Nessuna decisione di retention, operazione su dati reali o pubblicazione deriva da questo riesame.


### Pulizia candidata dei collegamenti dopo purge — 13/09/2026

Il pianificatore `planProfileReferenceCleanup` distingue `{context, companyId, accountId}` e aggiorna solo i campi che contengono un riferimento esatto. Copre i campi noti dei Profili privati e aziendali, mantenendo il resto del contatto. La transazione finale legge Profilo e tutte le aziende prima delle scritture; un retry rilegge i dati correnti. Il completamento avviene insieme alle patch e all'audit finale. Una precedente operazione `processing` senza Account riprende la pulizia; `purged` conserva il comportamento di retry esistente. Questo non certifica la provenienza storica delle ricevute `archiveOperations`, distinta dal nuovo registro M6.

Limiti: scansione completa delle aziende, crescita dei costi e della contesa; massimo conservativo di 450 documenti modificati più ricevuta/audit. Un piano troppo ampio o malformato interrompe la transazione finale, lasciando `processing` e nessuna pulizia parziale; l'Account può però essere già stato eliminato dal passaggio precedente. Non è un rollback né una soluzione alla race purge/ripristino. Nessuna migrazione di alias o intervento sui dati reali.

Compatibilità M6: il vecchio purge scriveva `linkedAccountId: null`. Il guard dei riferimenti accetta ora questo marker di collegamento assente, senza modificarlo. Un ID reale con `linkedAccountCompanyId: null` continua a essere trattato come collegamento privato e impedisce il writer ridotto. Il nuovo unlink usa stringhe vuote per entrambi i campi, come la UI corrente.


### Proprietario e sessione dell'Archivio — candidata 13/09/2026

Il purge richiede `expectedOwnerUid`, confrontato con Auth prima della validazione del comando e di qualunque accesso a Firestore o Storage. Questo impedisce che un token scelto dall'SDK dopo il cambio utente esegua il comando nel Vault successivo. I client precedenti senza proprietario atteso sono rifiutati: il rilascio richiede aggiornamento coordinato e rollback che mantenga il controllo.

Il lavoro sul ciclo di vita UI/servizio accompagna il controllo server: acquisire Account e proprietario prima dei dialoghi, annullare le azioni ancora in attesa dopo blocco/cambio sessione, fermare lo svuotamento prima del record successivo e distinguere Account con ID uguali in contesti diversi. Una richiesta già inviata può comunque completarsi. Il vincolo proprietario non risolve le ricevute `archiveOperations` storicamente scrivibili dal client né la race globale purge/ripristino.


### Ricevute protette del purge — candidata 13/09/2026

Il registro di avanzamento si sposta in `mutationResults/{uid}/operations/{operationId}`, storicamente negato alle scritture client. Il binding server comprende proprietario, dominio, Account/contesto/azienda, revisione, conferma e hash dell'intero comando normalizzato. Conferma obbligatoria anche per riprese e duplicati. Le vecchie ricevute `archiveOperations`, da sole, provocano un rifiuto esplicito; non sono promosse. Un esito protetto valido prevale sul legacy, mentre un esito protetto malformato non autorizza fallback.

La transazione iniziale accetta soltanto ricevute verificate: `processing` consente ripresa del comando identico, mantenendo i controlli archivio/revisione se l'Account esiste; `purged` restituisce solo stato e indicatore duplicato. La transazione finale rilegge e verifica il binding prima delle patch dei Profili, della ricevuta finale e dell'audit. Il timestamp iniziale viene conservato nei retry.

Questo blocco corregge la provenienza degli esiti, non il protocollo globale: una richiesta già partita, la race purge/ripristino e i widget/grant residui restano problemi separati. La UI genera ancora un nuovo identificatore ad ogni operazione: ripresa backend con lo stesso ID collaudata, recupero UI degli esiti incerti non ancora implementato. Nessuna migrazione delle ricevute pregresse o cancellazione reale.


### Ripresa dell'eliminazione nella stessa sessione — candidata 13/09/2026

Dopo la conferma iniziale, il servizio prepara un piano opaco con comandi e identificativi immutabili. Se la risposta del purge non arriva, la UI propone «Verifica e riprendi»: solo quella scelta riutilizza il comando incerto. Nello svuotamento vengono saltati gli Account già confermati. Una sola operazione per volta; filtro e altre mutazioni non partono durante l'eliminazione. Rifiuti definitivi bloccano il piano; interrompere mantiene visibili gli elementi non confermati e segnala l'eventuale eliminazione parziale.

Blocco Vault, logout e cambio montaggio eliminano il piano; i vecchi callback non possono ripartire. Le API precedenti del servizio restano utilizzabili senza retry automatico. Il recupero UI copre adesso la stessa sessione aperta, non un refresh o un nuovo accesso. Nessun journal durevole e nessuna soluzione implicita alla concorrenza globale purge/ripristino.
