# Architettura Sicurezza V1 — Codici & Password

> **Stato:** baseline architetturale approvata l'11 settembre 2026.  
> **Ambito:** dati riservati, credenziali, account privati e aziendali, widget, allegati, condivisioni, cache offline, notifiche, backup e recupero.  
> **Natura del documento:** architettura obiettivo e criterio vincolante per le decisioni future. Non certifica che il codice o i dati di produzione siano già conformi.  
> **Regola di cambiamento:** questa baseline non si modifica per adattarla a una singola funzione. Una modifica richiede motivazione, minaccia affrontata, impatto sui dati esistenti, piano di migrazione, rollback, test e approvazione esplicita del product owner.

## 1. Scopo

Codici & Password tratta informazioni il cui accesso improprio può produrre danni importanti: credenziali, PIN, informazioni bancarie, documenti, allegati e dati condivisi.

L'obiettivo è ottenere contemporaneamente:

1. confidenzialità: Firebase e gli operatori del servizio non devono conoscere il contenuto riservato;
2. integrità: alterazioni e sostituzioni devono essere rilevabili;
3. disponibilità: i dati devono poter essere consultati offline e recuperati in modo controllato;
4. autorizzazione: ogni operazione deve essere concessa soltanto al soggetto corretto;
5. minimizzazione: conservare soltanto ciò che serve;
6. reattività: le operazioni comuni devono apparire immediate senza ridurre la sicurezza;
7. evoluzione verificabile: nessuna migrazione implicita o riscrittura generale senza prove e rollback.

## 2. Principio centrale

> **Il dispositivo cifra e decifra. Firebase conserva. Le Security Rules proteggono le operazioni semplici. Le Cloud Functions governano le operazioni complesse. Il server non possiede le chiavi dei contenuti.**

La cifratura avviene prima dell'invio. Firestore, Storage e Functions ricevono ciphertext e metadati minimi. Le Functions non costituiscono il livello crittografico: costituiscono il livello di controllo per autorizzazioni, transazioni, condivisioni, revisioni, quote, notifiche e audit.

Il sistema deve applicare difesa in profondità: cifratura, autenticazione, autorizzazione, validazione, minimizzazione, isolamento delle chiavi, test, monitoraggio senza segreti e recupero controllato.

## 3. Fonti normative e tecniche

Questa baseline deriva principalmente da:

