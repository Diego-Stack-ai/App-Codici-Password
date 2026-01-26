---
description: Procedura Standard per l'allineamento di una singola pagina al Protocollo Titanium Gold
---

### ⚠️ VINCOLI ASSOLUTI (DA RISPETTARE PRIMA DI OGNI AZIONE)
- **AUTORIZZAZIONE**: Non procedere MAI all'esecuzione se l'utente non ha dato il "via libera" esplicito per la SINGOLA pagina in esame.
- **RAGIONAMENTO**: Prima di ogni modifica, analizzare la pagina con l'utente spiegando cosa si intende fare.
- **FRONTEND_RULES**: È OBBLIGATORIO leggere e rispettare le regole scritte in `FRONTEND_RULES.md` prima di scrivere qualsiasi riga di codice.
- **ZERO BATCH**: È vietato apportare modifiche a più pagine contemporaneamente.

### OPERATIVITÀ (UNA PAGINA ALLA VOLTA)

1. **Analisi Preventiva**:
   - Aprire il file HTML richiesto.
   - Identificare il tag `<main>`.
   - Verificare la presenza di classi Tailwind manuali (es. `pt-4`, `pb-24`, `mt-16`, `flex-1`).

2. **Bonifica HTML**:
   - Rimuovere TUTTE le classi di spaziatura e layout dal tag `<main>`.
   - Sostituirle con l'unica classe: `class="titanium-main"`.
   - Valutare la rimozione di "Header Spacer" manuali: la classe `titanium-main` fornisce già 128px di padding superiore.

3. **Verifica Armonia**:
   - Assicurarsi che il tag `<html>` rispetti la coerenza del tema (Dark/Platinum).
   - Verificare che Header e Footer siano iniettati correttamente tramite JS.

4. **Validazione finale**:
   - Confermare all'utente che la pagina ora risponde al CSS centrale.
