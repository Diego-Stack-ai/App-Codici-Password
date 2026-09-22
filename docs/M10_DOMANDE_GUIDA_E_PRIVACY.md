# M10-4 — Domande per Diego: guida utente, privacy e informazioni organizzative

> **Stato:** domande **aperte**, raccolte da DeepSeek il 2026-09-22 insieme alla bozza
> (`docs/M10_GUIDA_UTENTE_BOZZA.md`, `docs/M10_REVISIONE_PRIVACY_PRELIMINARE.md`), in un **commit
> separato** come richiesto dal proprietario. Questo documento **non** prende decisioni, **non** inventa
> nomi, contatti, termini o impegni e **non** chiude M10-4.
> **Non duplica** le raccolte già esistenti: D1–D16 (`docs/M7_RETENTION_CENSIMENTO.md`), cache e copie
> (`M7_DOMANDE_T23_*`, `M7_DOMANDE_T24_*`), residui (`M7_DOMANDE_T26/T27/T08/T17/T21_*`), ripristino
> (`M8_DOMANDE_*`), fallback Web Locks e cache espulsa (`M6_DOMANDE_*`), audit (`M10_DOMANDE_AUDIT_INDIPENDENTE.md`).

## 1. Guida utente (bozza pronta, servono scelte)

1. **Q1 — Chi approva la guida utente** (`docs/M10_GUIDA_UTENTE_BOZZA.md`) e con quale livello di
   dettaglio tecnico? Deve spiegare anche i **limiti noti** (P0 della chiave di wrapping in
   `sessionStorage`, PBKDF2 dei campi a 100 000, riferimenti orfani dopo un ripristino interrotto) o
   rimandarli a una nota tecnica separata?
2. **Q2 — Canale di assistenza e tempi di risposta** per un utente che perde la Recovery Key o non
   riesce a sbloccare il Vault: qual è il canale, e quali informazioni possono essere chieste **senza**
   ricevere segreti?
3. **Q6 — Informative pubblicate**: `privacy.html` e `termini.html` esistono nel repository ma il loro
   contenuto **non** è stato riesaminato in questa bozza. Chi li riesamina e con quale priorità?

## 2. Privacy e profili legali

4. **Q3 — Referente privacy/legale**: chi copre i profili legali (informativa, diritti degli
   interessati, obblighi di conservazione) e come si interfaccia con le decisioni **D8** (obblighi
   legali) e **D7** (livello di prova richiesto)? La revisione preliminare
   (`docs/M10_REVISIONE_PRIVACY_PRELIMINARE.md`) **non** è un parere legale.
5. **Q7 — Copie sul dispositivo**: al logout l'app cancella da sé **solo la sessione Vault in
   `sessionStorage`**; bozze, cache IndexedDB, coda offline, `localStorage` e shell PWA **restano**, e
   dopo il purge nessuna copia locale viene evacuata (D10, D11). L'utente deve poter cancellare anche
   quelle copie (comando dedicato), o basta dichiararlo nella guida finale?
6. **Q8 — Informativa e trasparenza sull'audit**: il registro tecnico è conservato **24 mesi** e la
   vista utente **non esiste**. Deve comparire nell'informativa (con quale formulazione) o resta una
   scelta tecnica documentata solo nei contratti?

## 3. Informazioni organizzative (segnaposto da compilare)

Tutte le voci seguenti sono **segnaposto**: nessun nome, contatto, scadenza o impegno è stato inventato.

7. **Q4 — Ruoli e canali di incidente**: chi è l'**incident commander**, chi il **referente Firebase**,
   qual è il **canale di emergenza** e come si accede in **break-glass**? La procedura
   (`docs/RISPOSTA_INCIDENTI_E_RECUPERO.md`, «Informazioni organizzative da completare») li richiede
   prima di un go-live con più utenti e oggi sono **vuoti**.
8. **Q5 — Comunicazioni**: chi comunica un incidente agli utenti, con quale canale e con quale
   contenuto minimo (senza dati personali)? Serve anche la decisione su **cosa** dichiarare quando un
   ripristino è parziale o un allegato è senza byte.

## 4. Che cosa questa raccolta non fa

Nessuna decisione viene presa qui; nessun testo definitivo viene approvato; nessun termine viene
assegnato. Le risposte alimenteranno la revisione finale di M10-4 e la guida pubblicabile, che resta
**aperta** insieme a M10-1 e agli altri gate elencati in `docs/CENSIMENTO_GATE_M6_M10.md`.
