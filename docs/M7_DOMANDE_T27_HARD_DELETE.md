# M7 — Domande per Diego: residui dell'hard-delete di Azienda e Account aziendale (T-27)

> **Stato:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T27.
> **Commit delle prove tecniche:** `d2eef964` (banchi, censimento §3.5, riga T-27). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna politica, alcuna cancellazione e alcuna modifica al runtime.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §3.5,
> `tests/company-hard-delete-residues.test.mjs` e `tests/company-hard-delete-residues.emulator.test.mjs`.

## Che cosa è stato verificato (per contesto)

Esistono **due percorsi diversi**:

- **Azienda cancellata dal client** (`deleteCompany` e la form): un solo `deleteDoc` sul
  documento Azienda, **non ricorsivo**. Restano gli Account aziendali con i loro metadati
  (`aziende/{cid}/accounts/**`), i byte Storage sotto
  `users/{uid}/aziende/{cid}/accounts/{aid}/attachments/**`, gli allegati del form Azienda
  (`users/{uid}/aziende_allegati/**`) e i riferimenti nei contatti del Profilo, che ora
  puntano a un'Azienda inesistente. Nella UI quegli Account non sono più raggiungibili
  (l'elenco parte dalle Aziende).
- **Account aziendale eliminato dal purge backend**: ricorsivo sul documento e sulla
  sottocollezione, cancella i byte **elencati** nei metadati (un oggetto non elencato resta),
  ripulisce **solo** la coppia esatta `(accountId, companyId)` nei riferimenti e lascia intatto
  l'Account con lo **stesso id** in un'altra Azienda, byte compresi. Il purge, però, si applica
  a un Account **archiviato** e non raggiunge mai `aziende_allegati`.

## Domande

1. **Q1 — Cancellare l'Azienda deve cancellare anche i suoi Account?**
   Oggi no: restano documenti, metadati e byte, invisibili nella UI. Alternative: (a) lasciare
   come oggi e dichiararlo; (b) cancellare in cascata gli Account dell'Azienda (con i loro
   allegati elencati); (c) avvisare l'utente che gli Account restano come residuo e chiedere
   conferma esplicita. Quale?

2. **Q2 — Ordine e atomicità se si sceglie la cascata.**
   Cancellare prima i figli (se il padre non viene eliminato, restano Account senza Azienda) o
   prima il padre (se i figli falliscono, restano orfani non più visibili)? Serve una
   compensazione, un blocco dell'operazione, o si accetta un esito riprovabile?

3. **Q3 — Riferimenti pendenti.**
   I contatti del Profilo che puntano a un Account di un'Azienda eliminata restano. Vanno
   ripuliti al momento della cancellazione dell'Azienda (come fa il purge per la coppia esatta)
   o è accettabile che restino?

4. **Q4 — Prefissi non coperti dal purge.**
   `users/{uid}/aziende_allegati/**` e gli Account orfani di un'Azienda eliminata **non** sono
   raggiunti dal purge degli Account (che opera su un Account archiviato esistente). Vanno
   inclusi in una pulizia per prefisso (D4) o dichiarati fuori perimetro?

5. **Q5 — Rapporto con D4.**
   La cancellazione dell'Azienda rientra nella stessa politica dei residui (inventario per
   prefisso + job) o richiede una regola dedicata? Confermi anche per il futuro la regola
   attuale «si cancellano solo i percorsi elencati sotto il prefisso dell'Account», che oggi
   impedisce di toccare byte di altri Account?

6. **Q6 — Conferma esplicita nella UI.**
   La conferma attuale («Eliminare definitivamente l'azienda?») non dice che gli Account e i
   file resteranno. Va cambiato il testo? Se sì, chi lo approva?

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: il runtime è **invariato**,
nessuna cancellazione è stata introdotta e nessun dato reale è stato letto o creato. Le prove
tecniche sono nel commit `d2eef964`; questo documento non le ripete e non le sostituisce.
