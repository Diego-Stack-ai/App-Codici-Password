# Leggimi

> Stato operativo 09/10/2026: il ciclo tecnico M7–M10 è chiuso sulla versione pubblicata `1.2.144`. Per esito, confini safe-off e verifiche esterne future vedere [STATO](progetto/STATO.md).

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](LEGGIMI.md). Stato verificato e limiti: [STATO](progetto/STATO.md).

## Regole di struttura approvate da Diego

L’ordine “procedi” del 23/09/2026 autorizza questa migrazione e il controllo della struttura proposta di **31 Markdown**. Solo Diego può autorizzare variazioni dell’elenco o della funzione dei documenti. La struttura include storico, evidenze e istruzioni per agenti; non cresce automaticamente con anni, incarichi o suffissi v2/finale.

L’elenco vincolante è in `scripts/docs-manifest.json`. Non modificarlo, modificarne il controllo o spostare il problema in una cartella esclusa per far passare una consegna. Nessun agente crea/rinomina/elimina MD senza ordine esplicito. I contenuti si aggiornano invece nel normale incarico autorizzato, senza chiedere conferma a ogni frase.

## Lettura e manutenzione

1. A ogni incarico controllare questo indice, STATO e INCARICO_CORRENTE; leggere baseline e contratti/decisioni pertinenti. Dopo ripresa, cambio di base o perdita di contesto verificare quali fonti sono cambiate.
2. Prima di riproporre una domanda cercarne ID e risposte in DECISIONI e nella raccolta dell’area. Domande nuove vanno nella raccolta esistente; un argomento nuovo resta fra i quesiti da assegnare nel PROGRAMMA finché Diego non approva un’eventuale modifica strutturale.
3. Una sola sede principale: regole nei contratti, scelte in DECISIONI, avanzamento in STATO, obiettivi in PROGRAMMA, autorizzazioni in INCARICO_CORRENTE, istruzioni nelle procedure ed esiti nelle evidenze. Altrove usare rinvii, non copie dei rapporti.
4. Ogni consegna aggiorna i documenti influenzati oppure spiega perché non serve. Deciso, implementato nel ramo, verificato fisicamente e distribuito sono stati distinti.
5. Lo storico e le prove sono consultati per ID/sezione quando servono; non è obbligatoria la lettura integrale. Nessun segreto o dato personale in rapporti e commit.
6. Eseguire `npm run test:docs` prima della consegna. Il controllo verifica struttura e collegamenti, non la verità delle frasi: la revisione di coerenza resta obbligatoria.

## 3. Gerarchia delle fonti

1. Baseline in regole/SICUREZZA.
2. Contratti specialistici, incluse le sezioni dei contratti UI/pagine e i loro gate.
3. Sezione “guida implementativa Frontend” in regole/INTERFACCIA.
4. Roadmap e programma: orientano le attività senza derogare ai contratti.
5. Evidenze, inventari e audit: valgono per la loro data/base, non certificano il presente.
6. Storico e laboratorio: nessuna autorizzazione autonoma al runtime.

DECISIONI conserva autorità, fonte e successione delle scelte; non è un espediente per derogare alla baseline. Se due fonti autorevoli restano in conflitto, segnalare la questione senza scegliere arbitrariamente quella più recente. La migrazione non modifica le decisioni crittografiche o i gate di rilascio.

## Riferimenti dopo la migrazione

`scripts/docs-source-map.json` associa ciascuno dei 71 vecchi documenti ai nuovi intervalli e alle sezioni. I vecchi riferimenti `:N` sono riferiti alla base `2900ccc0`. Il testo originale resta in Git; le sezioni migrate conservano intestazioni e date, con note esplicite per le successioni M6/M7.

## Elenco dei 31 file

- [.github/copilot-instructions.md](../.github/copilot-instructions.md)
- [docs/LEGGIMI.md](LEGGIMI.md)
- [docs/domande/M10_RILASCIO.md](domande/M10_RILASCIO.md)
- [docs/domande/M6_OFFLINE.md](domande/M6_OFFLINE.md)
- [docs/domande/M7_CANCELLAZIONE.md](domande/M7_CANCELLAZIONE.md)
- [docs/domande/M8_RECUPERO.md](domande/M8_RECUPERO.md)
- [docs/evidenze/AUDIT.md](evidenze/AUDIT.md)
- [docs/evidenze/COLLAUDI.md](evidenze/COLLAUDI.md)
- [docs/evidenze/INVENTARI.md](evidenze/INVENTARI.md)
- [docs/procedure/AMBIENTE_DI_TEST.md](procedure/AMBIENTE_DI_TEST.md)
- [docs/procedure/COLLAUDI.md](procedure/COLLAUDI.md)
- [docs/procedure/GESTIONE_INCIDENTI.md](procedure/GESTIONE_INCIDENTI.md)
- [docs/progetto/DECISIONI.md](progetto/DECISIONI.md)
- [docs/progetto/INCARICO_CORRENTE.md](progetto/INCARICO_CORRENTE.md)
- [docs/progetto/PROGRAMMA.md](progetto/PROGRAMMA.md)
- [docs/progetto/STATO.md](progetto/STATO.md)
- [docs/regole/BACKUP.md](regole/BACKUP.md)
- [docs/regole/CANCELLAZIONE.md](regole/CANCELLAZIONE.md)
- [docs/regole/CONDIVISIONE.md](regole/CONDIVISIONE.md)
- [docs/regole/DATI.md](regole/DATI.md)
- [docs/regole/INTERFACCIA.md](regole/INTERFACCIA.md)
- [docs/regole/OFFLINE.md](regole/OFFLINE.md)
- [docs/regole/RILASCIO.md](regole/RILASCIO.md)
- [docs/regole/SALUTE_CREDENZIALI.md](regole/SALUTE_CREDENZIALI.md)
- [docs/regole/SICUREZZA.md](regole/SICUREZZA.md)
- [docs/regole/VAULT.md](regole/VAULT.md)
- [docs/storico/REGISTRO.md](storico/REGISTRO.md)
- [docs/sviluppo/ALLEGATI_DOCUMENTI.md](sviluppo/ALLEGATI_DOCUMENTI.md)
- [docs/sviluppo/ASSISTENTE_APP.md](sviluppo/ASSISTENTE_APP.md)
- [docs/sviluppo/PROFILO_E_ACCOUNT.md](sviluppo/PROFILO_E_ACCOUNT.md)
- [docs/utente/GUIDA.md](utente/GUIDA.md)
