# M7-R4 — Mappa eliminazione e condivisione

> **Stato:** censimento in sola lettura. **Nessuna decisione presa** e nessuna modifica al comportamento attuale.
> **Autorità:** subordinato a [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md), a [M7 — Cronologia, cestino e audit](./M7_CRONOLOGIA_CESTINO_AUDIT.md) e a [M7 — Censimento retention](./M7_RETENTION_CENSIMENTO.md).
> **Revisione:** 21/09/2026, riferimento applicativo `v1.2.127`, base `b5df2f2b`.
> **Perimetro:** sola lettura e documentazione. Nessuna modifica a runtime, Rules, Functions, dati reali, versione o `master`; nessun test distruttivo; M8–M10 non avviati.

## 0. Come leggere

| Stato | Significato |
|---|---|
| **verificato nel codice** | la proprietà è dimostrata dalle righe citate |
| **verificato nelle Rules** | la proprietà è dimostrata dalle Rules citate |
| **non implementata** | l'azione non esiste in nessun percorso del codice distribuito |
| **non verificata** | non è dimostrabile da questo repository |

**Produttivo** = `Frontend/public/**`, `functions/**`, `firestore.rules`, `storage.rules`. **Laboratorio** = `experiments/**` (non raggiungibile dall'app).

## 1. I quattro casi

| # | Caso | Chi è il proprietario | Dove vive il record | Chi lo vede |
|---|---|---|---|---|
| 1 | Account proprio non condiviso | l'utente | `users/{uid}/accounts/{id}` o `users/{uid}/aziende/{cid}/accounts/{id}` | solo il proprietario |
| 2 | Account proprio condiviso con ospiti | l'utente | stesso percorso, con `sharedWith`/`sharedWithUids` valorizzati | proprietario + ospiti accettati |
| 3 | Account di altro proprietario ricevuto | un altro utente | resta nel percorso del **proprietario**; l'ospite lo legge da lì | proprietario + l'ospite accettato, **solo lettura** |
| 4 | Account proprio collegato a credenziali comuni | l'utente | stesso percorso del caso 1/2 più `sharedVaultData`/`sharedVaultLinks` e i widget in `accountWidgets` | solo il proprietario (le collezioni comuni sono del proprietario) |

Il caso 3 non crea **nessun documento Account separato** nella raccolta Firestore dell'ospite: la lista dell'ospite legge il documento del proprietario (`Frontend/public/assets/js/modules/privato/account_privati.js:205-216`) e ne conserva una copia **in memoria JavaScript**, inserendola in `allAccounts` (`:226,255`). La distinzione è importante: la copia esiste nel processo del browser e può restare nella cache locale di Firestore, ma **non** è una seconda persistenza né un documento nella raccolta dell'ospite.

## 2. Modello tecnico della condivisione (verificato)

- La condivisione è una **mappa sul documento dell'Account**: `sharedWith = { <email normalizzata>: {email, status, uid} }`, più gli indici `sharedWithUids` (solo ospiti `accepted` con `uid`) e `acceptedCount`, e `visibility: 'shared'` (`Frontend/public/assets/js/modules/privato/form-privato-save.js:311-407`; stessa logica per l'azienda in `.../azienda/form-azienda-save.js:220-315`; pannello in `.../shared/detail-account-mode.js:142-182`).
- **Regola dell'ospite accettato**: `isAcceptedGuest()` vale se l'UID autenticato è dentro `sharedWithUids` del documento (`firestore.rules:10-12`).
- **Lettura dell'ospite, sola lettura**: `users/{userId}/accounts/{accountId}`, la variante aziendale e la collection-group `{path=**}/accounts/{accountId}` concedono **solo `get, list`** all'ospite accettato (`firestore.rules:164-172`). Nessuna scrittura, nessuna cancellazione, nessun accesso alle sottocollezioni.
- **Inviti**: `invites/{inviteId}` è leggibile dal proprietario (`ownerId`/`senderId`) **o** dal destinatario per email; creazione, modifica e cancellazione sono riservate al proprietario dell'invito (`firestore.rules:174-202`). L'accettazione o il rifiuto passano quindi da una callable, non da una scrittura client: `respondToInvitation` (`Frontend/public/assets/js/main-v129.js:567-568`).
- **Credenziali comuni e widget**: `accountWidgets`, `sharedVaultData` e `sharedVaultLinks` sono **leggibili solo dal proprietario e non scrivibili da alcun client** (`firestore.rules:149-162`); le scritture passano dalle callable backend. L'ospite **non** ha accesso a queste collezioni del proprietario.
- **Esclusione dell'ospite nel resto dell'app** (verificato nel codice): il flag `_isGuest` esclude il record dal collegamento ai Profili e dalle liste aziendali (`Frontend/public/assets/js/modules/azienda/company-profile-ui.js:57`, `.../azienda/company-profile-link.js:21`, `.../shared/profile-account-management.js:12`, `.../privato/profilo-links.js:64`) e dalle scritture offline ridotte M6 (`Frontend/public/assets/js/modules/privato/private-account-offline-policy.js:22-28`).
- **Cache offline e backup includono le collezioni comuni**: `sharedVaultData` e `accountWidgets` sono nella preparazione offline (`Frontend/public/assets/js/offline-sync.js:12,113`) e nel backup (`Frontend/public/assets/js/modules/settings/backup-export-service.js:84-98`).

