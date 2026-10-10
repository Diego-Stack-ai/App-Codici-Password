# Profilo e account

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

Dossier dei candidati Profilo/Account: decisioni architetturali e schede A1b–A6. Le parti implementate nel laboratorio non sono automaticamente distribuite. L’ultima fotografia operativa è STATO; qui restano schema, limiti e criteri del dominio. La cronologia della roadmap è nello storico.

## Decisione corrente: profilo e istanza Widget

- **Profilo Widget:** modello riutilizzabile con categoria `account` oppure `bank`, titolo, descrizione, aspetto e definizione ordinata dei campi. Non contiene valori.
- **Widget inserito:** istanza collegata a uno specifico Account o conto bancario; conserva `profileId` e i valori di quella sola destinazione.
- I cataloghi Account e Banca sono indipendenti. Un profilo bancario non appare nel catalogo Account e viceversa.
- Un nuovo profilo non riceve campi predefiniti: l'utente aggiunge liberamente almeno un campo.
- Lo stesso profilo può essere riutilizzato in destinazioni diverse, ma non due volte nello stesso Account o nello stesso conto.
- I widget legacy senza profilo restano compatibili; non vengono convertiti automaticamente.
- Modificare i valori di un'istanza non modifica il profilo né le altre istanze. La gestione strutturale del profilo resta un'operazione separata.

## Indice delle fonti conservate

