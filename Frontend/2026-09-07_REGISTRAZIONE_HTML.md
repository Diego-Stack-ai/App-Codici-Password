# Registrazione HTML

**Data:** 07/09/2026

## Promemoria lavoro eseguito

È stato corretto il problema di scroll verticale nella pagina `registrati.html` su mobile. La pagina non permetteva di scorrere correttamente il form perché la struttura delle pagine di accesso non usa `.base-main`, mentre il CSS globale blocca lo scroll su mobile.

La correzione è stata isolata in un CSS dedicato alla pagina di registrazione, evitando modifiche globali che potessero influire sulle altre pagine dell'app.

La password richiesta nella registrazione resta la password dell'account/username con policy account a 12 caratteri; non è la Master Password del Vault.

Durante il collaudo è stata mantenuta anche `prova.html` come pagina sperimentale pubblicabile. La pagina di prova è stata esclusa dai controlli delle 29 pagine canoniche e i suoi stili sono stati separati in un CSS dedicato per rispettare gli audit automatici.

Dopo le correzioni, la pipeline GitHub Actions è risultata verde e il deploy Firebase è stato completato.

## Nota importante sulla copia locale

Questo lavoro è stato eseguito direttamente sul repository GitHub, saltando la normale lavorazione nella cartella locale del PC.

Di conseguenza, questa nota e le modifiche collegate potrebbero non essere ancora conosciute dallo Smartdown/Markdown presente nella cartella locale.

Alla prossima sessione di lavoro locale occorre verificare la sincronizzazione con `origin/master` e allineare la documentazione locale prima di proseguire con ulteriori modifiche.
