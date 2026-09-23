# M6 — Checklist iPhone per Diego (prova fisica, evidenza circoscritta)

> **Stato: APERTA e NON ESEGUITA.** Questa checklist **non è stata eseguita**, non contiene esiti e non
> certifica nulla finché non è compilata da Diego sul proprio dispositivo.
>
> **Un esito fisico positivo è evidenza circoscritta**: riguarda i passi qui elencati, su quella build e
> quel dispositivo, e **non chiude M6**, **non chiude M6-F3**, **non chiude i gate PWA, di produzione o di
> deploy** e non autorizza alcun rilascio. I **gate M6 restano quelli elencati** in
> [STATO_CORRENTE_M0_M10.md](./STATO_CORRENTE_M0_M10.md) e [CENSIMENTO_GATE_M6_M10.md](./CENSIMENTO_GATE_M6_M10.md)
> (M6-1, M6-2, M6-3 e la matrice delle copie PWA); lo stato delle decisioni di prodotto è in
> [REGISTRO_DECISIONI.md](./REGISTRO_DECISIONI.md).
>
> **Autorità:** contratto [M6 — Sincronizzazione e scritture offline](./M6_SINCRONIZZAZIONE_OFFLINE.md);
> prevale la baseline di sicurezza.
> **Perimetro:** sola consultazione. Nessuna modifica ai dati, nessuna nuova credenziale di prova, nessun
> logout, nessun deploy. **Nessuna prova su dispositivi o ambienti reali è stata eseguita per produrre
> questo documento.**
> **Build da provare:** la sceglie **Diego**. Questa checklist non indica, non presume e non sostituisce
> la scelta della build o dell'ambiente.

## Perché serve

Il test del 10/09/2026 con un Account bancario aperto integralmente online non ha superato la
consultazione offline: dopo il distacco della rete la lista risultava vuota o non disponibile. Nessun
esito di laboratorio sostituisce questa prova. Questa checklist ripete il flusso in modo verificabile e
raccoglie **evidenze circoscritte**, senza catturare segreti.

## 1. Anagrafica del test — da compilare **prima** di iniziare

| Campo | Valore (a cura di Diego) |
|---|---|
| Data e ora di inizio | |
| Esecutore | |
| Dispositivo e versione iOS | |
| Browser / PWA usati (installata sulla Home?) | |
| **Versione e build effettive** lette nell'app (piè di pagina o schermata versione) | |
| **Ambiente provato** | ☐ produzione (app pubblicata) ☐ preview/laboratorio **esplicitamente autorizzati** |
| Riferimento dell'autorizzazione, se preview/laboratorio | |
| Rete disponibile per il ritorno online (Wi-Fi / dati) | |
| Note su fixture o account dedicati **già autorizzati** (se usati) | |

**Regole sull'ambiente.** Produzione e preview/laboratorio **non sono intercambiabili**: un esito su
preview **non** vale come prova di produzione e viceversa. Una prova su preview o laboratorio si esegue
**solo** se esiste un'autorizzazione esplicita e separata, da citare nel campo sopra. Se l'autorizzazione
non c'è, il test su quell'ambiente **non si esegue**.

Se il test si svolge in più sessioni, indicare la **data accanto a ogni riga** compilata.

## 2. Regole di evidenza (nessun segreto, nessun dato reale)

1. **Vietato** consegnare screenshot, foto, video, testi o report che contengano **PIN, CCV, password,
   credenziali, valori in chiaro, token o dati personali** (nomi, indirizzi, email, IBAN, documenti).
2. **Non trascrivere mai il valore** di un PIN, CCV, password o credenziale: si verifica solo il
   **comportamento** di mascheramento e rivelazione. La verifica è «il campo era mascherato, l'azione di
   rivelazione ha mostrato un valore, il campo è tornato mascherato», **senza registrare il valore**.
