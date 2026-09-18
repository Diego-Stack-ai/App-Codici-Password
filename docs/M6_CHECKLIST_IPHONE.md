# M6 — Checklist iPhone per Diego (gate fisico)

> **Stato del gate:** APERTO. Questa checklist non è stata eseguita e non certifica nulla finché non è compilata.
> **Autorità:** contratto [M6 — Sincronizzazione e scritture offline](./M6_SINCRONIZZAZIONE_OFFLINE.md); prevale la baseline sicurezza.
> **Riferimento:** incarico M6-CLOSE del 18/09/2026. Il lavoro autonomo è consegnato; resta solo questa prova fisica.
> **Perimetro:** sola consultazione. Nessuna modifica ai dati, nessuna credenziale di prova inserita per il test, nessun logout.

## Perché serve

Il test del 10/09/2026 con un Account bancario aperto integralmente online non ha superato la consultazione offline: dopo il distacco della rete la lista risultava vuota o non disponibile. Nessun esito di laboratorio può sostituire questa prova. Questa checklist ripete il flusso in modo verificabile e raccoglie le evidenze.

Superare la checklist chiude **solo** il gate fisico qui elencato. Non certifica l'intero archivio, i byte degli allegati su Storage, l'assenza di espulsione della cache, tutte le pagine di produzione o le scritture offline bancarie (che restano escluse da M6).

## Prerequisiti

- PWA già installata sulla schermata Home (Safari → Condividi → Aggiungi a Home).
- **Versione attesa: `v1.2.127`**, leggibile nel piè di pagina dell'app. M6-CLOSE non ha eseguito alcun deploy: la PWA installata è la produzione già pubblicata. Per provare il candidato sperimentale serve prima un rilascio o una preview autorizzati separatamente.
- Master Password disponibile; Vault sbloccato prima del distacco.
- Sessione mantenuta: **non eseguire il logout** in nessun momento del test.
- Dati già presenti e non modificati: almeno un Account personale e uno aziendale con banche e carte, Widget bancari, credenziali comuni, profilo, indirizzi, documenti e scadenze.
- Wi-Fi e rete mobile disponibili per il ritorno online.
- Circa 15 minuti e possibilità di fare screenshot.

## 1. Preparazione online (obbligatoria)

1. Apri l'app con rete attiva e sblocca il Vault con la Master Password.
2. Attendi che la preparazione offline automatica arrivi allo stato pronto. Non procedere prima.
3. Visita una volta, sempre online: lista Account personali, dettaglio di **tutti** gli Account bancari con entrambe le banche e le relative carte, Widget bancari, credenziali comuni, profilo (anagrafica, contatti, indirizzi, documenti), scadenze. Una visita carica i documenti nella cache; la preparazione automatica copre le raccolte principali ma solo ciò che è stato caricato è garantito leggibile.
4. Non eseguire il logout.

## 2. Distacco della rete

5. Attiva la Modalità aereo (Impostazioni → Modalità aereo), oppure disattiva Wi-Fi e dati cellulare.
6. Verifica che l'app mostri lo stato offline. Da qui in avanti **non riattivare la rete** fino al passo 9.
7. Chiudi e riapri la PWA: è atteso un nuovo sblocco con la Master Password. Le chiavi non sopravvivono alla chiusura e questo è il comportamento corretto.

## 3. Verifiche offline

Una riga per verifica. Segna `OK`, `KO` oppure `non eseguito`, e allega uno screenshot per ogni riga verificata.

| # | Passo | Atteso | Esito |
|---|---|---|---|
| 1 | Apri la lista Account personali | Gli Account già caricati sono elencati, non una lista vuota | |
| 2 | Apri un Account bancario personale | Dettaglio visibile con IBAN delle banche presenti | |
| 3 | Rivela PIN e CCV della prima carta | Valori corretti, mascherati prima della rivelazione | |
| 4 | Controlla la seconda banca e la sua carta | IBAN, PIN e CCV corretti, nessun valore mancante | |
| 5 | Apri la lista Account aziendali e un Account bancario aziendale | Stessi controlli dei punti 2–4 per il perimetro aziendale | |
| 6 | Apri i Widget bancari | Valori corretti; nessun dato di un altro Account | |
| 7 | Apri le credenziali comuni | Valori corretti | |
| 8 | Apri il profilo: anagrafica, contatti, indirizzi, documenti | Dati già caricati leggibili | |
| 9 | Apri gli allegati di un Account | Nome e metadati già caricati; **non** è richiesto che il contenuto del file sia disponibile offline | |
| 10 | Apri le scadenze | Dati già caricati leggibili | |
| 11 | Blocca il Vault e tenta di rileggere i dati | Accesso negato finché non si sblocca di nuovo | |
| 12 | Sblocca di nuovo con la Master Password | La matrice precedente torna leggibile con gli stessi valori | |
| 13 | Cambia sezione e torna indietro | I valori rivelati vengono azzerati quando si lascia la vista | |

## 4. Chiusura e riapertura

14. Chiudi completamente la PWA (swipe verso l'alto nel selettore app) e riaprila **senza rete**.
15. Sblocca e ripeti i punti 1, 2, 5 e 6.
16. Opzionale ma più severo: riavvia l'iPhone senza rete e ripeti i punti 1, 2, 5 e 6.

## 5. Cache mancante ed espulsione

- Se una lista o un dettaglio già caricato appare vuoto o "non disponibile" offline, registra un `KO` su quella riga: **una lista vuota non significa "nessun dato"**.
- Verifica un dominio che non avevi mai aperto online (per esempio il profilo di un'azienda mai visitata): deve comparire un messaggio di indisponibilità, **non** un record vuoto o inventato. Questo comportamento è atteso e va registrato come `OK` se il dato non viene mostrato come valido.
- Un documento mai caricato non è garantito offline. È un limite noto, non un difetto, a condizione che non venga presentato come dato valido.

## 6. Ritorno online

17. Disattiva la Modalità aereo e attendi il ritorno della connessione.
18. Verifica di essere ancora autenticato senza nuovo login.
19. Riapri un dettaglio bancario: gli stessi valori devono essere presenti e coerenti.

## 7. Evidenze da consegnare

- Screenshot del piè di pagina con la versione dell'app.
- Screenshot dello stato offline e di ogni riga verificata.
- Screenshot di ogni `KO`, di ogni lista vuota e di ogni messaggio di indisponibilità.
- Data e ora del test, modello di iPhone e versione di iOS.
- La tabella compilata, anche con righe `non eseguito`.

## 8. Criteri di stop

Interrompi il test e riferisci subito, senza tentare riparazioni, se:

- un valore segreto è visibile in chiaro dove dovrebbe essere mascherato;
- compaiono dati di un altro Account o di un altro utente;
- il Vault si sblocca senza Master Password, oppure la sessione cambia utente da sola;
- un Account o una lista caricati integralmente online appaiono vuoti o non disponibili offline: è il difetto originale, va registrato e non aggirato;
- l'app richiede un nuovo login o esegue il logout da sola;
- un dato risulta modificato.

Non modificare dati, non rifare la preparazione, non reinstallare l'app e non eseguire alcun deploy durante il test.

## 9. Esito

- Compila la tabella e consegna le evidenze a Codex/DeepSeek.
- La checklist da sola non chiude alcun gate: solo il risultato registrato lo fa.
- M6-CLOSE ha consegnato tutte le attività autonome con `DA_VERIFICARE`; questo gate fisico resta l'unico non superato e non bloccante.
