# Gestione incidenti

## Sorveglianza quotidiana e canali di allarme — 03/11/2026

Ogni giorno alle 07:30 Europe/Rome viene controllata la sicurezza dell'app e del PC Windows di sviluppo. L'inventario deriva dai manifest, lockfile, workflow, configurazioni e versioni installate; comprende Windows, Chrome, Edge, Safari/WebKit per i client supportati, Node.js, npm, Firebase, Google Cloud, Git, GitHub, Actions, Firebase CLI e le librerie realmente usate dall'app.

Le fonti prioritarie sono gli advisory ufficiali dei produttori, GitHub Security Advisories, CISA KEV e NVD. Blog, social e Instagram possono suggerire una ricerca, ma non producono da soli un allarme. Se non emerge una novità applicabile il controllo resta silenzioso. Un allarme deve indicare componente e versione, advisory/CVE, gravità, sfruttamento noto, percorso interessato, mitigazione immediata, aggiornamento consigliato e fonti.

Il canale approvato è l'e-mail personale `boschettodiego@gmail.com`; il proprietario ne ha autorizzato esplicitamente l'uso per i soli avvisi di sicurezza privi di dati Vault e dati personali. WhatsApp sarà aggiunto soltanto tramite integrazione Business ufficiale; sono vietate automazioni non autorizzate dell'account personale. Un guasto del monitor o una decisione necessaria viene riportato nella chat di manutenzione. Il monitor non applica patch, non cambia configurazioni e non esegue commit, push o deploy.

Alla ricezione di un allarme: 1) confermare versione e raggiungibilità del componente; 2) classificare esposizione e dati coinvolti; 3) applicare eventuale mitigazione temporanea; 4) preparare aggiornamento in ramo revisionabile; 5) eseguire test di sicurezza e regressione; 6) pubblicare soltanto dopo autorizzazione; 7) registrare esito e versione corretta. Un CVE non applicabile viene documentato come tale per evitare falsi allarmi ripetuti.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

## Indice delle fonti conservate

- [RISPOSTA_INCIDENTI_E_RECUPERO.md](#fonte-docs-risposta-incidenti-e-recupero-md-l1)

<a id="fonte-docs-risposta-incidenti-e-recupero-md-l1"></a>

## Fonte: RISPOSTA_INCIDENTI_E_RECUPERO.md — righe originali 1–50

> Provenienza: `docs/RISPOSTA_INCIDENTI_E_RECUPERO.md` a `2900ccc0`.

<a id="fonte-docs-risposta-incidenti-e-recupero-md-risposta-agli-incidenti-e-recupero"></a>

## Risposta agli incidenti e recupero

> **Stato:** attivo come procedura organizzativa; contatti e responsabilità da completare\
> **Autorità:** contratto specialistico subordinato ad [Architettura Sicurezza V1](../regole/SICUREZZA.md#fonte-docs-architettura-sicurezza-v1-md-l1)\
> **Versione:** 1.0 riallineata\
> **Ultima verifica:** 11 settembre 2026

<a id="fonte-docs-risposta-incidenti-e-recupero-md-priorità"></a>

### Priorità

Proteggere i dati e impedire nuove modifiche viene prima del ripristino del servizio. Non inserire mai password, Master Password, Vault Key, Recovery Key, token, allegati o contenuti decifrati in ticket, screenshot, log o chat.

<a id="fonte-docs-risposta-incidenti-e-recupero-md-procedura"></a>

### Procedura

1. interrompere deploy e migrazioni; annotare versione, orario, dispositivo e azione tecnica senza dati personali;
2. se sono coinvolti accessi, revocare sessioni e ruotare le credenziali amministrative pertinenti;
3. se sono coinvolte Rules o Functions, ripristinare l'ultima versione verificata e conservare le evidenze tecniche;
4. lavorare su una copia isolata; verificare integrità e proprietario prima di importare un backup;
5. ripristinare prima in staging, confrontare conteggi e digest, poi applicare in transazione;
6. verificare login, sblocco, lettura, scrittura, condivisione, offline e recupero su due dispositivi;
7. documentare causa, impatto, correzione e prevenzione prima di riaprire la pubblicazione.

Un backup non verificato non deve mai sovrascrivere il Vault attivo. In assenza della Recovery Key non si promette il recupero dei dati cifrati.


<a id="fonte-docs-risposta-incidenti-e-recupero-md-classificazione-minima"></a>

### Classificazione minima

| Gravità | Esempi | Prima azione |
|---|---|---|
| Critica | chiave/credenziale amministrativa esposta, Rules aperte, plaintext sul server, accesso non autorizzato | contenimento immediato, blocco deploy e conservazione evidenze sicure |
| Alta | bypass autorizzazione, revoca errata, perdita dati, backup non recuperabile | sospendere il flusso e valutare rollback |
| Media | metadati eccessivi o log improprio senza segreti | ridurre l’esposizione e correggere |
| Bassa | errore senza impatto su confidenzialità, integrità o disponibilità | registrare e pianificare |

<a id="fonte-docs-risposta-incidenti-e-recupero-md-regole-aggiuntive"></a>

### Regole aggiuntive

- Non riprodurre con dati reali quando basta un ambiente di test.
- Non cancellare un segreto dalla sola versione corrente pensando di averlo rimosso dalla cronologia: revocarlo o ruotarlo.
- Distinguere sempre codice nel repository e configurazione realmente distribuita.
- Ricordare che Admin SDK nelle Functions bypassa le Security Rules.
- Non attivare App Check enforcement senza prova dei client legittimi e non lasciarlo disattivato senza rischio e scadenza documentati.
- Una possibile esposizione del Vault richiede anche la valutazione della rotazione delle credenziali contenute: ricifrare non rende segreti valori già copiati.
- Quando sono coinvolti dati personali, coinvolgere il referente privacy/legale e valutare gli obblighi applicabili. Questo documento non sostituisce consulenza legale.

<a id="fonte-docs-risposta-incidenti-e-recupero-md-chiusura-dellincidente"></a>

### Chiusura dell’incidente

L’incidente si chiude soltanto quando causa radice, contenimento, correzione, test, eventuale ripristino, monitoraggio, aggiornamento dei contratti e azioni preventive sono documentati e approvati.

<a id="fonte-docs-risposta-incidenti-e-recupero-md-informazioni-organizzative-da-completare"></a>

### Informazioni organizzative da completare

Prima del go-live con più utenti definire: incident commander, referente Firebase, referente privacy/legale, canale di emergenza, accesso break-glass, proprietari delle credenziali ruotabili, tempi di escalation e modello di comunicazione agli utenti.