### 2.1 Ciclo di vita dell'invito (verificato)

1. **Creazione** — il proprietario, dal client e in transazione, crea `invites/{accountId}_{emailSanitizzata}` con `status: 'pending'` e aggiunge `sharedWith[chiaveEmail] = {email, status: 'pending', uid: null}` (`Frontend/public/assets/js/modules/privato/form-privato-save.js:353-373`; varianti aziendali in `.../azienda/form-azienda-save.js:267-281` e `.../shared/detail-account-mode.js:164-173`). La chiave email è normalizzata togliendo ogni carattere non alfanumerico.
2. **Notifica** — un trigger backend avvisa il destinatario con email o push (`functions/index.js:1320-1368`).
3. **Accettazione o rifiuto** — solo tramite la callable `respondToInvitation` (`functions/index.js:1187-1246`), che accetta esclusivamente `accepted` o `rejected` ed esige che l'invito sia ancora `pending`; il client la invoca da `Frontend/public/assets/js/main-v129.js:566-568`.
4. **Effetti dell'accettazione** — sul documento del **proprietario**: `sharedWith[guestKey]` aggiornato con `uid`, `sharedWithUids` ricalcolato, `acceptedCount`, `visibility: 'shared'`, `updatedAt` (`functions/index.js:1226-1237`); sul documento invito: `status`, `guestUid`, `respondedAt` (`:1238-1242`).
5. **Revoca** — solo dal proprietario, con tre percorsi client: pannello del dettaglio privato (`.../privato/dettaglio-privato-sharing.js:92-171`), pannello del dettaglio aziendale (`.../azienda/dettaglio-azienda-sharing.js:199-292`) e cambio modalità dell'Account (`.../shared/detail-account-mode.js:145-185`). L'effetto è la rimozione dell'ospite da `sharedWith`, il ricalcolo di `sharedWithUids`/`acceptedCount`/`visibility` e la cancellazione del documento invito. Il **destinatario non può** modificare né cancellare l'invito (`firestore.rules:201`).
6. **Nessuna scadenza**: non esiste alcun campo di scadenza o TTL sugli inviti o sulla condivisione.

### 2.2 Cosa vede l'ospite nel dettaglio

Il dettaglio privato imposta `ownerId` dall'URL e attiva la modalità sola lettura quando `ownerId !== uid` (`Frontend/public/assets/js/modules/privato/dettaglio_account_privato.js:91-92`), mostrando il banner «Account condiviso in sola lettura». I pulsanti di copia restano attivi. **Verificato nel codice**: la chiave Vault è per-UID (`Frontend/public/assets/js/modules/core/security-manager.js:399-404`) e il lettore di record condivisi è disattivato (`Frontend/public/assets/js/modules/data/shared-record-reader.js:12`, `SHARED_RECORD_READER_ENABLED = false`); **non verificato**: che cosa la schermata mostri effettivamente a un ospite e se il valore copiato sia ciphertext. Questa sezione non dichiara provato il comportamento dell'interfaccia: la prova statica riguarda il lettore disattivato e la derivazione per-UID della chiave, non l'esito visibile. Le sezioni dei widget e delle credenziali del proprietario sono nascoste in sola lettura (`.../shared/account-embedded-widgets.js:438`) e l'ospite non può scaricare gli allegati (`storage.rules:33-36`). **La decifratura lato ospite non è implementata**: il prototipo con chiave per record è di laboratorio.

## 3. Azioni per caso

