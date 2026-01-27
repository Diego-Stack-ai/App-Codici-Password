---
description: Protocollo di Sicurezza Operativo per Antigravity
---

# WORKFLOW STANDARD OPERATIVO

Questo protocollo deve essere consultato ed eseguito per ogni richiesta dell'utente che comporti modifiche al codice, alla struttura o alla UI del progetto.

### 1. FASE DI ANALISI E RIFERIMENTO (OBBLIGATORIA)
- **Rilettura Regole**: Eseguire IMMEDIATAMENTE il tool `view_file` sul file `FRONTEND_RULES.md` per caricarne il contenuto. Non fare affidamento sulla memoria.
- **Verifica Cronologia**: Usare `git log -p` o `git show` sui file oggetto della modifica per capire se ci sono stati inserimenti di dati o testi recenti che non devono essere persi.
- **Identificazione Dati Critici**: Individuare testi (Privacy, FAQ, Regole), variabili di logica e identificatori (ID) che devono rimanere invariati.

### 2. FASE DI PROPOSTA E ASCOLTO (OBBLIGATORIA)
- **Nessuna Scrittura Immediata**: Prima di usare `write_to_file` o `replace_file_content`, descrivere all'utente il piano d'azione.
- **Dettaglio Modifiche**: Indicare chiaramente:
    - Quali righe verranno modificate.
    - Quali blocchi verranno aggiunti.
    - **COSA NON VERRÀ TOCCATO** (es. testi inseriti dall'utente).
- **Attesa Approvazione**: Procedere solo dopo aver ricevuto conferma esplicita dell'utente.

### 3. FASE DI ESECUZIONE CHIRURGICA
- **Modifiche Mirate**: Utilizzare `replace_file_content` o `multi_replace_file_content` per agire solo sulle parti necessarie. Evitare di sovrascrivere l'intero file.
- **Protezione Commenti**: Non rimuovere commenti di sviluppo o note dell'utente senza autorizzazione.
- **Integrità Regole**: Assicurarsi che l'azione non modifichi involontariamente i file delle regole (`FRONTEND_RULES.md`, `TITANIUM_EFFECTS.md`).

### 4. REPORT POST-INTERVENTO
- **Riepilogo Azioni**: Elencare esattamente cosa è stato cambiato.
- **Checklist Titanium**: Confermare la coerenza con il design system (Glow, Blur, Palette).
- **Stato dei Dati**: Confermare che i dati importanti (come i testi di backup) sono stati preservati.
