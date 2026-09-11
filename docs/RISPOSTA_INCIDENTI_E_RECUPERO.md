# Risposta agli incidenti e recupero

> **Stato:** attivo come procedura organizzativa; contatti e responsabilità da completare  
> **Autorità:** contratto specialistico subordinato ad [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md)  
> **Versione:** 1.0 riallineata  
> **Ultima verifica:** 11 settembre 2026

## Priorità

Proteggere i dati e impedire nuove modifiche viene prima del ripristino del servizio. Non inserire mai password, Master Password, Vault Key, Recovery Key, token, allegati o contenuti decifrati in ticket, screenshot, log o chat.

## Procedura

1. interrompere deploy e migrazioni; annotare versione, orario, dispositivo e azione tecnica senza dati personali;
2. se sono coinvolti accessi, revocare sessioni e ruotare le credenziali amministrative pertinenti;
3. se sono coinvolte Rules o Functions, ripristinare l'ultima versione verificata e conservare le evidenze tecniche;
4. lavorare su una copia isolata; verificare integrità e proprietario prima di importare un backup;
5. ripristinare prima in staging, confrontare conteggi e digest, poi applicare in transazione;
6. verificare login, sblocco, lettura, scrittura, condivisione, offline e recupero su due dispositivi;
7. documentare causa, impatto, correzione e prevenzione prima di riaprire la pubblicazione.

Un backup non verificato non deve mai sovrascrivere il Vault attivo. In assenza della Recovery Key non si promette il recupero dei dati cifrati.


## Classificazione minima

| Gravità | Esempi | Prima azione |
|---|---|---|
| Critica | chiave/credenziale amministrativa esposta, Rules aperte, plaintext sul server, accesso non autorizzato | contenimento immediato, blocco deploy e conservazione evidenze sicure |
| Alta | bypass autorizzazione, revoca errata, perdita dati, backup non recuperabile | sospendere il flusso e valutare rollback |
| Media | metadati eccessivi o log improprio senza segreti | ridurre l’esposizione e correggere |
| Bassa | errore senza impatto su confidenzialità, integrità o disponibilità | registrare e pianificare |

## Regole aggiuntive

- Non riprodurre con dati reali quando basta un ambiente di test.
- Non cancellare un segreto dalla sola versione corrente pensando di averlo rimosso dalla cronologia: revocarlo o ruotarlo.
- Distinguere sempre codice nel repository e configurazione realmente distribuita.
- Ricordare che Admin SDK nelle Functions bypassa le Security Rules.
- Non attivare App Check enforcement senza prova dei client legittimi e non lasciarlo disattivato senza rischio e scadenza documentati.
- Una possibile esposizione del Vault richiede anche la valutazione della rotazione delle credenziali contenute: ricifrare non rende segreti valori già copiati.
- Quando sono coinvolti dati personali, coinvolgere il referente privacy/legale e valutare gli obblighi applicabili. Questo documento non sostituisce consulenza legale.

## Chiusura dell’incidente

L’incidente si chiude soltanto quando causa radice, contenimento, correzione, test, eventuale ripristino, monitoraggio, aggiornamento dei contratti e azioni preventive sono documentati e approvati.

## Informazioni organizzative da completare

Prima del go-live con più utenti definire: incident commander, referente Firebase, referente privacy/legale, canale di emergenza, accesso break-glass, proprietari delle credenziali ruotabili, tempi di escalation e modello di comunicazione agli utenti.
