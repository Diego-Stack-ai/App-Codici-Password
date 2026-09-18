# A3 — Censimento dello schema utenze annidate (prima del codice)

> **Stato:** censimento verificato sui modelli e sui writer reali; **nessun codice di produzione toccato**, nessuna modifica a `Frontend/public/**`, Rules/Functions produttive, versione, `master`, deploy, dati o migrazioni reali.
> **Base:** `6f1a8b99`; presa in carico pubblicata in `761cfaa1`.
> **Fonti lette:** `Frontend/public/assets/js/modules/privato/profilo-actions.js`, `profilo-sync.js`, `profile-model.js`, `profilo-addresses-docs.js`, `profilo_privato.js`, `modules/azienda/*.js`, e i contratti di laboratorio `profile-link-contract.mjs`, `profile-link-plan.mjs`, `private-addresses-contract.mjs`.

## 1. Forma verificata — `users/{uid}.userAddresses[].utilities[]`

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

## 2. Schema aziendale equivalente: **non esiste**

Nei moduli aziendali (`modules/azienda/**`) la parola «utility» compare **solo** come *tipo di collegamento* (`profileContactLinkDraft.contactType === 'utility'`, `form_account_azienda.js:68,111,120`, `form-azienda-save.js:172`): è l'origine **privata** di un collegamento, non una collezione aziendale. Il documento aziendale (`ma_save.js`) non scrive né legge alcun campo `utilities`; le sue liste ripetibili sono `emails.extra` e `altreSedi`. **Conclusione: nessuna estensione aziendale in questo incarico**, come previsto dall'incarico stesso; se servirà, richiederà un contratto e uno schema propri, mai una conversione del privato.

## 3. Decisioni A3 (verificabili)

1. **Perimetro di scrittura**: la sola proprietà `utilities` dell'indirizzo padre. Il servizio sostituisce l'array delle utenze di quell'indirizzo e nient'altro: l'indirizzo padre, le altre utenze, gli altri indirizzi e ogni altro campo del profilo restano byte per byte.
2. **Allowlist dedicata**: `type` (in chiaro) e `value` (cifrato, forma memorizzata preservata). Nessun altro campo entra in un comando, quindi **campi sconosciuti e password legacy sopravvivono per costruzione**.
3. **Identità**: nuova `utility-<uuid>`; un id che contiene `-legacy-` è **derivato** e la riga resta consultabile e **non modificabile**, in nessun percorso, nemmeno in una richiesta costruita a mano.
4. **Identità composta**: la richiesta porta `parentAddressId`; il servizio verifica che esista **esattamente un** indirizzo con quell'id e che l'utenza sia trovata **dentro quell'indirizzo**.
5. **Eliminazione vietata** solo se l'utenza ha un riferimento Account. La selezione QR dell'indirizzo **non** blocca la singola utenza: la tessera pubblica solo la riga `ADR` e non le utenze (correzione A3-R1, dopo che il primo blocco aveva introdotto una guardia non verificata). Consultazione e modifiche non distruttive restano sempre possibili; identità derivate e riferimenti ambigui restano fail-closed.
6. **Revisione separata** (`_profileUtilitiesRevision`/`_profileUtilitiesSchemaVersion`/`_profileUtilitiesUpdatedAt`), impronta dell'intera riga, ricevuta idempotente in `mutationResults/{uid}/operations/profile-utilities-{operationId}`, letture prima delle scritture e nessuna scrittura parziale.
7. Solo online, rilettura confermata, scarto locale della riga nuova non salvata, doppia conferma per l'eliminazione persistita.
