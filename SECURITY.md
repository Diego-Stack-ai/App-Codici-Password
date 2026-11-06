# Sicurezza

## Versioni supportate

Le correzioni di sicurezza vengono applicate al ramo `master` e alla versione pubblicata piu recente. Le versioni precedenti non sono supportate.

## Segnalare una vulnerabilita

Non aprire issue pubbliche con dettagli tecnici, dati personali, token, password, chiavi private o procedure di sfruttamento. Usa la segnalazione privata di una vulnerabilita nelle GitHub Security Advisories del repository. Se il canale privato non e disponibile, contatta il proprietario del repository senza includere segreti nel primo messaggio.

Indica, quando possibile:

- area e versione interessate;
- prerequisiti e impatto osservato;
- procedura minima per riprodurre il problema con dati sintetici;
- eventuali mitigazioni gia provate.

La ricezione viene confermata appena possibile. Il problema viene prima riprodotto e classificato, poi corretto e verificato prima di pubblicare i dettagli.

## Credenziali e configurazione pubblica

Le chiavi Firebase Web presenti nel client identificano il progetto e non sono credenziali amministrative. La protezione dei dati dipende da Authentication, App Check, Security Rules e autorizzazioni delle Functions. Service account, chiavi private, token di deploy, password QA e dati reali non devono invece comparire nel repository, nella documentazione, nei log o nelle fixture.

Il workflow Gitleaks controlla i nuovi commit e, al rilascio manuale, l'intera cronologia. Una credenziale potenzialmente valida blocca il rilascio finche la sua inutilizzabilita non e verificata: disabilitazione/revoca della chiave oppure assenza dell'identita confermata dal provider. Eliminare il testo dall'ultima versione non rende sicura una credenziale gia presente nella cronologia.

I reperti storici revisionati possono essere riconosciuti soltanto tramite fingerprint individuali completi di commit, percorso, regola e riga. Non si autorizzano intere regole o percorsi. Per la credenziale storica la pubblicazione ricontrolla lo stato pubblico del provider, con un'identita valida di controllo, prima della scansione e prima del deploy; qualunque anomalia blocca il rilascio. La verifica dello stato corrente non dimostra quando sia avvenuta una revoca/eliminazione e non chiude il riesame di eventuali abusi passati.
