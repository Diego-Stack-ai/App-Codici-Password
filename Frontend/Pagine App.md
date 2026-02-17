Pagine App:

Autenticazione \& Accesso:

index.html (Login)
registrati.html
reset\_password.html
imposta\_nuova\_password.html

Home \& Navigazione Principale:

home\_page.html
area\_privata.html
lista\_aziende.html

Gestione Aziende \& Account:
account\_azienda.html
dettaglio\_account\_azienda.html
form\_account\_azienda.html
modifica\_account\_azienda.html
dati\_azienda.html
modifica\_azienda.html
aggiungi\_nuova\_azienda.html
archivio\_account.html

Gestione Privati:
account\_privati.html
dettaglio\_account\_privato.html
form\_account\_privato.html
profilo\_privato.html

Gestione Scadenze:
scadenze.html
dettaglio\_scadenza.html
aggiungi\_scadenza.html

Impostazioni e Configurazioni.
impostazioni.html
regole\_scadenze.html
configurazione\_automezzi.html
configurazione\_documenti.html
configurazione\_generali.html

Altro:
notifiche\_storia.html
privacy.html
termini.html




Note per l’implementazione della sicurezza



End-to-End Encryption (E2EE)



Tutti i dati sensibili (password, note, credenziali) devono essere cifrati sul dispositivo dell’utente prima di essere inviati a Firebase.



Chiave privata generata localmente dall’utente. Solo l’utente può decifrare i propri dati.



Nota: questo garantisce che nemmeno il server possa leggere le informazioni.



Gestione Password



Al momento le password sono visibili su Firebase perché sei in fase di test.



Quando E2EE sarà implementata, le password saranno salvate cifrate.



Testare rigorosamente la cifratura e decifratura: evitare sistemi irreversibili senza backup della chiave, per non perdere l’accesso.



Backup della chiave privata



Introdurre un meccanismo sicuro di backup locale della chiave E2EE, ad esempio esportabile e protetto da password principale.



Non salvare mai la chiave privata in chiaro sul server.



Aggiornamento Privacy



Aggiornare la sezione “Privacy Estesa” una volta implementata E2EE, indicando chiaramente che nemmeno l’amministratore può leggere i dati.



Inserire note sulla sicurezza del backup delle chiavi e sui limiti di recupero in caso di perdita della chiave.



Logging e dati tecnici



Eventuali log tecnici non devono contenere dati sensibili decifrabili.



Continuare a usare protocolli SSL/TLS per tutte le connessioni.



Test di sicurezza



Prima della pubblicazione: testare cifratura/decifratura, backup e ripristino, e gestione dei permessi dei dati.



Valutare eventuali librerie E2EE consolidate per JS (es. CryptoJS

&nbsp;o libsodium.js

).

si deve inserire i flag per accettaione privaci e termini, va implentato autntcazne a due fattori sblocco con face id e tempo di inattivita

