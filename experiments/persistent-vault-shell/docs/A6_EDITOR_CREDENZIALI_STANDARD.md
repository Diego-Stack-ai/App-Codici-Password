# A6 — editor credenziali standard Account

Stato: candidato di laboratorio, montato soltanto nella shell persistente. Nessuna Rule, Function o UI produttiva è modificata.

## Censimento

I writer legacy personali e aziendali salvano `nomeAccount` e `url` in chiaro, cifrano `username`, `account`, `password` e `note`, e aggiungono campi specifici per condivisione, memorandum, banking e referente. La shell già leggeva i record di laboratorio con `nomeAccount` cifrato; A6 mantiene questo confine più restrittivo come richiesto e tratta `url` nella forma canonica in chiaro. I record con nome legacy in chiaro restano incompatibili e consultabili solo dai percorsi legacy: non viene inventata una migrazione implicita.

I backlink canonici sono `linkedProfileField(s)` e `linkedCompanyProfileField(s)`, con revisione `_profileLink*`. I documenti esterni `accountWidgets`, `sharedVaultData` e `sharedVaultLinks` non fanno parte del record Account e non vengono riscritti.

## Confine di scrittura

La vista può cambiare soltanto `nomeAccount`, `username`, `account`, `password` e `url`. I primi quattro passano dalla capability crittografica revocabile; l'URL è validato come HTTP(S). La richiesta contiene identità composta personale/azienda, UID atteso, revisione, impronta e ID operazione. Il servizio rilegge Account e azienda nella transazione, convalida backlink e metadati, aggiorna solo i cinque campi e i metadati A6 e crea una ricevuta idempotente. Note, allegati, condivisioni, banking, referente, Widget, credenziali comuni e campi sconosciuti restano invariati.

L'overlay Rules del laboratorio chiude le modifiche dirette dei campi A6. La produzione resta invariata perché i writer legacy devono essere migrati prima di poter attivare questo overlay.

## Lifecycle e prove

Offline l'editor è di sola lettura. Lock, logout, cambio UID, navigazione, cambio Account e callback tardive revocano la sorgente; chiusura e salvataggio azzerano i valori degli input. Solo `password` usa `type=password` e semantica `current-password`.

Le prove coprono Account personali e aziendali con lo stesso ID, più origini collegate, retry, concorrenza, relazioni malformate, svuotamento dei campi, preservazione dei dati incorporati ed esterni e rifiuto delle scritture dirette. Chrome desktop e mobile esercitano modifica, rilettura, ripristino, offline e pulizia. Edge resta soggetto al gate ambientale già censito se termina prima dell'endpoint DevTools.

Restano fuori da A6 gli editor Widget, il riordino, i template, banking/carte, migrazioni legacy, Rules/Functions produttive e collaudi fisici.
