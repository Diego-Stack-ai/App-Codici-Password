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