Legenda: **Sì** = disponibile a quel ruolo; **No** = impedito da UI o Rules; **—** = non applicabile.

| Azione | Caso 1 proprietario | Caso 2 proprietario | Caso 2 ospite | Caso 3 ospite | Caso 4 proprietario | Dove |
|---|---|---|---|---|---|---|
| Vedere il record | Sì | Sì | Sì | Sì | Sì | `firestore.rules:106-118,164-172` |
| Archiviare (cestino) | Sì | Sì | **No** | **No** | Sì | `.../privato/account_privati.js:371`, `.../azienda/account_azienda.js:249` |
| Ripristinare | Sì | Sì | **No** | **No** | Sì | `.../settings/archive-account-service.js:159-194` |
| Eliminare dalla lista | Sì, ma **sposta nell'Archivio** (M7-R6) | Sì, ma **sposta nell'Archivio** | **No** | **No** (bloccato in UI) | Sì, ma **sposta nell'Archivio** | `.../privato/account_privati.js:392-402`, `.../azienda/account_azienda.js:271-286`, `.../azienda/form-azienda-save.js:326-340` |
| Purge definitivo da Archivio | Sì | Sì | **No** | **No** | Sì | `functions/index.js:448-537` |
| Revocare l'accesso a un ospite | — | Sì | **No** | **No** | — | `.../privato/dettaglio-privato-sharing.js:105-157`, `.../azienda/dettaglio-azienda-sharing.js:212-277`, `.../shared/detail-account-mode.js:137-187` (corretto in M7-R5) |
| Rinunciare alla condivisione (lato ospite) | — | — | — | **non implementata** | — | nessun percorso trovato |
| Modificare le credenziali comuni collegate | — | — | — | — | Sì | `firestore.rules:154-162` + callable backend |
| Accettare o rifiutare un invito | — | — | **No** (è il destinatario) | Sì, solo se `pending` | — | `functions/index.js:1187-1207` |
| Modificare o cancellare un invito | Sì | Sì | **No** | **No** | — | `firestore.rules:201` |
| Copiare i valori dell'Account | Sì | Sì | Sì (sui record cifrati copia ciphertext) | Sì (ciphertext) | Sì | `.../privato/dettaglio_account_privato.js:420-448` |
| Vedere i widget del proprietario | Sì | Sì | **No** | **No** | Sì | `.../shared/account-embedded-widgets.js:438` |
| Scaricare gli allegati | Sì | Sì | **No** | **No** | Sì | `storage.rules:33-36` |
| Leggere la rubrica contatti del proprietario | Sì | Sì | **No** | **No** | Sì | `firestore.rules:120-123` |

**Perché l'ospite non può eliminare**: la lista marca le card ricevute con `data-owner` diverso da `true` e la cancellazione esce subito con «solo il proprietario può eliminare» (`.../privato/account_privati.js:216,385`). Anche senza quel controllo, le Rules negherebbero la scrittura.

## 4. `deleteDoc` dalla lista contro `purgeArchivedAccount`

| Aspetto | Eliminazione dalla lista | Purge da Archivio |
|---|---|---|
| Chi | proprietario | proprietario, con conferma esplicita `DELETE_FOREVER` |
| Operazione | `batch.delete` (privato) / `deleteDoc` (azienda) | callable `purgeArchivedAccount` |
| Documento Account | eliminato | eliminato |
| Sottocollezioni (metadati allegati) | **restano** | eliminate con `recursiveDelete` |
| Oggetti su Storage | **restano** | eliminati per i percorsi elencati nei metadati |
| Riferimenti in Profilo/Aziende | solo `contactEmails` del Profilo privato, con confronto sul solo ID (privato); **nessuno** per l'azienda | pulizia pianificata su Profilo e su tutte le aziende |
| Widget, credenziali comuni, inviti | **restano** | **restano** (planner esistente ma non attivo) |
| Ricevuta di idempotenza | **nessuna** | `mutationResults/{uid}/operations/{operationId}` |
| Audit | **nessuno** | evento `account-purged` in `auditEvents` |
| Ripetibile / ripristinabile | no: il documento non esiste più | sì: ricevuta `processing` con ripresa |

Conseguenza verificata: dopo un'eliminazione dalla lista il purge **non è più applicabile** a quell'Account (`purgeDecision` risponde `not-found`, `functions/archive-purge-service.js:45`), quindi metadati e byte restano orfani senza un percorso applicativo che li rimuova. Il confronto con il solo ID del Profilo privato è già registrato come difetto storico in `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md` §«Riesame dopo evoluzione Profili».

