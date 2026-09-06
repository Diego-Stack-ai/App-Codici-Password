# Contratto di accesso dati local-first

Contratto introdotto in M2 per separare progressivamente le pagine dalla cache e dalla rete.

## Percorso canonico

`pagina → vault-repository → offline-firestore → cache persistente Firestore / server`

- La pagina richiede dati di dominio e non sceglie la sorgente.
- `vault-repository.js` centralizza percorsi e query ricorrenti.
- `request-coordinator.js` accorpa richieste contemporanee con la stessa chiave semantica.
- `offline-firestore.js` restituisce prima la cache valida; online aggiorna Firestore in background oppure usa il server quando la cache manca.
- Non viene aggiunta una cache applicativa permanente: si evita di avere due fonti locali discordanti.

## Regole

1. La chiave di deduplicazione include dominio, UID e identificatori necessari.
2. Una Promise viene rimossa appena conclusa, anche in errore; una lettura successiva può quindi ottenere dati aggiornati.
3. Utenti, aziende e record diversi non possono condividere la stessa Promise.
4. Le scritture restano sui percorsi esistenti finché non è definito il modello M6 di conflitto e coda offline.
5. Un errore di refresh remoto non deve cancellare un risultato locale valido.
6. Nessun dato decifrato viene conservato dal repository.
7. La lettura remota/cache può essere condivisa, ma ogni consumatore riceve nuovi oggetti: la decifratura o la normalizzazione di una pagina non contamina le altre.

## Domini migrati nel primo incremento M2

- lista Account privati e contatori della relativa dashboard;
- inviti accettati e record condivisi collegati;
- Top Account privati;
- contatti della dashboard privata;
- lista Aziende;
- lista Account di una singola Azienda;
- lista Scadenze.
- Profilo, impostazioni del Profilo e widget;
- dettaglio Account aziendale, Dati azienda e caricamento del form Azienda;
- lettura principale del dettaglio Account privato, mantenendo il fallback per gli ID legacy.
- form Account privato e aziendale: caricamento del record in modifica e rubrica destinatari;
- pagina Impostazioni: profilo, configurazione QR e widget del profilo.
- configurazioni Scadenze per automezzi, documenti e generali;
- creazione/modifica Scadenza: configurazioni, profilo, rubrica e record in modifica;
- dettaglio Scadenza e relativo stato di notifica.

Allegati, sicurezza, Home e Archivio mantengono temporaneamente il vecchio adapter `offline-firestore.js` e verranno migrati per dominio prima di chiudere M2.
