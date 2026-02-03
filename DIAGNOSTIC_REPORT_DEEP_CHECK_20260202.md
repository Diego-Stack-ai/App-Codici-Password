# AppCodiciPassword - Deep Check Report (CSS-focused)
**Generato**: 2 Febbraio 2026
**Tipo**: Controllo approfondito dopo modifiche CSS

## Sommario rapido
- Scopo: verificare le modifiche CSS e ripetere il controllo statico profondo.
- Esito: molte regole inline rimaste in HTML (100+ occorrenze), meta viewport ancora non conforme, riscontrati gli stessi problemi JS critici già segnalati (v. `uid.js`).

---

## 1) Verifiche CSS/HTML rilevanti

- Trovate oltre 100 occorrenze di `style="..."` nei file HTML (esempi: `index.html`, `scadenze.html`, `profilo_privato.html`, `privacy.html`, `registrati.html`, `reset_password.html`, ecc.). Queste regole inline rendono difficile la manutenzione, interferiscono con CSP e impediscono riusabilità.

- Esempio (da `index.html`):
  - `<span class="material-symbols-outlined" style="font-size: 18px;">language</span>`
  - `<span style="opacity: 0.5;">Titanium Protocol V3.1</span>`

- Meta viewport problematico in `index.html`:
  - `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`
  - Questo blocca lo zoom (violazione accessibilità). Raccomandazione: rimuovere `maximum-scale` e `user-scalable`.

- Presenza di elementi `material-symbols-outlined` con dimensioni inline frequenti: preferibile creare classi utility (es. `.ms-18`, `.ms-16`, `.ms-20`) nel CSS globale.

- Alcune regole duplicate e ridondanti nei CSS incorporati (vedi estratto allegato). Consiglio: consolidare variabili CSS e rimuovere duplicati.

---

## 2) Impatto sulle pagine (priorità)

- Priorità alta: rimuovere inline `style` che modificano layout (display/flex/positioning) perché rischiano di rompere responsive e causare regressioni.
- Priorità media: sostituire inline `font-size` e `opacity` sugli `icon` con classi CSS riutilizzabili.
- Priorità bassa: rimuovere testo hardcoded color/stili nelle pagine di contenuto (es. `privacy.html`) spostandoli in classi.

---

## 3) Verifiche JS rilevanti eseguite contestualmente

- `uid.js` ancora importa `firebase-firestore` da `10.12.2` mentre il resto del codice usa `11.1.0` (file: `Frontend/public/assets/js/uid.js`). Questa discrepanza resta critica e va risolta.

- `main.js` attualmente non sovrascrive `console.error` e `console.warn`. Rimane la possibilità di leak di dati sensibili tramite error logs in produzione.

- Raccomandazione urgente: dopo aver sistemato CSS, applicare Tier 1 JS fixes (aggiornare `uid.js`, correggere `utenti`→`users`, estendere override console).

---

## 4) Azioni raccomandate e snippet di correzione

1) Rimuovere meta viewport problematico in `index.html`:

```html
<!-- PRIMA -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

<!-- DOPO -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

2) Esempio per sostituire icona inline-size con classe CSS (global):

```css
/* Aggiungi in assets/css/comune.css o accesso.css */
.ms-16 { font-size: 16px; }
.ms-18 { font-size: 18px; }
.ms-20 { font-size: 20px; }
.icon-muted { opacity: 0.5; }
```

Sostituisci in HTML:
```html
<!-- PRIMA -->
<span class="material-symbols-outlined" style="font-size: 18px;">language</span>

<!-- DOPO -->
<span class="material-symbols-outlined ms-18">language</span>
```

3) Consolidare stili layout ripetuti in classi (es. `.row-between`, `.settings-group-loading`) invece di `style="display:flex; ..."`.

4) Aggiornamento console override (`main.js`) - suggerimento da applicare:

```javascript
console.error = (...args) => { try { window.LOG(...args); } catch (e) {} };
console.warn = (...args) => { try { window.LOG(...args); } catch (e) {} };
```

5) Fix critici JS (Tier 1):
- `Frontend/public/assets/js/uid.js`: cambiare import a `11.1.0` e `doc(db, "users", uid)`.

---

## 5) Proposta di piano operativo (posso applicare automaticamente)

Se vuoi, applico in automatico le seguenti modifiche (opzionali):
- Sostituzione in `index.html` del meta viewport.
- Aggiunta di classi CSS proposte in `assets/css/comune.css` o `assets/css/accesso.css`.
- Aggiornamento console override in `assets/js/main.js` per includere `error` e `warn`.
- Correzione critica in `assets/js/uid.js` (SDK version + percorso collection).

Confermi quali modifiche desideri che applichi automaticamente? Posso eseguire Tier 1 ora.

---

## 6) File creati durante il controllo
- `DIAGNOSTIC_REPORT_DEEP_CHECK_20260202.md` (questo file)

---

Se vuoi che proceda ad applicare le correzioni critiche (consigliato), dimmi "Applica Tier 1" e le applico subito. Se preferisci, posso invece generare una patch separata solo per i CSS (estrarre classi e rimuovere gli inline più critici).
