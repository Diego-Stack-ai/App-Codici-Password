---
description: Protocollo Standard Titanium Account V3.0 (Stability & Maintenance Focus)
---

# Titanium Account V3.0 (The Pragmatic Standard)
> **Baseline Ufficiale**: Questo protocollo, insieme agli altri presenti in `.agent/workflows/`, costituisce l'unica fonte di istruzioni da seguire per lo sviluppo delle pagine relative alla gestione degli account privati e aziendali. Viene stabilito che la stabilità operativa, il cache busting e l'uso di componenti centralizzati hanno priorità assoluta.

## 1. Ambito di Applicazione
Questo protocollo governa le pagine di gestione delle credenziali e degli account:
1. `account_privati.html` (Lista Account Personali)
2. `area_privata.html` (Hub Privato)
3. `aggiungi_account_privato.html` (Nuovo Account Privato)
4. `dettaglio_account_privato.html` (Dettaglio/Modifica Privato)
5. `lista_aziende.html` (Archivio Aziende)
6. `account_azienda.html` (Lista Credenziali Azienda)
7. `aggiungi_account_azienda.html` (Nuovo Account Aziendale)
8. `dettaglio_account_azienda.html` (Dettaglio/Modifica Aziendale)

### 1.1 CSS di Riferimento Unico
L'unico e solo file CSS per gestire tutte le pagine sopra elencate è:
- **`assets/css/auth_account.css`**

Questo file è *completamente autonomo* e garantisce isolamento dal resto dell'applicazione. **NON** utilizzare `titanium.css` o altri file CSS in queste pagine.

---

## 2. Regole di Architettura (System Core)
### 2.1 Cache Busting Tassativo
Ogni inclusione di file JS proprietario DEVE avere un parametro di versione esplicito.
**OBBLIGATORIO**: `<script src="assets/js/miofile.js?v=3.5"></script>`

### 2.2 Componenti UI Centralizzati
Ogni interazione utente DEVE passare per `ui-core.js` (Modali, Toast).
- **Feedback**: `window.showToast("Messaggio", "success/error")`

### 2.3 Standard Tema (Dual Mode)
Le pagine devono riflettere il sistema Titanium Gold con supporto Light/Dark:
- **Dark Mode**: Midnight Gradient + Glass Glow.
- **Light Mode**: Cloudy Sky + Soft Shadows.
- **Effetti**: L'unico effetto dinamico ammesso per la navigazione stabile è il **Faro** (`glass-glow`). Lo Shimmer (Saetta) è riservato esclusivamente ai bottoni di login primari.

---

## 3. Standard Editoriale
### 3.1 Header Balanced Layout Protocol (V1.0)
Ogni header DEVE seguire l'architettura a 3 zone (Left, Center, Right) definita nella sezione 3.2 del protocollo impostazioni, utilizzando le classi fornite in `auth_account.css`.

### 3.2 Triple Masking Protocol
Per i campi sensibili (Username, Account, Password):
1. **Default**: Mascherati con asterischi (`********`).
2. **Toggle**: Un unico pulsante "occhio" per rivelare/nascondere l'intero set di dati.
3. **Copy**: Pulsante dedicato per ogni campo con feedback visuale (check icon).

---

## 4. Checklist di Validazione
- [ ] Il file CSS collegato è solo `auth_account.css`?
- [ ] Il cache busting `?v=3.5` è presente?
- [ ] Il layout dell'header è bilanciato a 3 zone?
- [ ] L'effetto "Saetta" è assente o rimosso?