## 5. Ospite dopo l'accettazione

1. L'ospite accetta con la callable `respondToInvitation` (`Frontend/public/assets/js/main-v129.js:567-568`).
2. La sua lista carica gli inviti accettati per la propria email e legge il documento del proprietario, marcandolo `isOwner: false`, `ownerId: <proprietario>`, `_isGuest: true` (`.../privato/account_privati.js:193-216`).
3. Da quel momento può **soltanto leggere**: le Rules concedono `get, list` e nulla più (`firestore.rules:164-172`).
4. Il proprietario può **revocare**: la mappa `sharedWith` viene aggiornata, `sharedWithUids` ricalcolato e all'ospite arriva una notifica `share_revoked` (`.../shared/detail-account-mode.js:151-153`). Da quel momento l'ospite non è più in `sharedWithUids` e la lettura decade.
5. **Non implementata**: un'azione dell'ospite per rinunciare alla condivisione dopo l'accettazione. L'ospite può solo rifiutare un invito **pendente**; dopo l'accettazione dipende dalla revoca del proprietario.

**Non verificata**: se e come l'ospite riesca a **decifrare** i valori dell'Account ricevuto. Le chiavi di condivisione esistono solo come prototipo di laboratorio (`experiments/sharing-key-prototype`), mentre `sharedVaultData`/`sharedVaultLinks`/`accountWidgets` del proprietario non sono leggibili dall'ospite (`firestore.rules:149-162`): il comportamento effettivo della schermata di dettaglio per un ospite richiede una verifica dedicata.

## 6. Effetti e sopravvivenza degli elementi

Colonne: **1L** = caso 1 eliminazione dalla lista; **1P** = caso 1 purge da Archivio; **2** = caso 2 (Account proprio condiviso); **3** = caso 3 (ospite); **4** = caso 4 (credenziali comuni collegate).

| Elemento | 1L | 1P | 2 | 3 | 4 | Evidenza |
|---|---|---|---|---|---|---|
| Documento Account | eliminato | eliminato | eliminato | resta del proprietario, l'ospite non può toccarlo | eliminato | M7-R1 §3.3-3.4; `firestore.rules:164-172` |
| Metadati allegati (sottocollezione) | **restano** | eliminati | restano | — | restano | `recursiveDelete` solo nel purge (`functions/index.js:507`) |
| Oggetti su Storage | **restano** | eliminati per i percorsi elencati | restano | — | restano | `functions/index.js:500-506` |
| Inviti (`invites/{id}`) | **restano** | restano | restano | restano, anche se l'Account non esiste più | restano | `firestore.rules:174-202`; nessun percorso li elimina |
| Accesso dell'ospite | decade con il documento | decade con il documento | decade con il documento o con la revoca | decade con la revoca del proprietario | — | `firestore.rules:10-12` |
| Widget (`accountWidgets`) | restano | restano | restano | non leggibili dall'ospite | restano | `firestore.rules:149-152`; planner non attivo |
| Credenziali comuni (`sharedVaultData`, `sharedVaultLinks`) | restano | **restano** | restano | non leggibili dall'ospite | **restano per progetto** | `firestore.rules:154-162`; `functions/archive-purge-reference-plan.js:16-18,32` |
| Riferimenti in Profilo/Aziende | solo `contactEmails` privati, confronto sul solo ID | pulizia pianificata su Profilo e aziende | come 1L | — | come 1L | `.../privato/account_privati.js:390-402`; `functions/index.js:517-528` |
| Audit (`auditEvents`) | **nessun evento** | evento `account-purged` | nessuno | nessuno | nessuno | `functions/index.js:530-533` |
| Ricevute (`mutationResults`) | nessuna | ricevuta `processing`/`purged` | nessuna | nessuna | nessuna | `functions/index.js:470,489-492,529` |
| Backup `.cpbackup` già esportato | intatto (file locale) | intatto | intatto | intatto | intatto | `.../settings/backup-export-service.js:161` |
| Cache del dispositivo | non ripulita | non ripulita | non ripulita | non ripulita | non ripulita | `Frontend/public/assets/js/firebase-config.js:56-58`, `offline-sync.js:110-117` |

## 7. Trabocchetti verificati e azioni non implementate

