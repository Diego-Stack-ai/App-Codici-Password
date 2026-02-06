# CSP & SAFE JS CHECK – PROTOCOLLO BASE V3.6

**Data Analisi**: 06/02/2026, 18:27:04

## 📊 Riepilogo

- **File Analizzati**: 56
- **✅ File Conformi CSP**: 35
- **❌ File Non Conformi**: 21
- **⚠️ Violazioni Totali**: 44

---

## ❌ File Non Conformi CSP

### `account_privati.js`

**Violazioni**: 3

#### Violazione 1
- **Linea**: 401
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
card.querySelector('.btn-card-detail').onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 2
- **Linea**: 408
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btnVisibility.onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 3
- **Linea**: 416
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btnPin.onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `aggiungi_account_azienda.js`

**Violazioni**: 5

#### Violazione 1
- **Linea**: 303
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = () => removeIban(parseInt(btn.dataset.idx));
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 2
- **Linea**: 306
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = () => addCard(parseInt(btn.dataset.idx));
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 3
- **Linea**: 309
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 4
- **Linea**: 316
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = () => removeCard(parseInt(btn.dataset.ibanIdx), parseInt(btn.dataset.cardIdx));
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 5
- **Linea**: 319
- **Evento**: `onchange`
- **Tipo**: assignment
- **Codice**:
```javascript
select.onchange = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('change', functionName)

---

### `aggiungi_account_privato.js`

**Violazioni**: 2

#### Violazione 1
- **Linea**: 424
- **Evento**: `onload`
- **Tipo**: assignment
- **Codice**:
```javascript
reader.onload = function (e) {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('load', functionName)

#### Violazione 2
- **Linea**: 426
- **Evento**: `onload`
- **Tipo**: assignment
- **Codice**:
```javascript
img.onload = function () {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('load', functionName)

---

### `aggiungi_azienda.js`

**Violazioni**: 2

#### Violazione 1
- **Linea**: 42
- **Evento**: `onload`
- **Tipo**: assignment
- **Codice**:
```javascript
reader.onload = (event) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('load', functionName)

#### Violazione 2
- **Linea**: 175
- **Evento**: `onload`
- **Tipo**: assignment
- **Codice**:
```javascript
img.onload = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('load', functionName)

---

### `area_privata.js`

**Violazioni**: 2

#### Violazione 1
- **Linea**: 192
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
document.getElementById('rubrica-toggle-btn').onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 2
- **Linea**: 197
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
document.getElementById('add-contact-btn').onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `dati_anagrafici_privato.js`

**Violazioni**: 1

#### Violazione 1
- **Linea**: 879
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
div.querySelector('.remove-btn').onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `dati_azienda.js`

**Violazioni**: 2

#### Violazione 1
- **Linea**: 115
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
document.getElementById('footer-btn-edit').onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 2
- **Linea**: 203
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btnMap.onclick = () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr + ' ' + cityFull)}`, '_blank');
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `dettaglio_account_azienda.js`

**Violazioni**: 2

#### Violazione 1
- **Linea**: 661
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 2
- **Linea**: 677
- **Evento**: `onchange`
- **Tipo**: assignment
- **Codice**:
```javascript
el.onchange = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('change', functionName)

---

### `dettaglio_account_privato.js`

**Violazioni**: 1

#### Violazione 1
- **Linea**: 781
- **Evento**: `onchange`
- **Tipo**: assignment
- **Codice**:
```javascript
el.onchange = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('change', functionName)

---

### `dettaglio_scadenza.js`

**Violazioni**: 1

#### Violazione 1
- **Linea**: 63
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
document.getElementById('footer-btn-edit').onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `imposta_nuova_password.js`

**Violazioni**: 4

#### Violazione 1
- **Linea**: 155
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 2
- **Linea**: 171
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
cancelBtn.onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 3
- **Linea**: 194
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 4
- **Linea**: 202
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
opt.onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `lista_aziende.js`

**Violazioni**: 2

#### Violazione 1
- **Linea**: 79
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
sBtn.onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 2
- **Linea**: 92
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
document.getElementById('footer-btn-add').onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `login.js`

**Violazioni**: 3

#### Violazione 1
- **Linea**: 88
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 2
- **Linea**: 96
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
opt.onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 3
- **Linea**: 184
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `modifica_account_azienda.js`

**Violazioni**: 2

