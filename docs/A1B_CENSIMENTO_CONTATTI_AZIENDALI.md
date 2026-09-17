# A1b — Censimento dello schema contatti aziendali (prima del codice)

> **Stato:** censimento in corso, verificato sulle fonti indicate; **nessun codice scritto**, nessuna modifica a `Frontend/public/**`, Rules/Functions produttive, versione, `master`, deploy, dati o migrazioni reali.
> **Base:** `5316111c`; presa in carico pubblicata in `7e72cdb3`.
> **Fonti lette in questo censimento:** `experiments/persistent-vault-shell/company-profile-source.mjs`, `Frontend/public/assets/js/modules/azienda/company-profile-model.js` (sola lettura).

## 1. Forma dello schema (verificata)

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

## 2. Da verificare prima di scrivere il contratto

- Contratto dei collegamenti (`profile-link-contract.mjs`, `profile-link-handler.mjs`) e come `linkedAccountId` / `linkedAccountCompanyId` sono validati oggi sui contatti **privati**, per riusare le stesse regole senza inventare equivalenze.
- Selezione QR **aziendale** (`company-qr-selection-contract.mjs`, `company-qr-selection-handler.mjs`) e `qrConfig`: quali contatti aziendali possono essere inclusi e come si riconosce un riferimento posizionale legacy.
- Fixture browser aziendali in `emulator-browser.mjs` (righe `aziende/company` e `second-company`): servono casi con slot pieni, slot vuoti, `extra` con e senza `id`, collegamenti Account e QR.
- Campi di classificazione cifrata già in uso per l'azienda (quali valori sono cifrati e con quale formato) per non introdurre una cifratura diversa da quella esistente.

## 3. Vincoli confermati dall'incarico

- Contratto/allowlist aziendale **separato** da quello privato: nessuna conversione dell'azienda al formato privato.
- Fail-closed: contatti collegati a un Account o inclusi nel QR non si eliminano; configurazioni QR ambigue o illeggibili bloccano la cancellazione senza impedire la consultazione.
- Solo online, rilettura server confermata, aggiornamento immediato della linguetta; offline in sola consultazione; scarto locale delle righe nuove non salvate.
- Nessuna migrazione implicita, nessun dato reale, nessuna modifica a Rules/Functions produttive (solo Rules candidate per gli emulatori).

## 4. Passo immediatamente successivo

Completare il punto 2 e produrre una **fixture di contratto** che rappresenti: i tre slot fissi (pieni e vuoti), `emails.extra` con e senza `id`, i tre telefoni, `phoneAccountLinks`, un collegamento Account e una selezione QR aziendale — quindi il contratto con allowlist aziendale e i suoi test, prima di qualsiasi editor.
