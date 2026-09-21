# M8-bis — Domande per Diego: nuovo tentativo in una nuova sessione di ripristino

> **Stato:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica «retry fra
> esecuzioni diverse» (sotto-gate di `docs/M8_BACKUP_RECUPERO.md:59`).
> **Commit delle prove tecniche:** `tests/restore-retry-new-session.emulator.test.mjs`,
> `scripts/run-restore-retry-emulators.mjs`, aggiornamento di `docs/M8_BACKUP_RECUPERO.md`.
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce
> retry automatici, staging, compensazione, migrazione o nuove politiche.
> **Non duplica** le domande di `docs/M8_DOMANDE_RIPRISTINO_INTERROTTO.md` (Q1-Q5), che restano
> aperte: quelle riguardano il buco fra record e byte e il piano bloccato, queste riguardano che
> cosa deve accadere quando l'utente **riapre lo stesso backup** dopo un'interruzione.

## Che cosa è stato osservato

Con il percorso reale su emulatori e dati sintetici: dopo un ripristino interrotto (record
applicati, primo upload fallito, piano bloccato), una **nuova** sessione di ripristino dello stesso
file classifica i record già scritti — **compreso il metadato dell'allegato i cui byte mancano** —
come «invariato»; l'esecuzione è rifiutata con `BACKUP_RESTORE_NOTHING_SELECTED` (senza selezione e
anche selezionando gli «invariato») e **non** tenta alcun caricamento, quindi il riferimento resta
senza byte. Se invece il metadato manca, la nuova sessione lo ripristina **con** i byte; se cambia
solo un altro record, la nuova sessione riesce ma i byte mancanti **non** vengono ricaricati.
**Nessuna correzione è stata introdotta.**

## Domande

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

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: formato, import, export, Rules e
runtime sono **invariati**; nessun dato o backup reale è stato letto o creato; il codice di
produzione è stato mutato **solo** per il controllo di discriminazione e poi ripristinato con hash
identico. Le prove tecniche sono in un commit separato; questo documento non le ripete e non le
sostituisce.