### 7.1 Trabocchetti (verificati nel codice e nelle Rules, non coperti da test)

1. **La revoca di un ospite che ha già accettato falliva per intero — provato con test e RISOLTO in M7-R5.** Le vie di revoca scrivevano, dentro la stessa transazione, una notifica in `users/{guestUid}/notifications`. Le Rules non hanno alcuna regola per `notifications`: il percorso ricade nella wildcard del proprietario (`firestore.rules:106-118`), che richiede `isOwner(userId)`. Il proprietario non è proprietario del percorso dell'ospite, quindi la scrittura era negata e — essendo dentro una transazione — **annullava anche la rimozione dell'ospite**.

   **Prova** (`tests/sharing-revocation.rules.test.mjs`, Rules **produttive**, emulatore, dati sintetici): il proprietario scrive nella propria raccolta di notifiche ma non in quella dell'ospite; la transazione di revoca **senza** la notifica all'ospite riesce (controllo); la transazione con la notifica dentro viene **rifiutata interamente** e lascia l'Account invariato.

   **Correzione (M7-R5, completata dopo la revisione Codex del 21/09/2026):** il tentativo di scrittura nella raccolta `notifications` dell'ospite è stato **eliminato dal client** in tutti i sette punti di scrittura in cinque file — `.../privato/dettaglio-privato-sharing.js`, `.../azienda/dettaglio-azienda-sharing.js`, `.../shared/detail-account-mode.js`, `.../privato/form-privato-save.js` (due punti), `.../azienda/form-azienda-save.js` (due punti). Il client **non tenta più** una scrittura che le Rules vietano: dopo il commit confermato seguono soltanto il messaggio di esito e il ricaricamento già esistenti, senza attese aggiunte. Le notifiche al **proprietario** restano dentro la transazione e le Rules non sono state ampliate. Prove: suite Rules **29/29** (comprese lettura dell'ospite prima della revoca e rifiuto dopo), `tests/share-revocation-paths.test.mjs` (guardia: nessun percorso notifiche non proprietario, nessuna attesa aggiunta dopo il commit).

   **Limite dichiarato, nessuna consegna annunciata:** la notifica all'ospite **non viene recapitata**. Serve un percorso backend dedicato (callable con Admin SDK), **non implementato**; la proposta va valutata in un incarico separato e non autorizza da sola un ampliamento delle Rules.
2. **`respondToInvitation` non incrementa `revision`.** L'accettazione aggiorna `sharedWith`, `sharedWithUids`, `acceptedCount`, `visibility` e `updatedAt` senza toccare `revision` (`functions/index.js:1231-1237`), mentre gli altri percorsi usano `increment(1)` (`.../shared/detail-account-mode.js:183`) e l'archiviazione `revision + 1` (`.../settings/archive-account-model.js:6`). Il purge richiede l'uguaglianza esatta della revisione (`functions/archive-purge-service.js:47-48`): dopo un'accettazione la revisione non descrive più lo stato del documento.
3. **Una credenziale comune collegata a un Account archiviato diventa non scollegabile e non eliminabile.** Il selettore dei collegamenti elenca solo gli Account non archiviati (`Frontend/public/assets/js/modules/settings/shared-credentials-controller.js:84,88`), mentre la callable rifiuta di eliminare una credenziale finché esistono collegamenti (`functions/index.js:294-299`, «Scollega prima tutti gli Account»). Archiviare l'Account toglie quindi l'unico modo per scollegarla.
4. **Archiviare un Account condiviso non avvisa gli ospiti e rende la revoca irraggiungibile.** L'archiviazione non tocca `sharedWithUids` e le Rules non guardano `isArchived`: l'ospite continua a vedere l'Account (`.../privato/account_privati.js:216,226-255`; il filtro `!isArchived` a `:253` vale solo per gli Account propri). Dall'Archivio non esiste un percorso verso il dettaglio dell'Account archiviato, quindi il proprietario non può revocare finché non lo ripristina.
5. **Eliminazione dalla lista e purge non erano equivalenti — RISOLTO in M7-R6 per gli Account propri.** Il pulsante «Elimina» ora **sposta nell'Archivio** tramite `archiveAccount` (archiviazione canonica con controllo di revisione) invece di cancellare il documento; la cancellazione definitiva resta soltanto dall'Archivio con `purgeArchivedAccount`. Restano invariati i limiti già dichiarati: il purge elimina solo gli allegati elencati nei metadati, e widget, credenziali comuni e inviti non vengono toccati da nessuna delle due operazioni. Le eliminazioni **dirette** di un'Azienda (`.../azienda/company-list-service.js:9`, `.../azienda/ma_save.js:204`) restano fuori da questa fetta: non sono Account e mantengono il comportamento precedente (le sottocollezioni degli Account contenuti restano).
6. **`auditEvents` è cancellabile dal proprietario nelle Rules produttive** *(stato al momento del censimento)*: nessuna regola dedicata, ricadeva nella wildcard (`firestore.rules:106-118`). **Riconciliato in M7-AUDIT-7:** nel **ramo locale** il registro è escluso dal catch-all proprietario e ha un blocco dedicato in sola lettura (M7-AUDIT-2), quindi il client non può più creare, modificare o cancellare eventi; `tests/audit-events.rules.test.mjs` lo prova. La modifica vale **solo nel ramo** finché le Rules non saranno distribuite, e `trash`/`recordHistory` restano fuori da quella fetta.
7. **Il restore di un backup riscrive anche i percorsi condivisi** (`functions/index.js:590-596`) senza toccare inviti, `accountWidgets`, `sharedVaultData` o `sharedVaultLinks`.

