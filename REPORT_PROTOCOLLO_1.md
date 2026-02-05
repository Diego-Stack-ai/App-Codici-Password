# Report Simulazione Protocollo 1
**Data:** 2026-02-05
**Stato Generale:** In Corso di Migrazione (Protocollo V3.1 -> Protocollo 1)

## Riepilogo Pagine Analizzate
Sono state analizzate circa 32 pagine. Di seguito il dettaglio della conformità rispetto alle specifiche della **Scheda.md**.

### 1. Pagine Servizio (Dark Fix, No Header/Footer)
*   `index.html`: **NON CONFORME**. Usa `Protocollo-vecchio.css` V3.1 e classi `titanium-`.
*   `registrati.html`: **NON CONFORME**. Usa `Protocollo-vecchio.css` V3.1 e classi `titanium-`.
*   `reset_password.html`: **NON CONFORME**. (Presunto vecchio stile).
*   `imposta_nuova_password.html`: **NON CONFORME**. (Presunto vecchio stile).

### 2. Pagine Contenuto (Header/Footer Standard, Dual-Mode)
*   `home_page.html`: **CONFORME**. Allineata al Protocollo 1 (`operatore.css`, `base-header`, `base-footer`).
*   `profilo_privato.html`: **CONFORME**. Allineata al Protocollo 1.
*   `impostazioni.html`: **CONFORME**. Allineata al Protocollo 1.
*   `dettaglio_account_privato.html`: **CONFORME**. Allineata al Protocollo 1.
*   `area_privata.html`: **PARZIALMENTE CONFORME**. Usa `Protocollo-vecchio.css` V3.1 ma ha una struttura Matrix Grid. Da aggiornare a `base-header/footer`.
*   `lista_aziende.html`: **NON CONFORME**. Usa `Protocollo-vecchio.css` V3.1.
*   `scadenze.html`: **NON CONFORME**. Usa `Protocollo-vecchio.css` V3.1.
*   `privacy.html`: **NON CONFORME**. Usa `Protocollo-vecchio.css` V3.1.
*   Tutte le altre pagine (circa 20+): **NON CONFORME**. Risultano ancora legate al vecchio Design System V3.1.

## Punti Critici Rilevati
1.  **CSS**: La maggior parte delle pagine punta ancora a `assets/css/Protocollo-vecchio.css?v=3.1` invece di `assets/css/operatore.css`.
2.  **Naming Classi**: Uso diffuso di `titanium-bg`, `titanium-container`, `titanium-glow` e `titanium-header/footer` invece del nuovo standard `base-` e `base-glow`.
3.  **Icone**: Alcune pagine hanno ancora icone con stili inline o classi legacy (opsz, FILL) non coerenti con il minimalismo "nude" richiesto.
4.  **Header/Footer**: La struttura a 3 zone (SX, C, DX) è presente ma implementata con classi vecchie.

## Prossimi Passi Consigliati
1.  Aggiornare i link CSS in tutti i file HTML.
2.  Rinominare le classi core (`titanium-` -> `base-`).
3.  Verificare e centralizzare le icone secondo il nuovo standard.
4.  Applicare il "Saluto Dinamico" solo nella Home come da protocollo.
