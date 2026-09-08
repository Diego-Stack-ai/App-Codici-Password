# M5 — Piano di integrazione e rollback

## Principio

La condivisione professionale entra nel runtime per fasi reversibili. Nessuna fase sovrascrive o elimina il record legacy finché il nuovo record non è stato scritto, riletto, decifrato e confrontato dal proprietario. Le Rules candidate e i nuovi percorsi non diventano produzione senza approvazione esplicita.

## Stati di migrazione

| Stato | Lettura | Scrittura | Reversibilità |
|---|---|---|---|
| `legacy` | solo documento attuale | formato attuale | totale |
| `prepared` | legacy canonico; schema 2 ombra non visibile | legacy + pacchetto schema 2 verificato | eliminazione sicura dell'ombra |
| `dual-read` | schema 2 se integro, altrimenti legacy | legacy canonico | ritorno immediato al legacy |
| `record-key` | schema 2 canonico | schema 2 con nuova generazione | legacy conservato in quarantena cifrata |
| `finalized` | schema 2 | schema 2 | rollback tramite backup cifrato M8 |

Lo stato non viene dedotto dall'assenza di campi: è un valore esplicito, versionato e modificabile soltanto dal backend o da un orchestratore autorizzato.

## Fasi operative

### 0. Preparazione senza traffico

- mantenere invariati record, inviti e Rules correnti;
- distribuire soltanto codice capace di ignorare in sicurezza campi e documenti schema 2;
- introdurre metriche prive di segreti: versione schema, esito e codice errore;
- provare fixture privata, aziendale, memorandum e allegato.

### 1. Identità crittografica

- generare sul dispositivo la coppia ECDH dell'utente;
- pubblicare la sola chiave pubblica versionata tramite backend;
- avvolgere la chiave privata con la Vault Key e conservarla separatamente;
- verificare ripristino su secondo dispositivo, cambio Master Password e reset irreversibile;
- impedire sostituzione silenziosa della chiave pubblica.

### 2. Doppio lettore

- risolvere un descrittore opaco del record;
- se lo stato è `dual-read` o successivo, validare schema, grant e generazione prima di decifrare;
- in caso di documento schema 2 assente o non integro, usare il legacy senza modificarlo;
- non fare fallback dopo un errore di autorizzazione o autenticità: eviterebbe il controllo di revoca;
- mostrare un errore sicuro se entrambi i formati sono presenti ma divergono.

### 3. Nuove scritture

- creare record schema 2 e grant del proprietario in una transazione backend;
- creare l'envelope del destinatario solo dopo identità verificata e consenso;
- usare un indice ricevuti minimale per la lista, seguito da lettura puntuale del record;
- scrivere allegati cifrati nel percorso condiviso senza URL pubblico persistente;
- inviti, revoche e rotazioni diventano operazioni backend idempotenti.

### 4. Migrazione progressiva

- selezione esplicita di un singolo record del proprietario;
- lettura e decifratura legacy in memoria;
- creazione del payload per-record e dei grant attivi;
- rilettura dal backend, decifratura e confronto semantico campo per campo;
- stato `prepared`, poi `dual-read` dopo conferma;
- nessuna migrazione automatica in massa nella prima release.

### 5. Cutover e quarantena

- promuovere a `record-key` solo record verificati e senza divergenze;
- rendere il legacy non scrivibile e conservarlo per una finestra definita;
- ruotare la chiave e incrementare `keyGeneration` a ogni revoca che precede una nuova revisione;
- passare a `finalized` soltanto quando M8 fornisce backup cifrato e ripristino provato.

## Contratto del doppio lettore

1. `schemaVersion` e `cryptoProtocol` devono essere riconosciuti esplicitamente.
2. Record, grant ed envelope devono avere lo stesso `recordId`, destinatario e `keyGeneration`.
3. Il proprietario usa anch'egli un grant; nessuna chiave del record è memorizzata in chiaro.
4. Il payload autenticato contiene tutti i campi funzionali e la revisione.
5. I metadati esterni seguono una allowlist, non una copia del record legacy.
6. Una firma/tag non valido, una generazione discordante o un grant revocato sono errori terminali.
7. Il fallback legacy è ammesso soltanto negli stati `legacy`, `prepared` e `dual-read` e mai per aggirare un diniego.

## Scritture, concorrenza e idempotenza

- ogni comando porta `operationId`, `expectedRevision` e `expectedKeyGeneration`;
- un'operazione ripetuta con lo stesso ID restituisce lo stesso esito;
- una revisione inattesa produce conflitto e non sovrascrive;
- record, grant, indice ricevuti ed evento audit vengono aggiornati atomicamente o tramite outbox backend recuperabile;
- il client non modifica direttamente ACL, generazione o stato migrazione.

Questi requisiti diventano la base di M6 per sincronizzazione e conflitti.

## Rollback

| Fase | Azione di rollback |
|---|---|
| Preparazione/identità | disabilitare feature flag; nessun record applicativo cambia |
| `prepared` | eliminare solo l'ombra dopo verifica del checksum; legacy intatto |
| `dual-read` | impostare lettore su legacy e bloccare nuove promozioni |
| `record-key` | riaprire il legacy in sola lettura; riconciliare revisioni senza sovrascrittura |
| `finalized` | usare esclusivamente il backup cifrato e verificato progettato in M8 |

Un rollback non riattiva grant revocati e non riduce `keyGeneration`.

## Gate prima della produzione

- [x] crittografia per-record ed envelope dimostrati su fixture;
- [x] Rules Firestore e Storage candidate dimostrate in emulatori;
- [x] revoca, generazione futura e limite della cache offline dimostrati;
- [x] inventario completo dei percorsi e dei metadati correnti;
- [x] ordine di integrazione, doppio lettore e rollback definiti;
- [ ] identità crittografica provata su due dispositivi non produttivi;
- [x] runtime identità ECDH implementato: chiave privata cifrata con materiale Vault, UID e chiave pubblica autenticati, sostituzione silenziosa bloccata;
- [x] doppio lettore integrato nel repository e testato con flag predefinita disattivata; revoca, autenticità, generazione e divergenza falliscono senza fallback;
- [ ] backup cifrato e ripristino M8 disponibili prima di `finalized`;
- [ ] approvazione esplicita per Rules, funzioni, migrazione e cutover di produzione.

M5 può chiudere come architettura e laboratorio. L'attivazione reale resta un rilascio separato dipendente da collaudo fisico, M6 e M8.
