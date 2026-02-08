---
description: 
---

11. Regole di condivisone:
1) Tipi di contenuto (solo 1 modalità attiva)

Esistono 3 opzioni selezionabili, ma in realtà rappresentano 4 stati:

Account normale (nessun flag attivo)

Account condiviso (flag-shared)

Memorandum (flag-memo)

Memorandum condiviso (flag-memo-shared)

⚠️ Regola fondamentale: può essere attivo solo UNO dei 3 flag alla volta.

2) Regole sui campi (coerenza dati)
A) Memorandum / Memorandum condiviso

Se attivo:

flag-memo oppure flag-memo-shared

➡️ allora i campi:

Username/Email

Codice Account

Password

devono essere tutti vuoti.

Se anche solo uno è popolato:

il flag NON si può attivare

popup: “Per usare Memorandum devi prima svuotare Username / Codice / Password”

B) Account condiviso

Se attivo:

flag-shared

➡️ allora deve essere popolato almeno 1 tra:

Username/Email

Codice Account

Password

Se sono tutti vuoti:

il flag NON si può attivare

popup: “Per condividere un account devi inserire almeno Username, Codice o Password”

3) Regole di esclusione (mutua esclusione)

Quando l’utente attiva uno dei 3 flag:

gli altri 2 vengono automaticamente disattivati

e tutte le UI/azioni collegate agli altri flag vengono annullate:

dropdown contatti nascosto

contatto selezionato azzerato

eventuali inviti locali annullati (UI)

4) Dropdown contatti obbligatorio (solo per condivisioni)
Se attivo flag-shared oppure flag-memo-shared

➡️ deve comparire il menu a tendina contatti (inizialmente nascosto).

L’utente è obbligato a:

selezionare un contatto (email utente app)

Se prova a salvare senza contatto selezionato:

popup: “Per salvare devi scegliere un contatto o disattivare il flag”

salvataggio bloccato

5) Contatti: cosa sono

I contatti NON sono numeri di telefono o rubrica esterna.

Sono:

email di utenti che usano la tua app

servono per condivisione account/memorandum e inviti

6) Procedura invito condivisione (flusso completo)
Quando il proprietario salva con un flag condiviso attivo:

viene creato un invito verso l’email selezionata

L’utente invitato:

apre la sua app

riceve una notifica in home

L’utente invitato può:
A) Rifiutare

il proprietario riceve notifica: “Account/Memorandum condiviso NON accettato”

cliccando OK:

sull’account si rimuove automaticamente il flag di condivisione relativo (o comunque la share)

B) Accettare

il proprietario riceve notifica: “Account accettato”

nei dettagli account si vede con chi è condiviso

7) Condivisioni multiple

Un account può essere condiviso con più utenti, MA:

solo il proprietario può aggiungere nuove condivisioni

tutte le condivisioni sono visibili nei dettagli account

8) Annullamento condivisione (da entrambi)
Dopo che l’invito è accettato: appare un pulsante “Annulla condivisione”. Questo pulsante vale sia per:

Proprietario (colui che ha originariamente condiviso)
Invitato (l’utente che ha accettato la condivisione)
Quando viene annullata la **condivisione, il sistema provvede a:

Rimuovere l’email dell’invitato dall’elenco degli accessi del documento.
Nascondere immediatamente l’account dalla lista “Condivisi” dell’invitato.
Inviare una notifica di sistema a entrambi per confermare la revoca dell’accesso.**
9) Sicurezza dei dati condivisi
Solo l'utente proprietario può modificare i dati core dell'account (password, username, note).
L'utente invitato ha accesso in sola lettura (Read-Only) a meno che non venga implementata esplicitamente una modalità "Editor".
Se il proprietario decide di eliminare l'account, tutte le condivisioni attive vengono cancellate automaticamente e l'account scompare dai dispositivi di tutti gli invitati.
10) Gestione della Privacy (Password Visibility)
Anche in modalità condivisa, l'occhio per mostrare la password segue le regole di log: ogni volta che un invitato visualizza la password, il sistema può registrare l'evento nella storia dell'account (per motivi di audit/sicurezza).
