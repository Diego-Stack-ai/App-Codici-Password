# A2 — Censimento e decisioni per l'editor indirizzi (prima del codice)

> **Stato:** censimento verificato sui writer e sui modelli reali; le mutazioni candidate sono descritte qui e implementate in `experiments/persistent-vault-shell/**`. **Nessun codice di produzione toccato**, nessuna modifica a `Frontend/public/**`, Rules/Functions produttive, versione, `master`, deploy, dati o migrazioni reali.
> **Base:** `372b87d7`; presa in carico pubblicata in `8c68e0c8`.
> **Fonti lette:** `Frontend/public/assets/js/modules/privato/profilo-sync.js`, `profilo-actions.js`, `profilo_privato.js`, `profile-model.js`, `profilo-addresses-docs.js`, `azienda/ma_save.js`, `azienda/company-vcard.js`, `shared/qr_code_utils.js`, e i contratti di laboratorio `qr-selection-contract.mjs`, `profile-link-contract.mjs`, `profile-link-origin.mjs`, `profile-link-plan.mjs`.

## 1. Indirizzi privati — `users/{uid}.userAddresses[]`

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

## 2. Indirizzi aziendali — `users/{uid}/aziende/{companyId}`

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

## 3. Riuso e separazione

- I due schemi **non si convertono l'uno nell'altro**: due contratti, due allowlist, due servizi, due metadati di revisione (`_profileAddresses*` per il privato, `_companyAddresses*` per l'azienda).
- Si riusano soltanto helper già provati: il contratto QR privato canonico (`preparePrivateQrSelection`) e la serializzazione stabile dell'impronta (stesso algoritmo, codici di rifiuto propri di ciascuna fetta).
- Rules candidate, endpoint e prove restano confinati al laboratorio; nessuna Rules/Function produttiva viene modificata.
