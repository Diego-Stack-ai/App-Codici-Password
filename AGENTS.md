# Project instructions

Leggere [indice e autorità documentali](docs/LEGGIMI.md), [stato corrente](docs/progetto/STATO.md#stato-corrente) e [incarico corrente](docs/progetto/INCARICO_CORRENTE.md). Le [istruzioni degli agenti](.github/copilot-instructions.md) definiscono il perimetro operativo; questa istruzione tecnica non amplia incarichi o permessi e non sostituisce i contratti dell'app.

Questo file e la skill locale token-saver sono inclusi nell'elenco chiuso di 34 Markdown approvato il 07/11/2026. Il bootstrap non autorizza altri documenti, commit, installazioni o pubblicazioni.

## Ambiente di lavoro

- Analisi, modifiche autorizzate e test riproducibili possono essere svolti in una copia locale o in Codex Cloud. In entrambi gli ambienti verifica ramo e base di partenza, leggi l'incarico corrente e usa solo dati di test sintetici nel perimetro approvato.
- Prima di riprendere un lavoro verifica lo stato della copia e gli aggiornamenti del ramo remoto. I commit autorizzati possono partire dall'ambiente usato per il lavoro e raggiungono l'altro ambiente tramite il ramo pubblicato su GitHub.
- Esegui le verifiche che dipendono da un dispositivo fisico, un browser personale o un servizio privato nell'ambiente previsto dalla procedura. Mantieni distinti i risultati dei test portabili, i collaudi fisici, i check CI e le approvazioni di rilascio.

<!-- token-saver:start -->
## Token-efficient project mapping

- Per dipendenze e flussi tra più parti del codice usa `$token-saver` e Graphify sulla mappa del solo codice, aggiornandola quando serve all'incarico. Per una ricerca puntuale, leggi i file pertinenti. La consultazione dei Markdown richiesti dal progetto segue l'indice documentale.
<!-- token-saver:end -->
