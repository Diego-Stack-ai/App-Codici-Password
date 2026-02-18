Le pagine interessate dalla transizione e che rischiano rotture (se si applica la guida rigorosamente senza refactoring CSS preventivo) sono principalmente quelle legate alla gestione **Aziende** e **Account Privati**.

Ecco la lista completa delle pagine "Legacy" identificate:

### 1. Sezione Aziende (Critico - Struttura Complessa)
Queste pagine usano pesantemente Tailwind per layout e stili form:
- `lista_aziende.html` (Griglia card aziende)
- `dati_azienda.html` (Dettaglio azienda, tab, sezioni collassabili)
- `modifica_azienda.html` (Form complesso edit azienda)
- `aggiungi_nuova_azienda.html` (Form creazione azienda)
- `dettaglio_account_azienda.html` (Pagina dettaglio account aziendale)
- `form_account_azienda.html` (Form account aziendale)
- `modifica_account_azienda.html` (Edit account aziendale)

### 2. Sezione Privati (Medio - Layout Simile ad Aziende)
Struttura simile alle pagine aziende, quindi stessi rischi:
- `account_privati.html` (Lista account privati)
- `dettaglio_account_privato.html` (Dettaglio visivo account)
- `form_account_privato.html` (Form inserimento/modifica)
- `profilo_privato.html` (Profilo utente)

### 3. Sezione Scadenze (Basso/Medio)
Meno complesse visivamente ma usano utility per layout:
- `scadenze.html` (Lista scadenze)
- `aggiungi_scadenza.html` (Form inserimento)
- `dettaglio_scadenza.html` (Dettaglio)

### 4. Pagine Configurazione (Basso)
Spesso usano layout tabellari o liste semplici:
- `configurazione_generali.html`
- `configurazione_automezzi.html`
- `configurazione_documenti.html`

---

**Nota Importante**: Le pagine di **Accesso** (`index.html`, `registrati.html`) e la **Home Page** (`home_page.html`, `impostazioni.html`) sono già state migrate e **NON** sono a rischio.