### 7.2 Azioni non implementate

1. **Rinuncia dell'ospite** dopo l'accettazione: non esiste alcun percorso (l'ospite può solo rifiutare un invito pendente).
2. **Rimozione dell'Account ricevuto dalla lista dell'ospite**: non implementata; l'unica via è la revoca del proprietario.
3. **Pulizia degli inviti** quando l'Account del proprietario viene eliminato o purgato: l'invito resta come documento che punta a un Account inesistente; la lista dell'ospite lo salta silenziosamente (`.../privato/account_privati.js:217-218`).
4. **Eliminazione di widget, credenziali comuni e collegamenti** durante il purge: il planner esiste ma è esplicitamente non collegato (`functions/archive-purge-reference-plan.js:16-18,32`).
5. **Eliminazione degli allegati** sull'eliminazione dalla lista: nessun percorso la esegue.
6. **Notifica all'ospite** quando il proprietario elimina dalla lista (invece della revoca): non prevista.
7. **Decifratura dell'Account ricevuto dall'ospite**: non implementata; la chiave di condivisione esiste solo come prototipo di laboratorio.
8. **Immutabilità dell'audit in produzione** e **retention a 24 mesi**: decise ma non attive (sezione M7-R3 del contratto d'area).

## 8. Opzioni decisionali per Diego

Le opzioni sono descritte in linguaggio semplice; **nessuna è decisa** da questo documento e la pulizia dei dati condivisi o la rinuncia dell'ospite non vengono proposte come obbligatorie.

| Caso | Cosa significa oggi «Elimina» | Cosa resta oggi | Opzioni da scegliere |
|---|---|---|---|
| **1** — Account proprio non condiviso | il record sparisce subito e definitivamente, **senza** passare dal cestino | metadati degli allegati e byte su Storage restano; nessun evento di audit | (a) lasciare com'è; (b) far passare «Elimina» dal cestino, così la cancellazione definitiva resta al purge; (c) lasciare com'è ma avvisare che gli allegati restano |
| **2** — Account proprio condiviso | come il caso 1; l'accesso degli ospiti decade con il documento | widget e credenziali comuni collegate restano; gli inviti restano | (a) lasciare com'è; (b) rimuovere anche i collegamenti ai widget/credenziali comuni (il planner è pronto ma inattivo); (c) avvisare gli ospiti con una notifica |
| **3** — Account ricevuto come ospite | l'ospite **non** può eliminare né archiviare: dipende dal proprietario | dopo la revoca l'ospite perde la lettura; l'invito resta come documento orfano | (a) lasciare com'è; (b) dare all'ospite un'azione di rinuncia; (c) pulire gli inviti orfani quando l'Account non esiste più |
| **4** — Account con credenziali comuni | il record sparisce ma le credenziali comuni **non** vengono toccate | `sharedVaultData`/`sharedVaultLinks` restano, anche se non più usati da quell'Account | (a) lasciare com'è (la credenziale comune può servire ad altri Account); (b) eliminare solo i collegamenti, mai il valore comune; (c) chiedere all'utente cosa fare |

Domande aperte collegate, già registrate in M7: durata e modalità del cestino (deciso: nessuna scadenza automatica), sorte dei widget/credenziali comuni dopo un purge, e comportamento dell'ospite dopo la revoca.