3. Ammesse come evidenza **solo**: (a) la **tabella compilata** con esiti strutturati; (b) i campi
   dell'anagrafica; (c) eventuali screenshot di schermate **prive di segreti e di dati personali**;
   (d) eventuali **fixture dedicate esplicitamente autorizzate**, dichiarate in anagrafica.
4. Se una schermata **può contenere** segreti o dati personali, **non acquisirla**; se serve comunque
   documentarla, **oscurarla sul dispositivo prima che l'immagine lo lasci**.
5. Non consegnare log, dump di IndexedDB, esportazioni o allegati che possano contenere valori cifrati
   con le relative chiavi, token o dati personali.
6. Se un'evidenza acquisita per errore contiene segreti o dati personali, **non consegnarla**: va
   eliminata dal dispositivo e sostituita con una descrizione strutturata dell'esito.

## 3. Prerequisiti

- PWA installata sulla schermata Home (Safari → Condividi → Aggiungi a Home), **oppure** preview
  autorizzata secondo l'anagrafica.
- Versione e build **registrate in anagrafica** prima di iniziare.
- Master Password disponibile; Vault sbloccato prima del distacco.
- Sessione mantenuta: **non eseguire il logout** in nessun momento del test.
- Dati già presenti e non modificati nel profilo usato (almeno un Account personale e uno aziendale con
  banche e carte, Widget bancari, credenziali comuni, profilo, indirizzi, documenti, scadenze).
- Wi-Fi e rete mobile disponibili per il ritorno online.
- Circa 15 minuti. Nessuna nuova credenziale di prova va inserita.

## 4. Preparazione online (obbligatoria)

1. Apri l'app con rete attiva e sblocca il Vault con la Master Password.
2. Attendi che la preparazione offline automatica arrivi allo stato pronto. Non procedere prima.
3. Visita una volta, sempre online: lista Account personali, dettaglio degli Account bancari con le
   banche e le relative carte, Widget bancari, credenziali comuni, profilo (anagrafica, contatti,
   indirizzi, documenti), scadenze. Solo ciò che è stato caricato è garantito leggibile.
4. Non eseguire il logout.

## 5. Distacco della rete

5. Attiva la Modalità aereo, oppure disattiva Wi-Fi e dati cellulare.
6. Verifica che l'app mostri lo stato offline. Da qui in avanti **non riattivare la rete** fino al §8.
7. Chiudi e riapri la PWA: è atteso un nuovo sblocco con la Master Password (le chiavi non sopravvivono
   alla chiusura: è il comportamento corretto).

## 6. Verifiche offline

Una riga per verifica. Segna **`OK`**, **`KO`** oppure **`NON ESEGUITO`**. Nessun valore segreto o dato
personale va trascritto: la colonna «Esito» contiene solo l'esito e, se serve, una nota di comportamento.

| # | Passo | Atteso (verifica di comportamento) | Esito |
|---|---|---|---|
| 1 | Apri la lista Account personali | Gli Account già caricati sono elencati; non una lista vuota | |
| 2 | Apri un Account bancario personale | Dettaglio visibile; presenza delle banche attese (nessun valore trascritto) | |
| 3 | Rivela e rimaschera PIN e CCV della prima carta | Campo **mascherato** prima della rivelazione; la rivelazione mostra un valore; il campo torna mascherato. **Non registrare il valore** | |
| 4 | Controlla la seconda banca e la sua carta | Stesso comportamento di mascheramento/rivelazione del punto 3; nessun valore mancante (**senza** trascriverlo) | |
| 5 | Apri la lista Account aziendali e un Account bancario aziendale | Stessi controlli dei punti 2–4 per il perimetro aziendale, **senza** trascrivere valori | |
| 6 | Apri i Widget bancari | Valori presenti e coerenti; **nessun dato di un altro Account** (nessun valore trascritto) | |
| 7 | Apri le credenziali comuni | Voci presenti con campi **mascherati**; comportamento di rivelazione come al punto 3 | |
| 8 | Apri il profilo: anagrafica, contatti, indirizzi, documenti | Dati già caricati leggibili (nessun dato personale trascritto) | |
| 9 | Apri gli allegati di un Account | Nome e metadati già caricati; **non** è richiesto che il contenuto del file sia disponibile offline | |
| 10 | Apri le scadenze | Dati già caricati leggibili | |
| 11 | Blocca il Vault e tenta di rileggere i dati | Accesso negato finché non si sblocca di nuovo | |
| 12 | Sblocca di nuovo con la Master Password | La matrice precedente torna leggibile | |
| 13 | Cambia sezione e torna indietro | I valori rivelati vengono **azzerati** quando si lascia la vista | |