- [GDPR — Regolamento (UE) 2016/679](https://eur-lex.europa.eu/legal-content/IT/TXT/HTML/?uri=CELEX:32016R0679): protezione fin dalla progettazione e per impostazione predefinita, minimizzazione e misure proporzionate al rischio;
- [NIST SP 800-57 Part 1 Rev. 5](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final): gestione completa del ciclo di vita delle chiavi;
- [NIST SP 800-63B-4](https://csrc.nist.gov/pubs/sp/800/63/b/4/final): autenticazione digitale e livelli di garanzia;
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html): threat model, minimizzazione, cifratura autenticata e separazione chiavi/dati;
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html): generazione, custodia, rotazione, recupero e dismissione delle chiavi;
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): validazione e isolamento degli allegati;
- [Firebase Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started): autorizzazione e validazione server-side delle richieste client;
- [Firebase App Check](https://firebase.google.com/docs/app-check): attestazione del client complementare ad Authentication.

Queste fonti definiscono principi e controlli. La conformità legale effettiva richiede anche valutazione professionale rispetto a finalità, titolarità, utenti, paesi e categorie di dati trattate.

## 4. Modello delle minacce minimo

Il progetto deve considerare almeno:

| Minaccia | Controllo architetturale |
|---|---|
| Accesso al database o backup | Dati riservati cifrati lato client; chiavi assenti dal server |
| Account Firebase compromesso | Separazione tra autenticazione e sblocco del Vault; MFA/passkey; revoca dispositivi |
| Client contraffatto o automazione abusiva | Authentication, App Check, Rules, rate limit e quote |
| Utente che modifica campi non autorizzati | Allowlist di campi, tipi, dimensioni, proprietario e revisioni |
| Function o amministratore curioso | Function riceve ciphertext e metadati minimi, mai chiavi Vault o plaintext |
| XSS o dipendenza frontend compromessa | CSP rigorosa, niente script inline, dipendenze bloccate, audit e riduzione superficie |
| Alterazione del ciphertext | Cifratura autenticata e AAD che lega proprietario, record, tipo e versione |
| Riutilizzo di nonce/IV | Nonce casuale e unico per ogni operazione secondo il contratto crittografico |
| Furto o smarrimento dispositivo | Blocco Vault, sessione limitata, revoca dispositivo, dati locali cifrati |
| Condivisione revocata | Rotazione delle chiavi per le versioni future; limite delle copie già viste dichiarato |
| Allegato malevolo | Formati limitati, firma/tipo/dimensione verificati, apertura controllata |
| Cancellazione o corruzione | Cestino cifrato, backup autenticato, versioni e prova periodica di ripristino |
| Log o notifica rivelatrice | Nessun segreto, allegato o contenuto Vault nei log, push, email o analytics |

Prima di una modifica strutturale deve essere indicato quale rischio viene ridotto e quale nuovo rischio viene introdotto.

## 5. Classificazione dei dati

### 5.1 Segreti e contenuto riservato

Devono essere sempre cifrati prima di lasciare il dispositivo:

- password, PIN, codici dispositivi e codici di recupero;
- numeri di carta, CCV, IBAN quando associabile a una persona o account;
- risposte di sicurezza;
- username, email o codici quando fanno parte del contenuto del Vault;
- note, campi widget e valori personalizzati;
- contenuto e metadati sensibili degli allegati;
- payload delle condivisioni;
- cronologia e cestino contenenti dati del Vault.

### 5.2 Metadati tecnici minimi

Possono restare leggibili dal servizio soltanto quando indispensabili:

- UID proprietario e destinatario;
- identificatori casuali;
- schemaVersion, revision, keyGeneration e stato transazionale;
- timestamp tecnici;
- dimensione e tipo generico dell'oggetto quando necessari alle Rules;
- stato di invito, autorizzazione, revoca o consegna;
- preferenze tecniche delle notifiche.

Titoli, nomi account, nomi file, descrizioni e testi delle scadenze non devono essere considerati innocui per impostazione predefinita.

### 5.3 Dati esclusi

Non devono essere salvati se non necessari alla funzione. Debug, telemetry e audit non devono duplicare contenuti del Vault.

## 6. Contratto crittografico obiettivo

1. Usare cifratura autenticata, con algoritmo e formato versionati. Il riferimento applicativo è AES-256-GCM tramite Web Crypto.
2. Ogni record protetto utilizza una chiave casuale dedicata oppure un modello equivalente formalmente documentato.
3. Ogni allegato utilizza una chiave-file casuale dedicata.
4. Le chiavi dati vengono avvolte da chiavi superiori; non vengono memorizzate in chiaro accanto al ciphertext.
5. L'AAD deve legare almeno versione, proprietario, tipo, identificatore e, quando applicabile, generazione/revisione.
6. Nonce/IV non possono essere riutilizzati con la stessa chiave.
7. Il formato salvato deve contenere versione dell'algoritmo e parametri necessari alla lettura, mai la chiave.
8. La Master Password non coincide con la password Firebase e non viene inviata al server.
9. Password, Vault Key, chiavi private decifrate e chiavi di record/file non devono entrare in localStorage, log, URL o analytics.
10. Le chiavi sbloccate restano in memoria per la durata strettamente necessaria.
11. Ogni evoluzione del formato richiede doppio lettore, migrazione verificata, integrità, rollback e rimozione legacy separata.

Parametri KDF, formato degli envelope e strategia di recupero devono essere raccolti in un contratto crittografico tecnico versionato e sottoposti ad audit indipendente prima di dichiarare la soluzione matura.

## 7. Autenticazione, Vault e dispositivi

Firebase Authentication dimostra l'identità remota; non autorizza automaticamente la decifratura del Vault.

Il modello deve separare:

- credenziale di accesso Firebase;
- fattore forte o passkey/MFA;
- segreto di sblocco del Vault;
- materiale di recupero;
- identità crittografica usata per le condivisioni.

Requisiti:

- verifica email quando prevista;
- MFA o passkey per operazioni ad alto impatto;
- elenco e revoca dei dispositivi;
- timeout e blocco Vault;
- nuova autenticazione per esportazione, recupero, modifica sicurezza e operazioni distruttive;
- protezione contro tentativi ripetuti;
- nessuna biometria simulata: la biometria deve usare capacità reali del dispositivo e proteggere un segreto locale, non sostituire fittiziamente la crittografia.

App Check deve essere valutato e verificato in enforcement su Firestore, Storage e callable, senza considerarlo sostitutivo di Authentication o Rules.

## 8. Matrice Firestore diretto / Cloud Functions

Non esiste la regola «tutto deve passare dalle Functions». La decisione dipende dagli invarianti.

| Operazione | Percorso obiettivo | Condizioni |
|---|---|---|
| Lettura di un proprio record cifrato | Firestore diretto | Rules proprietario, schema noto, dati cifrati |
| Creazione/modifica di un proprio record semplice | Firestore diretto | Allowlist completa, tipi, dimensioni, UID immutabile, revisione coerente |
| Widget personale contenuto in un solo record | Firestore diretto ammesso | Stessi controlli dei normali account; nessun collegamento parziale |
| Widget comune collegato a più account | Cloud Function | Scrittura atomica dei collegamenti, revisioni e rollback |
| Invito e condivisione | Cloud Function | Controllo mittente/destinatario, grant, envelope e transazione |
| Accettazione, rifiuto e revoca | Cloud Function | Aggiornamento atomico di ACL, stato, generazione e notifiche |
| Cambio proprietario o permessi | Cloud Function | Operazione privilegiata e autenticazione recente |
| Aggiornamento di più documenti | Cloud Function | Atomicità, idempotenza e conflitto |
| Cancellazione coordinata record/allegati | Cloud Function | Inventario oggetti, cestino/ritenzione e retry |
| Quote, rate limit e audit affidabile | Cloud Function | Il client non può auto-certificare il proprio consumo |
| Registrazione preferenze locali semplici | Firestore diretto | Rules ristrette e valori enumerati |
| Invio email/push | Backend/Cloud Function | Nessun segreto nel messaggio; deduplicazione e autorizzazione |

Le Functions devono rifiutare richieste non autenticate, token/app non validi quando enforcement è attivo, payload inattesi, dimensioni eccessive, revisioni obsolete e operazioni non idempotenti.

Le librerie server Firebase bypassano le Firestore Security Rules: ogni Function deve implementare esplicitamente autorizzazione e validazione. Essere nel backend non rende automaticamente sicura un'operazione.

## 9. Prestazioni e risposta istantanea

La sicurezza non richiede di rendere lenta l'interfaccia.

Per le operazioni comuni:

1. validazione locale;
2. cifratura locale;
3. aggiornamento ottimistico della vista;
4. inserimento in una coda cifrata e osservabile;
5. scrittura diretta o Function secondo la matrice;
6. conferma, retry idempotente oppure rollback visibile.

L'interfaccia non deve dichiarare «salvato» se esiste soltanto una modifica in memoria. Deve distinguere almeno: locale, in sincronizzazione, sincronizzato, conflitto ed errore.

## 10. Offline, cache e conflitti

- Nessun plaintext del Vault in localStorage.
- IndexedDB e cache persistenti possono contenere soltanto ciphertext, envelope cifrati e metadati minimi.
- La coda offline deve essere cifrata, versionata e collegata all'UID.
- Ogni entità modificabile deve avere schemaVersion, revision e updatedAt assegnati o verificati in modo affidabile.
- Retry e callable devono essere idempotenti.
- I conflitti non devono produrre sovrascritture silenziose.
- Logout, cambio utente, revoca dispositivo e blocco Vault devono eliminare chiavi in memoria e impedire l'apertura della cache.
- La disponibilità offline di una condivisione già decifrabile implica che la revoca non può cancellare retroattivamente quella copia.

## 11. Allegati

### 11.1 Pipeline obbligatoria

1. selezione;
2. verifica dimensione massima;
3. allowlist estensione/formato;
4. verifica MIME senza fidarsi del valore fornito dal browser;
5. verifica firma/magic bytes quando applicabile;
6. nome oggetto casuale;
7. cifratura autenticata sul dispositivo con chiave-file dedicata;
8. caricamento come oggetto opaco;
9. salvataggio atomico o recuperabile del riferimento;
10. download autorizzato;
11. decifratura in memoria e apertura controllata.

Non utilizzare URL pubblici permanenti. Storage deve applicare least privilege e chiusura predefinita.

### 11.2 Scelta zero-knowledge

La baseline adotta come obiettivo **zero-knowledge per il contenuto**: il server non riceve l'allegato in chiaro.

Conseguenza dichiarata: un server che vede soltanto ciphertext non può eseguire una scansione antivirus completa del contenuto. Per ridurre il rischio:

- limitare inizialmente i formati;
- effettuare controlli locali prima della cifratura;
- non eseguire contenuti attivi;
- usare viewer sicuri o download esplicito;
- mantenere browser e dipendenze aggiornati;
- valutare una scansione locale o un ambiente isolato quando tecnicamente disponibile.

Una futura scansione server del plaintext costituirebbe una modifica sostanziale al modello zero-knowledge e richiederebbe nuova approvazione.

## 12. Condivisione

Il modello obiettivo usa chiavi per-record e grant per destinatario:

1. il proprietario cifra il record con una chiave casuale;
2. la chiave del record viene avvolta separatamente per ciascun destinatario autorizzato;
3. il backend verifica e registra ACL, stato, scadenza, ruolo e generazione;
4. il destinatario usa la propria identità crittografica per aprire il proprio envelope;
5. il backend non riceve plaintext o chiavi private decifrate;
6. gli allegati usano chiavi-file avvolte dalla chiave record o un contratto equivalente;
7. la revoca incrementa la generazione e protegge le versioni future;
8. una copia già vista, esportata o disponibile offline non può essere cancellata a distanza.

Notifiche, email e inviti contengono solo informazioni minime e non sostituiscono l'autorizzazione applicativa.

## 13. Backup, recupero e cancellazione

I backup reali devono essere:

- cifrati e autenticati;
- versionati;
- separati dalle chiavi necessarie ad aprirli;
- soggetti a controllo accessi e retention;
- provati periodicamente con ripristino su ambiente non produttivo.

Lo zero-knowledge comporta un limite: senza un materiale di recupero valido, il servizio non può ricostruire il Vault. Il prodotto deve scegliere e spiegare una strategia, per esempio recovery key, dispositivo fidato o recupero sociale. Nessuna chiave di recupero può essere inviata in log, ticket, screenshot o chat.

La cancellazione deve includere dati principali, indici, copie ricevute controllabili, allegati, cache del dispositivo e backup secondo la politica di retention. Deve essere verificabile e compatibile con eventuali obblighi di conservazione.

## 14. Log, notifiche e telemetria

Non devono contenere:

- password, PIN, codici, token o chiavi;
- plaintext del Vault;
- contenuto o nomi sensibili degli allegati;
- payload completi;
- URL con segreti;
- dati personali non necessari.

Gli errori possono includere codice tecnico, fase, versione, operazione, UID pseudonimizzato e correlation ID. Push ed email devono adottare modalità discreta predefinita e aprire una destinazione interna che ripete autenticazione e autorizzazione.

## 15. Requisiti GDPR e organizzativi

Oltre ai controlli tecnici servono:

- finalità e base giuridica definite;
- minimizzazione e retention;
- informativa comprensibile;
- gestione dei diritti dell'interessato;
- inventario dei trattamenti e dei fornitori;
- localizzazione e trasferimenti dei dati verificati;
- procedura incidenti/data breach;
- ruoli e accessi amministrativi minimi;
- valutazione d'impatto quando richiesta dal rischio;
- revisione periodica delle misure.

«Dato sensibile» nel linguaggio comune non coincide sempre con «categoria particolare di dati» in senso GDPR. Credenziali, PIN e documenti restano comunque segreti ad altissimo impatto.

## 16. Gate obbligatori prima della produzione

Una modifica a cifratura, chiavi, Rules, Functions, condivisione, allegati, backup o migrazione non può essere dichiarata pronta senza:

- threat model aggiornato;
- inventario dei dati e dei metadati;
- test unitari e di integrazione;
- emulatori Firestore e Storage;
- test negativo per utenti anonimi, estranei, revocati e payload alterati;
- test offline, conflitto e retry;
- test su almeno i dispositivi/browser ufficialmente supportati;
- piano di migrazione e rollback;
- backup della copia di collaudo e prova di ripristino;
- verifica che log e notifiche siano privi di segreti;
- approvazione esplicita del product owner;
- audit indipendente prima di dichiarare la crittografia professionalmente matura.

## 17. Stato del repository al momento dell'approvazione

L'11 settembre 2026 il repository presenta elementi già coerenti e altri ancora candidati:

- esiste cifratura AES-GCM e un inventario dei campi cifrati;
- Storage applica isolamento per UID e riconosce upload opachi marcati come cifrati;
- molte scritture proprietario sono ancora consentite direttamente dalle Rules;
- i nuovi Account Widget e i domini condivisi sono function-only;
- il modello con chiave per-record, grant, rotazione e allegati condivisi risulta documentato e collaudato in laboratorio, ma non autorizzato come migrazione di produzione;
- il gate automatico M0–M10 risulta documentato come superato;
- matrice fisica completa, verifica delle configurazioni reali e audit crittografico indipendente restano gate separati.

Queste osservazioni sono una fotografia documentale, non una certificazione runtime. Il successivo audit confronterà codice, Rules, Functions e tutti i Markdown con questa baseline.

## 18. Metodo per l'audit dei documenti esistenti

Prova candidata locale 12/09/2026, base `553a35d5`: compatibilità del gestore in RAM con verifier/envelope v2 e CPVK2 su soli dati sintetici; anteprima statica separata pronta per eventuale pubblicazione autorizzata. [Audit Vault §13](./AUDIT_VAULT_SESSION_P0.md#13-compatibilità-e-anteprima-offline--12092026) registra limiti e minacce. Nessuna modifica a baseline, dati o formato produttivo.

Attuazione sperimentale autorizzata 12/09/2026, base `a6f756cc`: [prototipo di navigazione persistente](./AUDIT_VAULT_SESSION_P0.md#11-prototipo-autorizzato--12092026), escluso dal runtime pubblico, con sola fixture fittizia. Dimostra un flusso con chiave in RAM ma non cambia gli invarianti o la classificazione di conformità dell’app reale.

Secondo aggiornamento di attuazione locale del 12/09/2026, base `67288cc3`: operazioni Vault pendenti invalidate dopo logout/blocco/reset e cambio UID; nessuna variazione della baseline o dei formati. [Audit Vault §9–10](./AUDIT_VAULT_SESSION_P0.md#9-correzione-locale-del-12092026--operazioni-concorrenti) distingue la correzione concorrente dalla proposta, ancora da scegliere, di navigazione persistente.

Aggiornamento di attuazione locale, 12/09/2026, base v1.2.110: pulizia esplicita della sessione prima di tutti i sette logout applicativi; dettagli, prove e rollback in [Audit Vault §8](./AUDIT_VAULT_SESSION_P0.md#8-correzione-locale-del-12092026--blocco-1-logout). Questa nota non modifica la baseline approvata: formato, persistenza fra pagine e gate crittografici restano invariati e non certificati. Nessuna distribuzione implicita.

Ogni Markdown sarà classificato senza modificarlo automaticamente:

| Esito | Significato |
|---|---|
| Uguale | La decisione coincide con questa baseline |
| Compatibile | Non contraddice la baseline, ma descrive solo una parte |
| Compatibile ma incompleto | Mancano vincoli, stato o gate necessari |
| In conflitto | Prescrive un comportamento incompatibile |
| Da sostituire | Duplica o mantiene come attuale un modello superato |
| Storico | Utile come traccia, ma non deve guidare nuove modifiche |
| Da verificare | L'affermazione richiede controllo nel codice o nell'ambiente reale |

Il rapporto di confronto deve riportare per ogni file: scopo, versione/stato, punti coincidenti, divergenze, rischi, modifica proposta e priorità. Soltanto dopo approvazione si aggiorneranno i documenti interessati.

## 19. Decisioni non ancora chiuse

La baseline stabilisce la direzione, ma richiede decisioni separate e documentate su:

- parametri definitivi della KDF;
- modalità WebAuthn/passkey e fallback;
- strategia di recupero zero-knowledge;
- formati allegato ammessi al rilascio;
- retention di cestino, audit e backup;
- metadati delle scadenze da cifrare;
- politica di ricerca su dati cifrati;
- cutover dal formato legacy al record-key;
- politica esatta per widget singoli e widget comuni;
- matrice dei dispositivi/browser supportati.

Questi punti non autorizzano soluzioni temporanee silenziose.

## 20. Formula decisionale finale

Quando si progetta una funzione nuova, l'ordine obbligatorio è:

1. classificare dati e minacce;
2. minimizzare;
3. stabilire cosa viene cifrato sul dispositivo;
4. stabilire chi possiede e recupera le chiavi;
5. scegliere Firestore diretto o Function tramite la matrice;
6. definire offline, conflitto e rollback;
7. scrivere test e gate;
8. ottenere approvazione;
9. implementare;
10. collaudare prima del deploy.

La convenienza del codice esistente non può prevalere sulla protezione dei dati, ma la sicurezza non giustifica una riscrittura non misurata e non reversibile.

Verifica locale 12/09/2026, base `ff006c71`: il laboratorio invalida anche le dipendenze dei tentativi di sblocco annullati e gestisce gli errori di smontaggio. Nessuna modifica della baseline o attivazione produttiva; [audit §15](./AUDIT_VAULT_SESSION_P0.md#15-annullamento-e-robustezza-del-laboratorio--12092026).
