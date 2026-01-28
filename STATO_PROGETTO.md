# STATO PROGETTO - App Codici & Password

Questo documento traccia l'avanzamento dei lavori, lo stato delle singole pagine e i workflow attivi per la standardizzazione del sistema **Titanium Gold**.

## Workflow Ibrido Attuale
Stiamo eseguendo una transizione verso due soli **Template Master** (Dashboard & Lista) e la centralizzazione del CSS.

---

## 1. Tabella Avanzamento Pagine (Regola Titanium)

Monitoraggio dello stato di avanzamento delle pagine verso il nuovo standard.

🔴 DA FARE | 🟠 IBRIDO/INCOMPLETO | 🟢 COMPLETATO (Gold Standard)

| # | Stato | Nome Pagina | Note Tecniche |
| :--- | :--- | :--- | :--- |
| **AUTH** | | | |
| 1 | 🟢 COMPLETATA | `index.html` (Login) | Vault Style, Forced Dark, Regole 9,19,20,21 |
| 2 | 🟢 COMPLETATA | `registrati.html` | Vault Style, Forced Dark |
| 3 | 🟢 COMPLETATA | `reset_password.html` | Vault Style, Forced Dark |
| 4 | 🟢 COMPLETATA | `imposta_nuova_password.html` | Vault Style, Forced Dark |
| **CORE** | | | |
| 5 | 🟢 COMPLETATA | `home_page.html` | Template Dashboard, Matrix System |
| 6 | 🟢 COMPLETATA | `profilo_privato.html` | **Nuovo Gold Standard**. Template Dashboard, Box Espandibili, Dual Theme. |
| 7 | 🟢 COMPLETATA | `impostazioni.html` | Dual Theme, Glass Style |
| **AZIENDA** | | | |
| 8 | 🔴 DA FARE | `dati_azienda.html` | *Da migrare a Template Dashboard (come Profilo Privato)* |
| 9 | 🔴 DA FARE | `lista_aziende.html` | *Da migrare a Template Lista* |
| 10 | 🔴 DA FARE | `modifica_azienda.html` | *Da migrare a Template Form* |
| 11 | 🔴 DA FARE | `aggiungi_nuova_azienda.html` | *Da migrare a Template Form* |
| 12 | 🔴 DA FARE | `account_azienda.html` | *Da migrare a Template Lista* |
| **PRIVATO** | | | |
| 13 | 🟠 INCOMPLETA | `account_privati.html` | Layout vecchio |
| 14 | 🟠 INCOMPLETA | `dati_anagrafici_privato.html` | **DEPRECATA** -> Sostituita da `profilo_privato.html`. Da eliminare alla fine. |
| **SCADENZE** | | | |
| 15 | 🟠 INCOMPLETA | `scadenze.html` | Funziona ma usa vecchio layout |
| 16 | 🔴 DA FARE | `gestione_scadenze.html` | *Da unificare con scadenze.html* |
| **CONFIG** | | | |
| 17 | 🟢 COMPLETATA | `regole_scadenze_veicoli.html` | Admin Panel Style |
| 18 | 🟢 COMPLETATA | `configurazione_automezzi.html` | Admin Panel Style |
| 19 | 🟢 COMPLETATA | `configurazione_documenti.html` | Admin Panel Style |
| 20 | 🟢 COMPLETATA | `configurazione_generali.html` | Admin Panel Style |

---

## 2. Note Operative Recenti

### Workflow 1: Titanium Foundation (In Corso)
*   **Obiettivo**: Centralizzare CSS in `titanium.css` per evitare stili inline.
*   **Azione**: Definire classi `.titanium-field`, `.titanium-card` che gestiscono automaticamente Light/Dark mode.
*   **Status**: In fase di analisi file CSS.

### Problemi Risolti
*   **Telefono Fisso Mancante**: Aggiunto campo e logica di chiamata in `profilo_privato.html`.
*   **Errore Inizializzazione Dati**: Risolto con nuova architettura JS modulare in `profilo_privato.js`.
*   **Standardizzazione**: Definito e accettato il modello a 2 Template (Dashboard e Lista).