**Due trabocchetti della sezione 7 non sono scelte di retention ma difetti funzionali** e richiedono una decisione separata: (a) la revoca di un ospite che ha accettato può fallire per la notifica scritta nel percorso dell'ospite; (b) una credenziale comune collegata a un Account archiviato non è più scollegabile né eliminabile. Nessuno dei due è coperto da test: la correzione va valutata da Codex come incarico dedicato, non decisa qui.

## 9. Limiti e voci `non verificate`

1. **Decifratura dell'Account ricevuto dall'ospite**: `non verificata`. Le chiavi di condivisione sono un prototipo di laboratorio e l'ospite non accede alle collezioni comuni del proprietario; il comportamento reale della schermata di dettaglio richiede una prova dedicata (ambiente non produttivo o emulatori con condivisione reale).
2. **Regole effettivamente distribuite**: questo censimento legge `firestore.rules` e `storage.rules` del ramo, non ciò che è pubblicato sul progetto.
3. **Dati reali**: nessuna lettura; non è possibile dire quante condivisioni, inviti orfani o collegamenti a credenziali comuni esistano davvero.
4. **Comportamento lato server delle callable** `respondToInvitation`, `manageSharedVaultData`, `manageAccountWidget`: verificato nel codice del repository, non su un ambiente distribuito.
5. **Backup**: il contenuto effettivo di un `.cpbackup` rispetto agli Account ricevuti e alle credenziali comuni non è stato provato con un file reale.
6. **Nessun test copre le Rules produttive** per l'ospite accettato (`isAcceptedGuest()`), per la lettura di `users/{owner}/accounts` da parte di un ospite o per `invites`: i punti 2 e 3 della sezione 2 sono dimostrati dal codice e dalle Rules, non da test.
7. **Il fallimento della revoca è provato** sulle Rules produttive con l'emulatore ed è stato **corretto in M7-R5**; resta **non verificato** il comportamento dell'app reale, perché il codice corretto non è stato eseguito in un browser né contro un ambiente distribuito, e la notifica all'ospite continua a non essere consegnabile dal client.
8. **Nessun test verifica la sopravvivenza** di widget, collegamenti e inviti dopo un purge.
9. **Ambito effettivo della regola ospite**: `match /{path=**}/accounts/{accountId}` (`firestore.rules:170-172`) autorizza `get, list` su qualunque documento che termini in `/accounts/{id}`, per chiunque risulti in `sharedWithUids` di quel documento; l'effetto pratico su collezioni inattese non è verificato.

**Limiti di metodo:** censimento statico su codice, Rules e configurazione versionata; nessun test distruttivo, nessuna esecuzione contro il progetto, nessun dato reale.

## 10. Riferimenti

- [M7 — Cronologia, cestino e audit](./M7_CRONOLOGIA_CESTINO_AUDIT.md): contratto d'area, purge, riesame dei riferimenti residui.
- [M7 — Censimento retention](./M7_RETENTION_CENSIMENTO.md): comportamento attuale di cestino, audit, allegati e backup.
- [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md): cancellazione coordinata record/allegati e retention.
- Prove sintetiche collegate: `tests/sharing-revocation.rules.test.mjs` (revoca dell'ospite sulle Rules produttive, emulatore) e, per la retention audit, `experiments/history-recovery/audit-retention.test.mjs`.
- Codice citato: `firestore.rules`, `storage.rules`, `functions/index.js`, `functions/archive-purge-service.js`, `functions/archive-purge-reference-plan.js`, `Frontend/public/assets/js/modules/privato/account_privati.js`, `.../privato/form-privato-save.js`, `.../privato/dettaglio-privato-sharing.js`, `.../privato/private-account-offline-policy.js`, `.../privato/profilo-links.js`, `.../azienda/account_azienda.js`, `.../azienda/form-azienda-save.js`, `.../azienda/dettaglio-azienda-sharing.js`, `.../azienda/company-profile-ui.js`, `.../azienda/company-profile-link.js`, `.../shared/detail-account-mode.js`, `.../shared/profile-account-management.js`, `.../settings/archive-account-service.js`, `.../settings/backup-export-service.js`, `Frontend/public/assets/js/main-v129.js`, `Frontend/public/assets/js/offline-sync.js`, `Frontend/public/assets/js/firebase-config.js`.