#### Violazione 1
- **Linea**: 198
- **Evento**: `onload`
- **Tipo**: assignment
- **Codice**:
```javascript
reader.onload = (ev) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('load', functionName)

#### Violazione 2
- **Linea**: 200
- **Evento**: `onload`
- **Tipo**: assignment
- **Codice**:
```javascript
img.onload = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('load', functionName)

---

### `modifica_account_privato.js`

**Violazioni**: 2

#### Violazione 1
- **Linea**: 352
- **Evento**: `onload`
- **Tipo**: assignment
- **Codice**:
```javascript
reader.onload = (ev) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('load', functionName)

#### Violazione 2
- **Linea**: 354
- **Evento**: `onload`
- **Tipo**: assignment
- **Codice**:
```javascript
img.onload = function () {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('load', functionName)

---

### `modifica_azienda.js`

**Violazioni**: 2

#### Violazione 1
- **Linea**: 103
- **Evento**: `onload`
- **Tipo**: assignment
- **Codice**:
```javascript
reader.onload = (ev) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('load', functionName)

#### Violazione 2
- **Linea**: 367
- **Evento**: `onload`
- **Tipo**: assignment
- **Codice**:
```javascript
img.onload = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('load', functionName)

---

### `privato.js`

**Violazioni**: 1

#### Violazione 1
- **Linea**: 210
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
accountsContainer.onclick = function (e) {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `qr_logic.js`

**Violazioni**: 1

#### Violazione 1
- **Linea**: 80
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
modal.onclick = () => modal.remove();
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `registrati.js`

**Violazioni**: 3

#### Violazione 1
- **Linea**: 149
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 2
- **Linea**: 157
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
opt.onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 3
- **Linea**: 174
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `reset_password.js`

**Violazioni**: 2

#### Violazione 1
- **Linea**: 133
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = (e) => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

#### Violazione 2
- **Linea**: 141
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
opt.onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

### `security-setup.js`

**Violazioni**: 1

#### Violazione 1
- **Linea**: 61
- **Evento**: `onclick`
- **Tipo**: assignment
- **Codice**:
```javascript
btn.onclick = () => {
```
- **✅ Suggerimento**: Refactor: Declare a named function and use addEventListener('click', functionName)

---

## ✅ File Conformi CSP

I seguenti file **NON** contengono event handler inline e sono conformi alla Content Security Policy:

- ✅ `account_azienda.js`
- ✅ `account_azienda_list.js`
- ✅ `aggiungi_scadenza.js`
- ✅ `archivio_account.js`
- ✅ `auth.js`
- ✅ `components.js`
- ✅ `configurazione_automezzi.js`
- ✅ `configurazione_documenti.js`
- ✅ `configurazione_generali.js`
- ✅ `core.js`
- ✅ `db.js`
- ✅ `firebase-config.js`
- ✅ `gestione_allegati.js`
- ✅ `home.js`
- ✅ `impostazioni.js`
- ✅ `inactivity-timer.js`
- ✅ `main.js`
- ✅ `modifica_scadenza.js`
- ✅ `notification_service.js`
- ✅ `notifiche_storia.js`
- ✅ `profilo_privato.js`
- ✅ `regole_scadenze_veicoli.js`
- ✅ `scadenza_templates.js`
- ✅ `scadenze.js`
- ✅ `swipe-list-v6.js`
- ✅ `tailwind-config.js`
- ✅ `theme.js`
- ✅ `titanium-config.js`
- ✅ `translations.js`
- ✅ `ui-components.js`
- ✅ `ui-core.js`
- ✅ `ui-pages.js`
- ✅ `uid.js`
- ✅ `urgenze.js`
- ✅ `utils.js`

---

## 🎯 Raccomandazioni

Per rendere tutti i file conformi CSP:

1. **Rimuovere** tutti gli assignment diretti tipo `.onclick = function() {...}`
2. **Dichiarare** funzioni nominate nel modulo
3. **Usare** `addEventListener('event', functionName)` invece di inline handlers
4. **Evitare** funzioni anonime inline negli event listener

### Esempio di Refactoring

**❌ Non Conforme:**
```javascript
element.onclick = function() {
    console.log('clicked');
};
```

**✅ Conforme:**
```javascript
function handleClick() {
    console.log('clicked');
}

element.addEventListener('click', handleClick);
```