## 7. Chiusura, riapertura e cache mancante

14. Chiudi completamente la PWA e riaprila **senza rete**; sblocca e ripeti i punti 1, 2, 5 e 6.
15. Opzionale ma più severo: riavvia l'iPhone senza rete e ripeti i punti 1, 2, 5 e 6.
16. Se una lista o un dettaglio **già caricato** appare vuoto o «non disponibile» offline, registra
    **`KO`**: una lista vuota non significa «nessun dato».
17. Verifica un dominio mai aperto online (per esempio il profilo di un'azienda mai visitata): deve
    comparire un messaggio di indisponibilità, **non** un record vuoto o inventato. Se il dato non viene
    mostrato come valido, registra **`OK`**.
18. Un documento mai caricato non è garantito offline: è un limite noto, **se** non viene presentato come
    dato valido. Le domande aperte su questo tema restano in
    [M6_DOMANDE_CACHE_ESPULSA.md](./M6_DOMANDE_CACHE_ESPULSA.md).

## 8. Ritorno online

19. Disattiva la Modalità aereo e attendi il ritorno della connessione.
20. Verifica di essere ancora autenticato senza nuovo login.
21. Riapri un dettaglio bancario: gli stessi dati devono essere presenti e coerenti (nessun valore
    trascritto).

## 9. Condizioni di stop

Interrompi il test e riferisci subito, **senza tentare riparazioni**, se:

- un valore segreto è visibile in chiaro dove dovrebbe essere mascherato;
- compaiono dati di un altro Account o di un altro utente;
- il Vault si sblocca senza Master Password, oppure la sessione cambia utente da sola;
- un Account o una lista caricati integralmente online appaiono vuoti o non disponibili offline: è il
  difetto originale, va registrato e non aggirato;
- l'app richiede un nuovo login o esegue il logout da sola;
- un dato risulta modificato;
- **un'evidenza acquisita contiene segreti o dati personali**: non consegnarla, eliminala dal dispositivo
  e sostituiscila con una descrizione strutturata dell'esito.

Non modificare dati, non rifare la preparazione, non reinstallare l'app e non eseguire alcun deploy
durante il test.

## 10. Esito e limiti

- Consegna la **tabella compilata** (anche con righe `NON ESEGUITO`) e l'**anagrafica**: sono le evidenze
  ammesse. Aggiungi screenshot **solo** se privi di segreti e dati personali.
- **Un esito positivo è evidenza circoscritta**: vale per i passi elencati, su quella build e quel
  dispositivo. **Non chiude M6**, **non chiude M6-F3**, **non chiude i gate PWA, di produzione o di
  deploy** e non autorizza alcun rilascio.
- I **gate M6** restano quelli di [STATO_CORRENTE_M0_M10.md](./STATO_CORRENTE_M0_M10.md) e
  [CENSIMENTO_GATE_M6_M10.md](./CENSIMENTO_GATE_M6_M10.md); un esito **`KO`** o **`NON ESEGUITO`** non
  chiude nulla e non va presentato come superato.
- La build e l'ambiente li sceglie **Diego**: questa checklist non li seleziona e non presume che la
  prova sia già avvenuta su produzione, preview o laboratorio.