- [A1B_CENSIMENTO_CONTATTI_AZIENDALI.md](#fonte-docs-a1b-censimento-contatti-aziendali-md-l1)
- [A2_CENSIMENTO_INDIRIZZI.md](#fonte-docs-a2-censimento-indirizzi-md-l1)
- [A3_CENSIMENTO_UTENZE.md](#fonte-docs-a3-censimento-utenze-md-l1)
- [A4_CENSIMENTO_DOCUMENTI.md](#fonte-docs-a4-censimento-documenti-md-l1)
- [PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md](#fonte-docs-profilo-account-widget-cache-roadmap-md-l477)
- [PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md](#fonte-docs-profilo-account-widget-cache-roadmap-md-l685)
- [A5_CREAZIONE_ACCOUNT_DAL_COLLEGAMENTO.md](#fonte-experiments-persistent-vault-shell-docs-a5-creazione-account-dal-collegamento-md-l1)
- [A6_EDITOR_CREDENZIALI_STANDARD.md](#fonte-experiments-persistent-vault-shell-docs-a6-editor-credenziali-standard-md-l1)

<a id="fonte-docs-a1b-censimento-contatti-aziendali-md-l1"></a>

## Fonte: A1B_CENSIMENTO_CONTATTI_AZIENDALI.md — righe originali 1–41

> Provenienza: `docs/A1B_CENSIMENTO_CONTATTI_AZIENDALI.md` a `2900ccc0`.

<a id="fonte-docs-a1b-censimento-contatti-aziendali-md-a1b--censimento-dello-schema-contatti-aziendali-prima-del-codice"></a>

## A1b — Censimento dello schema contatti aziendali (prima del codice)

> **Stato:** censimento in corso, verificato sulle fonti indicate; **nessun codice scritto**, nessuna modifica a `Frontend/public/**`, Rules/Functions produttive, versione, `master`, deploy, dati o migrazioni reali.
> **Base:** `5316111c`; presa in carico pubblicata in `7e72cdb3`.
> **Fonti lette in questo censimento:** `experiments/persistent-vault-shell/company-profile-source.mjs`, `Frontend/public/assets/js/modules/azienda/company-profile-model.js` (sola lettura).

<a id="fonte-docs-a1b-censimento-contatti-aziendali-md-1-forma-dello-schema-verificata"></a>

### 1. Forma dello schema (verificata)

| Elemento | Forma | Note |
|---|---|---|
| `emails.pec`, `emails.amministrazione`, `emails.personale` | **oggetto**, non stringa | campi osservati: `email` (indirizzo), `tipo` (etichetta migliore già presente), più i campi di collegamento Account |
| `emails.extra` | **lista ripetibile** di oggetti | `id` opzionale; il modello UI sintetizza `extra-<index>` quando manca |
| `telefonoAzienda`, `faxAzienda`, `referenteCellulare` | **slot fissi** con etichetta da `phoneLabels` | il valore vive nel campo top-level omonimo |
| `phoneAccountLinks[<id contatto>]` | mappa di collegamenti | per i telefoni il collegamento è per identificativo di contatto |
| `emails[<slot>]` / `emails.extra[<sourceIndex>]` | collegamento scritto **nello stesso oggetto** | l'email conserva indirizzo, etichetta e collegamento insieme |
| `aziendaEmail` | campo top-level **legacy** | fallback di sola lettura per `pec` quando `emails.pec.email` manca |

**Conseguenze già visibili, da rispettare nel contratto A1b:**

1. **Slot fissi ≠ liste ripetibili.** I tre slot email e i tre telefoni non si cancellano: la semantica è lo **svuotamento** del campo, coerente con l'incarico («gli slot fissi non devono essere cancellati se la semantica richiede lo svuotamento»).
2. **Nessun ID dall'indice.** `emails.extra` senza `id` riceve in UI `extra-<index>` e il modello scrive i collegamenti per `sourceIndex`: un ID sintetico così prodotto **non va mai persistito** né usato come identità di riga. Una riga `extra` senza `id` stabile resta consultabile e **non modificabile**, oppure richiede una migrazione separata e mai implicita.
3. **Campi sconosciuti e legacy si conservano.** `company-profile-source.mjs` valida la forma (`emails` oggetto; i tre slot oggetto; `emails.extra`, `altreSedi`, `allegati` liste di oggetti) e poi **diffonde** il record con `{...record, …}`: nessuna normalizzazione distruttiva, i campi non riconosciuti restano. Il fallback `aziendaEmail` e le password legacy non sono toccati.
4. **La sorgente di laboratorio esiste già ed è di sola lettura**: `createCompanyProfileSource` usa `normalizeContacts(record)` per proiettare i contatti aziendali nella forma privata (`contactEmails`/`contactPhones`) **senza segreti**, e serve la sezione profilo. A1b deve aggiungere una via di scrittura separata, non piegare quella.

<a id="fonte-docs-a1b-censimento-contatti-aziendali-md-2-da-verificare-prima-di-scrivere-il-contratto"></a>

### 2. Da verificare prima di scrivere il contratto

- Contratto dei collegamenti (`profile-link-contract.mjs`, `profile-link-handler.mjs`) e come `linkedAccountId` / `linkedAccountCompanyId` sono validati oggi sui contatti **privati**, per riusare le stesse regole senza inventare equivalenze.
- Selezione QR **aziendale** (`company-qr-selection-contract.mjs`, `company-qr-selection-handler.mjs`) e `qrConfig`: quali contatti aziendali possono essere inclusi e come si riconosce un riferimento posizionale legacy.
- Fixture browser aziendali in `emulator-browser.mjs` (righe `aziende/company` e `second-company`): servono casi con slot pieni, slot vuoti, `extra` con e senza `id`, collegamenti Account e QR.
- Campi di classificazione cifrata già in uso per l'azienda (quali valori sono cifrati e con quale formato) per non introdurre una cifratura diversa da quella esistente.

<a id="fonte-docs-a1b-censimento-contatti-aziendali-md-3-vincoli-confermati-dallincarico"></a>

### 3. Vincoli confermati dall'incarico

- Contratto/allowlist aziendale **separato** da quello privato: nessuna conversione dell'azienda al formato privato.
- Fail-closed: contatti collegati a un Account o inclusi nel QR non si eliminano; configurazioni QR ambigue o illeggibili bloccano la cancellazione senza impedire la consultazione.
- Solo online, rilettura server confermata, aggiornamento immediato della linguetta; offline in sola consultazione; scarto locale delle righe nuove non salvate.
- Nessuna migrazione implicita, nessun dato reale, nessuna modifica a Rules/Functions produttive (solo Rules candidate per gli emulatori).

<a id="fonte-docs-a1b-censimento-contatti-aziendali-md-4-passo-immediatamente-successivo"></a>

### 4. Passo immediatamente successivo

Completare il punto 2 e produrre una **fixture di contratto** che rappresenti: i tre slot fissi (pieni e vuoti), `emails.extra` con e senza `id`, i tre telefoni, `phoneAccountLinks`, un collegamento Account e una selezione QR aziendale — quindi il contratto con allowlist aziendale e i suoi test, prima di qualsiasi editor.

<a id="fonte-docs-a2-censimento-indirizzi-md-l1"></a>

## Fonte: A2_CENSIMENTO_INDIRIZZI.md — righe originali 1–51

> Provenienza: `docs/A2_CENSIMENTO_INDIRIZZI.md` a `2900ccc0`.

<a id="fonte-docs-a2-censimento-indirizzi-md-a2--censimento-e-decisioni-per-leditor-indirizzi-prima-del-codice"></a>

## A2 — Censimento e decisioni per l'editor indirizzi (prima del codice)

> **Stato:** censimento verificato sui writer e sui modelli reali; le mutazioni candidate sono descritte qui e implementate in `experiments/persistent-vault-shell/**`. **Nessun codice di produzione toccato**, nessuna modifica a `Frontend/public/**`, Rules/Functions produttive, versione, `master`, deploy, dati o migrazioni reali.
> **Base:** `372b87d7`; presa in carico pubblicata in `8c68e0c8`.
> **Fonti lette:** `Frontend/public/assets/js/modules/privato/profilo-sync.js`, `profilo-actions.js`, `profilo_privato.js`, `profile-model.js`, `profilo-addresses-docs.js`, `azienda/ma_save.js`, `azienda/company-vcard.js`, `shared/qr_code_utils.js`, e i contratti di laboratorio `qr-selection-contract.mjs`, `profile-link-contract.mjs`, `profile-link-origin.mjs`, `profile-link-plan.mjs`.

<a id="fonte-docs-a2-censimento-indirizzi-md-1-indirizzi-privati--usersuiduseraddresses"></a>

### 1. Indirizzi privati — `users/{uid}.userAddresses[]`

| Elemento | Forma verificata | Fonte |
|---|---|---|
| riga indirizzo | **lista ripetibile** di oggetti | `profilo-actions.js:99-105` |
| campi | `type` (etichetta, da `addressTypes`), `address`, `civic`, `cap`, `city`, `province`, `isPrimary`, `utilities[]` | `profilo-actions.js:82-93` |
| etichette | `['Residenza','Domicilio','Ufficio','Altro']` | `profilo_privato.js:45` |
| identità | nuova riga `address-<uuid>` (`createProfileItemId('address')`); riga legacy **senza** `id` riceve in sola lettura `stableLegacyId` = `address-legacy-<fnv1a36>` calcolato anche **dall'indice** | `profilo-actions.js:100`, `profile-model.js:113-125` |
| cifratura | **tutti i campi dell'indirizzo in chiaro**; solo `utilities[].value` è cifrato («V7.5: Indirizzo in chiaro, solo Utenze cifrate») | `profilo-sync.js:72-80` |
| principale | `isPrimary` booleano, **esclusivo**: impostarne uno azzera gli altri | `profilo-actions.js:98` |
| utenze | lista annidata `utilities[]`: `type` (da `utilityTypes`), `value` (cifrato), `id` = `utility-<uuid>`, più `linkedAccountId`/`linkedAccountCompanyId` e campi sconosciuti | `profilo-actions.js:209-238`, `profilo-sync.js:76-79` |
| etichette utenze | `['Codice POD','Contatore Acqua','Contatore Metano','Fibra','Altro']` | `profilo_privato.js:46` |
| eliminazione legacy | cancella l'indirizzo **senza controllare** utenze o collegamenti, poi «rinfresca» i riferimenti Account | `profilo_privato.js:421-435` |
| QR | `qrCodeInclusions.addresses` è una lista di id (o di indici legacy) risolta da `preparePrivateQrSelection` | `qr_code_utils.js:56-58`, `profile-model.js:195` |

**Decisioni A2 (privato).**
1. **Nessun ID dall'indice**: un id che contiene `-legacy-` è un'identità derivata e non persistita → la riga resta **consultabile e non modificabile** (nessuna migrazione implicita).
2. Solo i campi dell'allowlist sono modificabili (`type`, `address`, `civic`, `cap`, `city`, `province`, `isPrimary`); **campi sconosciuti, utenze e collegamenti sono preservati byte per byte**.
3. L'eliminazione di un indirizzo è **rifiutata** se contiene utenze o un riferimento Account (`linkedAccountId`/`linkedAccountCompanyId`) su di sé; uno stato QR non risolvibile canonicamente blocca l'eliminazione in fail-closed senza impedire consultazione e modifiche non distruttive; un indirizzo incluso nella tessera digitale non si elimina.
4. L'eliminazione di un'**utenza** non appartiene a questa fetta (editor utenze = incarico successivo): A2 modifica gli indirizzi e lascia `utilities[]` intatto.
5. `isPrimary` è applicato dal servizio: al più un indirizzo principale, e l'esclusività è parte della transazione.
6. Solo online, rilettura confermata, scarto locale della riga nuova non salvata, doppia conferma per l'eliminazione persistita — come A1/A1b.

<a id="fonte-docs-a2-censimento-indirizzi-md-2-indirizzi-aziendali--usersuidaziendecompanyid"></a>

### 2. Indirizzi aziendali — `users/{uid}/aziende/{companyId}`

| Elemento | Forma verificata | Fonte |
|---|---|---|
| sede fissa | campi **top-level** `indirizzoSede`, `civicoSede`, `cittaSede`, `provinciaSede`, `capSede`, `tipoSedeLegale` (stringhe in chiaro) | `ma_save.js:75,85-91` |
| sedi ripetibili | `altreSedi[]` con `id`, `tipo`, `indirizzo`, `civico`, `citta`, `provincia`, `cap`, `qr` | `ma_save.js:61-71` |
| identità | il writer legacy riusa `item.id` **oppure sintetizza `sede-<indice>`** e lo riscrive nel record | `ma_save.js:62-63` |
| cifratura | **nessuna**: tutti i campi degli indirizzi aziendali sono in chiaro | `ma_save.js:61-91` |
| QR | la sede fissa è pubblicata salvo `qrConfig.qrLegale === false`; una sede ripetibile è pubblicata salvo `qr === false` | `company-vcard.js:76-90` |
| collegamenti Account | gli indirizzi aziendali **non** sono origini di collegamento (`profileLinkSource` ammette solo gli slot e-mail/telefono aziendali) | `profile-link-contract.mjs:15-18` |

**Decisioni A2 (azienda).**
1. Un id `sede-<indice>` è **derivato**: la riga resta consultabile e non modificabile.
2. La sede fissa è **modificabile ma non cancellabile**: si svuota/aggiorna campo per campo, l'oggetto/ i campi top-level sopravvivono.
3. Le sedi ripetibili ammettono creazione (`sede-<uuid>`), modifica e eliminazione solo con identità stabile; una sede pubblicata sulla tessera non si elimina; una configurazione QR ambigua o illeggibile blocca l'eliminazione in fail-closed.
4. Campi sconosciuti, `qrConfig`, `altreSedi` non toccate e ogni altra chiave del documento sono preservati; revisione e ricevuta separate da quelle dei contatti aziendali.

<a id="fonte-docs-a2-censimento-indirizzi-md-3-riuso-e-separazione"></a>

### 3. Riuso e separazione

- I due schemi **non si convertono l'uno nell'altro**: due contratti, due allowlist, due servizi, due metadati di revisione (`_profileAddresses*` per il privato, `_companyAddresses*` per l'azienda).
- Si riusano soltanto helper già provati: il contratto QR privato canonico (`preparePrivateQrSelection`) e la serializzazione stabile dell'impronta (stesso algoritmo, codici di rifiuto propri di ciascuna fetta).
- Rules candidate, endpoint e prove restano confinati al laboratorio; nessuna Rules/Function produttiva viene modificata.

<a id="fonte-docs-a3-censimento-utenze-md-l1"></a>

## Fonte: A3_CENSIMENTO_UTENZE.md — righe originali 1–34

> Provenienza: `docs/A3_CENSIMENTO_UTENZE.md` a `2900ccc0`.

<a id="fonte-docs-a3-censimento-utenze-md-a3--censimento-dello-schema-utenze-annidate-prima-del-codice"></a>

## A3 — Censimento dello schema utenze annidate (prima del codice)

> **Stato:** censimento verificato sui modelli e sui writer reali; **nessun codice di produzione toccato**, nessuna modifica a `Frontend/public/**`, Rules/Functions produttive, versione, `master`, deploy, dati o migrazioni reali.
> **Base:** `6f1a8b99`; presa in carico pubblicata in `761cfaa1`.
> **Fonti lette:** `Frontend/public/assets/js/modules/privato/profilo-actions.js`, `profilo-sync.js`, `profile-model.js`, `profilo-addresses-docs.js`, `profilo_privato.js`, `modules/azienda/*.js`, e i contratti di laboratorio `profile-link-contract.mjs`, `profile-link-plan.mjs`, `private-addresses-contract.mjs`.

<a id="fonte-docs-a3-censimento-utenze-md-1-forma-verificata--usersuiduseraddressesutilities"></a>

### 1. Forma verificata — `users/{uid}.userAddresses[].utilities[]`

| Elemento | Forma verificata | Fonte |
|---|---|---|
| posizione | lista **annidata dentro l'indirizzo padre**; non esiste una collezione di primo livello | `profilo-addresses-docs.js:112,127` |
| campi esposti dal writer | `type` (da `utilityTypes` = `Codice POD`, `Contatore Acqua`, `Contatore Metano`, `Fibra`, `Altro`) e `value` | `profilo-actions.js:209-238`, `profilo_privato.js:46` |
| identità nuova | `utility-<uuid>` (`createProfileItemId('utility')`) | `profilo-actions.js:217` |
| identità legacy | `stableLegacyId('utility-<idIndirizzo>', item, index)` → `utility-<idIndirizzo>-legacy-<hash>`: dipende dal contenuto **e dalla posizione**, e contiene l'id dell'indirizzo | `profile-model.js:113-125,140` |
| cifratura | **solo `value` è cifrato**; `type` e ogni altro campo restano in chiaro | `profilo-sync.js:72-80` |
| collegamenti Account | `linkedAccountId` / `linkedAccountCompanyId` scritti **nell'utenza**; i riferimenti inversi vivono sull'Account (`linkedProfileFields`) con `{type:'utility', id, parentAddressId}` | `profile-model.js:218-220`, `profile-link-contract.mjs:21` |
| identità composta | un'utenza è identificata da `(type:'utility', id, parentAddressId)`: due indirizzi possono avere un'utenza con lo stesso `id` | `profile-model.js:209-211` |
| patch canonica | il modello sostituisce **la sola riga** dentro l'indirizzo padre (`{...address, utilities: address.utilities.map(...)}`) | `profile-model.js:213` |
| QR | `qrCodeInclusions.addresses` seleziona l'indirizzo, ma il generatore pubblica **solo** la riga `ADR` (indirizzo, civico, città, CAP) e **non serializza** `utilities[]`: l'utenza non entra nella tessera | `qr_code_utils-v2.js:70-73` |
| eliminazione legacy | `deleteUtility` rimuove la riga e poi «rinfresca» i riferimenti Account dell'utenza rimossa | `profilo_privato.js:437-448` |

<a id="fonte-docs-a3-censimento-utenze-md-2-schema-aziendale-equivalente-non-esiste"></a>

### 2. Schema aziendale equivalente: **non esiste**

Nei moduli aziendali (`modules/azienda/**`) la parola «utility» compare **solo** come *tipo di collegamento* (`profileContactLinkDraft.contactType === 'utility'`, `form_account_azienda.js:68,111,120`, `form-azienda-save.js:172`): è l'origine **privata** di un collegamento, non una collezione aziendale. Il documento aziendale (`ma_save.js`) non scrive né legge alcun campo `utilities`; le sue liste ripetibili sono `emails.extra` e `altreSedi`. **Conclusione: nessuna estensione aziendale in questo incarico**, come previsto dall'incarico stesso; se servirà, richiederà un contratto e uno schema propri, mai una conversione del privato.

<a id="fonte-docs-a3-censimento-utenze-md-3-decisioni-a3-verificabili"></a>

### 3. Decisioni A3 (verificabili)

1. **Perimetro di scrittura**: la sola proprietà `utilities` dell'indirizzo padre. Il servizio sostituisce l'array delle utenze di quell'indirizzo e nient'altro: l'indirizzo padre, le altre utenze, gli altri indirizzi e ogni altro campo del profilo restano byte per byte.
2. **Allowlist dedicata**: `type` (in chiaro) e `value` (cifrato, forma memorizzata preservata). Nessun altro campo entra in un comando, quindi **campi sconosciuti e password legacy sopravvivono per costruzione**.
3. **Identità**: nuova `utility-<uuid>`; un id che contiene `-legacy-` è **derivato** e la riga resta consultabile e **non modificabile**, in nessun percorso, nemmeno in una richiesta costruita a mano.
4. **Identità composta**: la richiesta porta `parentAddressId`; il servizio verifica che esista **esattamente un** indirizzo con quell'id e che l'utenza sia trovata **dentro quell'indirizzo**.
5. **Eliminazione vietata** solo se l'utenza ha un riferimento Account. La selezione QR dell'indirizzo **non** blocca la singola utenza: la tessera pubblica solo la riga `ADR` e non le utenze (correzione A3-R1, dopo che il primo blocco aveva introdotto una guardia non verificata). Consultazione e modifiche non distruttive restano sempre possibili; identità derivate e riferimenti ambigui restano fail-closed.
6. **Revisione separata** (`_profileUtilitiesRevision`/`_profileUtilitiesSchemaVersion`/`_profileUtilitiesUpdatedAt`), impronta dell'intera riga, ricevuta idempotente in `mutationResults/{uid}/operations/profile-utilities-{operationId}`, letture prima delle scritture e nessuna scrittura parziale.
7. Solo online, rilettura confermata, scarto locale della riga nuova non salvata, doppia conferma per l'eliminazione persistita.

<a id="fonte-docs-a4-censimento-documenti-md-l1"></a>

## Fonte: A4_CENSIMENTO_DOCUMENTI.md — righe originali 1–11

> Provenienza: `docs/A4_CENSIMENTO_DOCUMENTI.md` a `2900ccc0`.

<a id="fonte-docs-a4-censimento-documenti-md-a4--censimento-documenti-del-profilo"></a>

## A4 — censimento documenti del profilo

Il profilo privato conserva i documenti nell'array `users/{uid}.documenti[]`. Il writer reale assegna alle nuove righe `document-<uuid>`; `profile-model.js` sintetizza invece `document-legacy-<hash>` quando manca l'ID, usando contenuto e posizione. Quell'identità derivata non è persistita: la riga resta consultabile ma non è modificabile né eliminabile.

I campi cifrati dal writer `profilo-sync.js` sono `num_serie`, `cf_value`, `id_number`, `license_number`, `cf`, `rilasciato_da`, `luogo_rilascio`, `username`, `password`, `pin`, `puk`, `codice_app`, `note`, `categoria` e `home_page`. `type`, `name`, `data_rilascio`, `expiry_date` e `isPrimary` restano in chiaro. Il contratto A4 ammette soltanto questi campi e conserva byte per byte chiavi sconosciute, `linkedAccountId`, `linkedAccountCompanyId` ed `expiryReference`.

Il collegamento Account è nella riga documento e usa il servizio profilo già esistente. Gli allegati immagine sono record distinti in `users/{uid}/profileDocumentAttachments/{attachmentId}` e il loro flusso DS-002 non viene duplicato. Una cancellazione legge quei record nella stessa transazione e si arresta se ne esiste almeno uno. Il QR non contiene un elenco di documenti: `qr_code_utils-v2.js` ricava il codice fiscale dalla prima riga il cui tipo contiene “fiscale” quando `settings/qrCodeInclusions.cf` è vero. Perciò l'eliminazione di quella riga è bloccata; una configurazione non canonica blocca ogni eliminazione in fail-closed.

Il profilo aziendale non espone una collezione equivalente a `documenti[]`. Conserva soltanto `allegati[]` nell'anagrafica azienda, con writer e Storage legacy separati. A4 non converte quegli allegati in documenti privati, non inventa ID o campi e non monta un editor documenti aziendale.

La mutazione candidata aggiorna l'intero array soltanto dentro una transazione con revisione, impronta della riga e ricevuta idempotente. La sorgente rilegge il profilo confermato prima di preparare, cifra localmente i soli campi classificati, revoca su lock/logout/cambio UID/cambio sezione e non consente scritture offline.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-l477"></a>

## Fonte: PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md — righe originali 477–648

> Provenienza: `docs/PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md` a `2900ccc0`.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-b--piano-architetturale"></a>

### B — Piano architetturale

Prima di modifiche strutturali devono essere approvati:

- file e flussi interessati;
- strategia generale **read-your-writes** senza fetch server indiscriminati;
- comportamento online, offline e durante la riconnessione;
- modello compatibile per widget, campi e template;
- trattamento dei campi legacy e, solo se indispensabile, migrazione idempotente e reversibile;
- rischi, rollback e matrice dei test.

La soluzione read-your-writes dovrà distinguere le normali letture cache-first dalle letture successive a una scrittura confermata. Le alternative da confrontare sono aggiornamento/invalida­zione controllata della cache, passaggio del dato appena scritto o lettura server-confirmed mirata.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-decisioni-funzionali-approvate"></a>

#### Decisioni funzionali approvate

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-account-e-memorandum"></a>

##### Account e Memorandum

- Account e Account condiviso possono contenere `username`, `account/utente/codice` e `password`.
- Memorandum e Memorandum condiviso non possono contenere questi tre valori e non devono mostrarne i campi.
- Il passaggio a Memorandum è bloccato finché l'utente non svuota consapevolmente le credenziali; non si conservano copie nascoste.
- Se un Memorandum torna Account, i tre campi ricompaiono vuoti.
- Note, sito, widget e allegati restano disponibili in tutte le tipologie.
- La validazione deve esistere nel dominio/repository o backend, non soltanto nella UI.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-corpo-dinamico-della-pagina"></a>

##### Corpo dinamico della pagina

La struttura desiderata è: dati standard, note, corpo dinamico dei widget, allegati, tipologia/condivisione e comandi. Il corpo può allungarsi verticalmente e contenere widget singoli o composti. Widget e campi sono ordinabili; su touch è previsto un blocco/sblocco esplicito dell'ordinamento per evitare trascinamenti involontari.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-credenziali-comuni"></a>

##### Credenziali comuni

È approvata una terza area autonoma, provvisoriamente denominata **Credenziali comuni** o **Dati comuni protetti**. Non è un Account privato o aziendale e non appartiene a una singola Azienda. Conserva una sola istanza cifrata di un dato realmente riutilizzato, per esempio il codice generale dell'app Legal Mail collegato agli Account PEC di aziende differenti.

Una Credenziale comune usa lo stesso contratto `widget + fields` e può quindi contenere uno o più campi normali o sensibili. Negli Account appare come **widget collegato**, contenente soltanto un riferimento; non viene duplicato il valore.

Si distinguono:

- **widget incorporato**: appartiene a un solo Account;
- **widget collegato**: riferisce una Credenziale comune centrale utilizzabile da più Account.

La Credenziale comune è di proprietà dell'utente che la crea. Gli Account collegati non ne diventano proprietari. Un destinatario di un Account condiviso non riceve automaticamente accesso alla Credenziale comune e non può modificarla senza un permesso separato ed esplicito.

Accessi previsti:

- Impostazioni → Credenziali comuni: creazione, modifica, elenco dei collegamenti, autorizzazioni e rimozione;
- Account → Credenziali comuni: collega un dato esistente oppure crea un nuovo dato centrale e collega automaticamente l'Account corrente.

Creazione centrale e collegamento devono costituire un'unica operazione atomica. La modifica deve avvisare quanti Account saranno interessati. L'eliminazione deve essere bloccata finché esistono collegamenti, mentre lo scollegamento del singolo Account non elimina il dato centrale.

Il percorso centrale è `users/{uid}/sharedVaultData/{datoId}`. Rules, backup, funzione atomica e prima UI applicativa sono attivi. Il collaudo reale ha confermato creazione di una Credenziale con più campi e collegamento ad Account privati e aziendali; nessuna migrazione legacy è stata eseguita.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-dati-azienda-ed-emailpec"></a>

##### Dati azienda ed email/PEC

La pagina **Dati azienda** deve essere riesaminata come famiglia funzionale parallela al Profilo personale, mantenendo però il proprio modello aziendale. La revisione comprende gerarchia e leggibilità di panoramica/modifica, recapiti, sedi, documenti, dati fiscali, widget e collegamenti; non autorizza una riscrittura né una migrazione automatica dei record esistenti.

Per email e PEC il collegamento approvato è a livelli:

`Email o PEC aziendale → Account aziendale di riferimento → eventuale Credenziale comune`

L'indirizzo email/PEC resta un recapito dell'Azienda. Username, password e altri dati di accesso appartengono all'Account aziendale collegato. Un codice condiviso da più Account, come il codice generale di un'app, appartiene invece alla Credenziale comune richiamata dagli Account interessati. Non è previsto un collegamento diretto Email/PEC → Credenziale comune.

Prima di attivare il collegamento occorre:

- censire i formati legacy `emails.pec`, `emails.amministrazione`, `emails.personale`, `emails.extra[]` e `aziendaEmailPassword`;
- introdurre un identificativo stabile per ogni recapito che ne sia privo;
- verificare l'esistenza dell'Account aziendale corretto e conservare sempre `aziendaId`;
- trasferire e verificare ogni password legacy prima di rimuoverla dal documento Azienda;
- impedire collegamenti a Account privati o appartenenti a un'altra Azienda;
- mostrare nella panoramica lo stato del collegamento senza duplicare o rivelare la password;
- includere backup, ripristino, cache e scollegamento controllato nei test.

La migrazione resta manuale e assistita: l'utente crea o conferma l'Account di riferimento, verifica la credenziale trasferita e solo dopo autorizza la rimozione della copia legacy. Nessuna password aziendale viene svuotata automaticamente.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-prevenzione-duplicati"></a>

##### Prevenzione duplicati

È prevista una ricerca locale preventiva mentre si digita il nome di Account o Memorandum. Normalizzazione, parole in ordine diverso e piccoli errori di battitura producono suggerimenti, mai un blocco assoluto. Il confronto rispetta il perimetro privato/azienda, non usa password e permette sempre di creare legittimamente due Account distinti.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-c--implementazione-per-blocchi"></a>

### C — Implementazione per blocchi

Ordine previsto:

1. correggere in modo generale modifica → salva → dettaglio per account privati e aziendali;
2. rendere coerenti i percorsi aziendali e il trasporto di `aziendaId`;
3. mettere in sicurezza il collegamento email → Account senza perdita di password legacy;
4. completare il modello dei widget incorporati negli Account, senza migrare banking o referente legacy;
5. introdurre la libreria dei template come definizioni, separata dalle istanze associate agli Account;
6. rivisitare Dati azienda e predisporre il collegamento Email/PEC → Account aziendale con migrazione assistita e non distruttiva;
7. collaudare la catena Account aziendale → Credenziale comune e l'isolamento fra aziende;
8. valutare ulteriori dati condivisi di servizio/dispositivo solo su casi reali ricorrenti, senza creare prematuramente una nuova entità `Servizio`.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-modello-widget-desiderato"></a>

### Modello widget desiderato

- **Widget**: contenitore o sezione associabile a profilo, Account privato o Account aziendale.
- **Fields**: array di uno o più campi; non esistono architetture separate per widget semplice e complesso.
- **Template**: sola definizione riutilizzabile della struttura.
- **Istanza**: widget effettivo con dati appartenenti a uno specifico contesto.

I primi template candidati derivano dalle strutture già presenti: referente, banking e domande di sicurezza. Non si duplicano campi o validazioni già esistenti senza aver prima valutato un adattatore o uno schema comune.

Ogni field sensibile deve essere cifrato, escluso da QR e anteprime in chiaro, protetto dallo stato della Vault e mai indicizzato o registrato senza protezione.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-contratto-tecnico-candidato--10092026"></a>

#### Contratto tecnico candidato — 10/09/2026

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-collocazione-dei-dati"></a>

##### Collocazione dei dati

I widget Account non vengono incorporati nel documento Account. Usano collezioni proprietarie dedicate:

- widget privati e aziendali: `users/{uid}/accountWidgets/{widgetId}`;
- centrale: `users/{uid}/sharedVaultData/{sharedDataId}`;
- indice dei collegamenti: `users/{uid}/sharedVaultLinks/{linkId}`.

Le collezioni separate evitano di avvicinarsi al limite Firestore del singolo Account, impediscono che il riordino riscriva l'intero Account e riducono i conflitti con le credenziali standard. Sono state preferite alle sottocollezioni annidate perché l'attuale Rule generica su `accounts` e `aziende` renderebbe impossibile applicare una validazione più stretta ai soli widget senza un refactor rischioso delle regole esistenti.

Ogni documento nella collezione proprietaria `accountWidgets` ha un solo contratto e un discriminante:

- `kind: embedded`: contiene `fields[]` ed è proprietà dell'Account;
- `kind: shared-reference`: contiene `sharedDataId` e metadati di presentazione/ordine, ma nessuna copia dei valori centrali.

Campi comuni candidati: `context`, `accountId`, `companyId` solo per il contesto aziendale, `title`, `description`, `icon`, `color`, `order`, `collapsed`, `schemaVersion`, `createdAt`, `updatedAt` e `revision`. Un widget incorporato aggiunge `fields[]`; un riferimento aggiunge esclusivamente `sharedDataId`. Lo schema dei field riusa quello già collaudato in `profileWidgets`, inclusi identificativo stabile, tipo, etichetta, ordine, valore cifrato per i dati sensibili e divieto di esposizione in QR/anteprime.

La Credenziale comune centrale usa lo stesso modello `fields[]`, con titolo e metadati propri. Non contiene una lista duplicata degli Account nel documento principale: i collegamenti stanno in `sharedVaultLinks`, priva di segreti. Ciascun link identifica `sharedDataId`, contesto (`private` o `company`), `accountId` e, se necessario, `companyId`.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-coerenza-e-proprietà"></a>

##### Coerenza e proprietà

Creazione centrale + collegamento, collegamento esistente e scollegamento devono essere operazioni atomiche che aggiornano insieme il riferimento nell'Account e l'indice centrale. Un identificativo deterministico del collegamento impedisce di collegare due volte la stessa Credenziale allo stesso Account.

La rimozione della Credenziale centrale è rifiutata se esiste almeno un link. Poiché una Rule non può garantire da sola l'assenza di documenti arbitrari in una sottocollezione, creazione/collegamento/scollegamento/eliminazione passano da una funzione backend validata. Le normali letture restano disponibili al proprietario. Nessun destinatario di Account condiviso eredita il dato centrale: il widget collegato mostra uno stato non disponibile, salvo una futura condivisione esplicita separata.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-ordinamento"></a>

##### Ordinamento

Widget incorporati e collegati condividono lo stesso campo `order`, quindi possono essere intercalati nella pagina. Il riordino touch è consentito soltanto dopo **Sblocca ordinamento** e si conclude con un salvataggio esplicito. Il riordino aggiorna soltanto i documenti interessati e non i dati Account. Non si introduce ora il trascinamento dei singoli campi: l'ordine dei field resta quello dell'array del widget.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-template"></a>

##### Template

I template predefiniti sono manifest statici versionati distribuiti con l'app: descrivono struttura e validazioni, non contengono valori utente e non richiedono Firestore. La creazione copia la struttura in una nuova istanza, così un aggiornamento futuro del template non altera silenziosamente i widget esistenti.

Prima libreria candidata, da approvare dopo il confronto con i wizard esistenti:

- Informazioni referente;
- Dati bancari;
- Domande di sicurezza;
- campo singolo personalizzato.

Banking e referente legacy non vengono migrati né rimossi in questa fase. Il template potrà riusarne nomi, tipi e validazioni, ma rimarrà una nuova istanza indipendente finché non sarà definita una migrazione esplicita.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-backup-e-ripristino"></a>

##### Backup e ripristino

Il backup attuale esporta `profileWidgets`, ma non conosce widget Account, Credenziali comuni o relativi link. Prima di rendere scrivibile la nuova UI occorre aggiungere scope distinti per:

- widget Account privato;
- widget Account aziendale;
- Credenziale comune;
- link della Credenziale comune.

Il ripristino deve ricostruire prima i documenti centrali e poi i riferimenti, validare proprietario e percorsi, descrivere chiaramente titolo e Account nell'anteprima e non creare riferimenti orfani. Il backup rimane cifrato; gli allegati conservano il flusso separato già esistente.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-offline-e-coda-m6"></a>

##### Offline e coda M6

I widget incorporati potranno entrare nel normale offline-first solo dopo una mutation dedicata e test di conflitto. Le Credenziali comuni coinvolgono più documenti e, nella prima versione, sono **consultabili dalla cache ma creabili, modificabili, collegabili e scollegabili soltanto online**. Questa limitazione è intenzionale e deve essere dichiarata nella UI; evita code parziali o riferimenti orfani. L'estensione offline sarà valutata dopo la certificazione degli account semplici e degli allegati.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-rules-e-limiti"></a>

##### Rules e limiti

Le nuove collezioni non devono ricadere semplicemente nella regola generica proprietario. Servono Rules nominate che limitino chiavi, tipi, numero massimo di field, lunghezze, `kind`, contesto e versione schema. La validazione profonda già insufficiente in `profileWidgets` va centralizzata in un modello condiviso lato client/backend e coperta da test Rules. Valori sensibili ammessi soltanto nella forma cifrata prevista dalla Vault; nessun valore decifrato può apparire nei link o nei log.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-gate-prima-del-codice-applicativo"></a>

##### Gate prima del codice applicativo

1. approvazione esplicita di percorsi, proprietà e limite online iniziale;
2. estensione backup/ripristino e relativi test prima della prima scrittura reale;
3. Rules e test emulator per isolamento privato/aziendale e accesso condiviso negato;
4. funzioni atomiche con test di idempotenza, conflitto e cancellazione bloccata;
5. prova isolata con un widget incorporato e una Credenziale comune collegata a due Account di aziende diverse;
6. soltanto dopo, UI completa, ordinamento touch e libreria template.


<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-l685"></a>

## Fonte: PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md — righe originali 685–701

> Provenienza: `docs/PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md` a `2900ccc0`.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-d--matrice-minima-di-test"></a>

### D — Matrice minima di test

- Account privato e aziendale, con isolamento fra almeno due aziende;
- online, cache presente, offline applicabile e riconnessione;
- modifica e aggiunta di username, account/codice, password, URL, note, referente, banking e altri campi modificabili;
- dettaglio immediatamente aggiornato senza refresh manuale;
- allegati e condivisione sul percorso e sull'azienda corretti;
- nessuna perdita o duplicazione delle credenziali email/PEC;
- widget con uno e più campi, istanza da template e widget personalizzato;
- cifratura e non esposizione di tutti i campi sensibili;
- test mirati degli altri consumer di `getDocSmart()`/`getDocsSmart()`.

<a id="fonte-docs-profilo-account-widget-cache-roadmap-md-e--documentazione-e-gate-di-chiusura"></a>

### E — Documentazione e gate di chiusura

Registrare decisioni, schema effettivo, compatibilità, eventuali migrazioni, test e problemi aperti negli MD pertinenti. Il blocco si chiude solo quando la proprietà read-your-writes è verificata, l'isolamento aziendale è provato e ogni intervento sui dati legacy ha un inventario e un rollback documentati.



<a id="fonte-experiments-persistent-vault-shell-docs-a5-creazione-account-dal-collegamento-md-l1"></a>

## Fonte: A5_CREAZIONE_ACCOUNT_DAL_COLLEGAMENTO.md — righe originali 1–13

> Provenienza: `experiments/persistent-vault-shell/docs/A5_CREAZIONE_ACCOUNT_DAL_COLLEGAMENTO.md` a `2900ccc0`.

<a id="fonte-experiments-persistent-vault-shell-docs-a5-creazione-account-dal-collegamento-md-a5--creazione-account-dal-collegamento"></a>

## A5 — Creazione Account dal collegamento

Il candidato estende il selettore Account già montato senza sostituire il percorso per Account esistenti. Le sole origini ammesse sono quelle con identità canonica persistita: email, telefono, documento e utenza privata (con indirizzo padre), più gli slot aziendali già accettati dal contratto dei collegamenti. Righe legacy, alias, extra aziendali e schemi non censiti restano consultabili senza azione di creazione.

L'utente sceglie esplicitamente Personale o una delle aziende proprietarie lette dal selettore. Il servizio genera un ID deterministico dal proprietario e dall'operationId, verifica nuovamente origine, revisione, impronta e azienda, quindi crea il record Account minimo canonico insieme al riferimento sull'origine, al backlink e alla ricevuta. Tutte le letture precedono le scritture nella stessa transazione Admin. Retry identico restituisce la ricevuta; payload diverso, concorrenza o azienda non valida non scrivono nulla.

Il nome e lo username sono cifrati dalla capacità della vista. La password legacy non viene letta in chiaro: il ciphertext già protetto può essere trasferito solo con scelta esplicita e uguaglianza verificata sul record autorevole. La stessa transazione lo scrive nell'Account e lo elimina dall'origine; se il controllo fallisce, il campo resta nell'origine e nessun Account viene creato. Se il trasferimento non è scelto, la password legacy resta intatta.

La UI aggiunge “Crea un nuovo Account” al picker ricercabile e conserva ricerca, selezione personale/azienda e Collega/Cambia/Scollega. Il form mostra origine e ambito, consente di modificare nome e username, offre il trasferimento soltanto quando il campo legacy esiste, ed è revocato con la vista. Offline il sorgente rifiuta la preparazione.

Il picker mantiene “Crea un nuovo Account” disabilitato finché la lettura confermata degli ambiti e il relativo handler non sono pronti. Questo rende esplicita la disponibilità reale del comando ed elimina la finestra nella quale un click anticipato poteva essere perso. La regressione unitaria copre il passaggio picker → callback → form; lo scenario completo passa su Chrome desktop e mobile. Edge desktop è stato tentato ma continua a terminare prima dell'endpoint DevTools, quindi il relativo gate resta dichiarato.

Il confine resta di laboratorio: endpoint loopback `applyProfileAccountCreate`, Rules candidate preesistenti che vietano al client di creare backlink protetti, nessuna Function o Rule produttiva. Restano aperti trasporto/App Check produttivi, migrazione delle identità legacy, dispositivo fisico e il gate Edge.

<a id="fonte-experiments-persistent-vault-shell-docs-a6-editor-credenziali-standard-md-l1"></a>

## Fonte: A6_EDITOR_CREDENZIALI_STANDARD.md — righe originali 1–23

> Provenienza: `experiments/persistent-vault-shell/docs/A6_EDITOR_CREDENZIALI_STANDARD.md` a `2900ccc0`.

<a id="fonte-experiments-persistent-vault-shell-docs-a6-editor-credenziali-standard-md-a6--editor-credenziali-standard-account"></a>

## A6 — editor credenziali standard Account

Stato: candidato di laboratorio, montato soltanto nella shell persistente. Nessuna Rule, Function o UI produttiva è modificata.

<a id="fonte-experiments-persistent-vault-shell-docs-a6-editor-credenziali-standard-md-censimento"></a>

### Censimento

I writer legacy personali e aziendali salvano `nomeAccount` e `url` in chiaro, cifrano `username`, `account`, `password` e `note`, e aggiungono campi specifici per condivisione, memorandum, banking e referente. La shell già leggeva i record di laboratorio con `nomeAccount` cifrato; A6 mantiene questo confine più restrittivo come richiesto e tratta `url` nella forma canonica in chiaro. I record con nome legacy in chiaro restano incompatibili e consultabili solo dai percorsi legacy: non viene inventata una migrazione implicita.

I backlink canonici sono `linkedProfileField(s)` e `linkedCompanyProfileField(s)`, con revisione `_profileLink*`. I documenti esterni `accountWidgets`, `sharedVaultData` e `sharedVaultLinks` non fanno parte del record Account e non vengono riscritti.

<a id="fonte-experiments-persistent-vault-shell-docs-a6-editor-credenziali-standard-md-confine-di-scrittura"></a>

### Confine di scrittura

La vista può cambiare soltanto `nomeAccount`, `username`, `account`, `password` e `url`. I primi quattro passano dalla capability crittografica revocabile; l'URL è validato come HTTP(S). La richiesta contiene identità composta personale/azienda, UID atteso, revisione, impronta e ID operazione. Il servizio rilegge Account e azienda nella transazione, convalida backlink e metadati, aggiorna solo i cinque campi e i metadati A6 e crea una ricevuta idempotente. Note, allegati, condivisioni, banking, referente, Widget, credenziali comuni e campi sconosciuti restano invariati.

L'overlay Rules del laboratorio chiude le modifiche dirette dei campi A6. La produzione resta invariata perché i writer legacy devono essere migrati prima di poter attivare questo overlay.

<a id="fonte-experiments-persistent-vault-shell-docs-a6-editor-credenziali-standard-md-lifecycle-e-prove"></a>

### Lifecycle e prove

Offline l'editor è di sola lettura. Lock, logout, cambio UID, navigazione, cambio Account e callback tardive revocano la sorgente; chiusura e salvataggio azzerano i valori degli input. Solo `password` usa `type=password` e semantica `current-password`.

Le prove coprono Account personali e aziendali con lo stesso ID, più origini collegate, retry, concorrenza, relazioni malformate, svuotamento dei campi, preservazione dei dati incorporati ed esterni e rifiuto delle scritture dirette. Chrome desktop e mobile esercitano modifica, rilettura, ripristino, offline e pulizia. Edge resta soggetto al gate ambientale già censito se termina prima dell'endpoint DevTools.

Restano fuori da A6 gli editor Widget, il riordino, i template, banking/carte, migrazioni legacy, Rules/Functions produttive e collaudi fisici.
## Regola testi e conversione Widget legacy

Titolo del profilo, titolo dell'istanza e intestazioni dei campi sono testi strutturali: ogni parola viene salvata con iniziale maiuscola e resto minuscolo. La regola non si applica mai ai valori dei campi.

La conversione legacy raggruppa esclusivamente strutture equivalenti nella stessa categoria (`account` o `bank`). Il profilo risultante contiene definizioni e nessun valore; ciascuna istanza conserva i propri valori e riceve il collegamento al profilo. Gli identificativi del piano derivano dall'impronta della struttura, rendendo la pianificazione ripetibile. L'esecuzione sui dati reali resta un'operazione esplicita, separata dal deploy del codice.
