# Evoluzione Agente Codex — audit e roadmap locale

> Audit eseguito il 10/09/2026 sulla v1.2.90. Questo documento approva l'architettura progressiva; non autorizza ancora il download di modelli, API esterne o azioni automatiche sui dati.

## Decisione

L'Agente deve evolvere come orchestratore locale a livelli, mantenendo sempre disponibile il motore deterministico attuale. La priorità non è installare subito un LLM, ma costruire una conoscenza forte e verificabile dell'app. Il percorso raccomandato è:

1. regole e ricerca locale attuali;
2. conoscenza strutturata per pagina e guida contestuale;
3. ricerca semantica locale opzionale sulla sola documentazione;
4. piccolo LLM locale opzionale sui dispositivi compatibili;
5. eventuale LLM remoto soltanto come funzione futura, esplicita e non necessaria.

Il livello base deve continuare a funzionare senza API, senza PC del proprietario e almeno parzialmente offline per ogni utente.

## Inventario attuale

| Componente | Responsabilità | Dimensione | gzip indicativo |
|---|---|---:|---:|
| `assistant-controller.js` | apertura, sblocco Vault, caricamento dati e ciclo di vita | 3.383 B | 1.255 B |
| `assistant-ui.js` | dialogo, testo/voce, risultati, mostra/copia credenziali | 12.119 B | 3.336 B |
| `conversation-engine.js` | token, sinonimi, fuzzy match, ordinali e apertura | 5.615 B | 1.998 B |
| `vault-data-loader.js` | profilo, documenti, Account, aziende e Scadenze | 4.781 B | 1.659 B |
| `search-normalizer.js` | normalizzazione lessicale | 211 B | 175 B |
| `vault-assistant.css` | interfaccia responsive chiara/scura | 9.009 B | 2.435 B |

Il codice funzionale dell'Agente pesa circa 35 KB non compressi e 10,9 KB gzip, esclusi Firebase e i dati. È caricato su richiesta soltanto se la funzione è attiva. La shell offline include già questi file.

## Flusso ricostruito

1. `main-v129.js` identifica la pagina e, nelle pagine private, legge l'impostazione dell'Agente.
2. Il controller viene importato dinamicamente e collega il comando del footer.
3. Al primo tocco richiede il materiale della Vault e carica l'indice dell'utente.
4. Il loader interroga profilo, Account privati, aziende, Account aziendali e Scadenze tramite il repository condiviso.
5. Il motore normalizza la domanda, elimina parole comuni, applica sinonimi e somiglianza testuale e conserva gli ultimi risultati per frasi come “apri il secondo”.
6. La UI mostra risultati navigabili. Username e codice vengono decifrati per il risultato; la password resta mascherata e viene decifrata soltanto dopo il comando esplicito mostra/copia.

Non esistono chiamate LLM, embeddings o invio automatico di contenuti a servizi AI. La voce tenta il riconoscimento locale quando disponibile; l'eventuale servizio vocale del browser richiede una seconda azione esplicita e riguarda soltanto ciò che viene pronunciato.

## Dati inclusi ed esclusi

Attualmente entrano nell'indice testuale: nomi di profilo, tipi di documento, nomi Account, aziende, Scadenze, categorie, URL, referente e alcuni metadati aziendali. I metadati cifrati dei documenti non entrano nell'indice. Le credenziali non partecipano alla ricerca testuale: restano associate al risultato in forma memorizzata e vengono decifrate dalla UI quando necessario.

L'audit ha rilevato questi limiti:

- nessun contesto della pagina corrente viene passato all'Agente;
- nessuna conoscenza di scopo, campi, obbligatorietà, collegamenti o errori frequenti;
- testi e sinonimi sono quasi interamente italiani;
- record archiviati, condivisi e memorandum non hanno ancora una politica di indicizzazione esplicita;
- la qualità offline dipende dalla disponibilità effettiva della cache Firestore, già oggetto del gate offline separato;
- il loader ricostruisce l'intero indice al primo utilizzo e non misura separatamente lettura, decifratura e ricerca;
- un campo cifrato non decifrato non è semanticamente ricercabile, condizione corretta per sicurezza ma da rendere esplicita;
- non esistono memoria conversazionale persistente, pianificazione di azioni o conferme strutturate.

## Conoscenza specifica delle pagine

La sorgente runtime proposta è un manifest JSON versionato, generato e validato in build a partire dal registro canonico e da schede Markdown mantenute dall'uomo. Gli MD restano la documentazione leggibile; il JSON evita di interpretare testo libero nel browser e impedisce duplicazioni incontrollate.

Schema minimo per ogni pagina:

```json
{
  "pageId": "form_account_privato",
  "route": "/form_account_privato.html",
  "family": "internal-form",
  "purposeKey": "assistant.pages.privateAccountForm.purpose",
  "fields": [
    {
      "id": "nomeAccount",
      "labelKey": "account_name",
      "required": true,
      "whyKey": "assistant.fields.accountName.why",
      "sensitivity": "metadata"
    }
  ],
  "actions": ["save-draft", "open-account-list"],
  "links": ["account_privati", "dettaglio_account_privato"],
  "commonErrors": ["missing-required-field", "offline-linked-record"],
  "tutorialId": null
}
```

`pageId` deve provenire dallo stesso router usato dall'app ed essere passato al controller come oggetto immutabile. Le chiavi linguistiche traducono soltanto contenuti dell'app. Titoli creati dall'utente, come “Casa al mare”, restano invariati; eventuali traduzioni personali saranno campi separati e facoltativi.

Il primo catalogo deve coprire le 29 pagine canoniche. `prova.html`, modali e pagine archiviate non vi entrano. Un test deve fallire quando una pagina canonica non possiede una scheda o quando una scheda cita campi/azioni inesistenti.

## Contratto di accesso ai dati

| Livello | Contenuto consentito | Regola |
|---|---|---|
| D0 | documentazione e manifest dell'app | sempre locale, nessun Vault necessario |
| D1 | pagina, stato UI non sensibile, tipi e validazioni | locale, nessuna persistenza conversazionale |
| D2 | nomi e metadati dell'utente autorizzati | soltanto dopo sblocco; indice cifrato o effimero |
| D3 | username, codici, email e dati bancari | solo per richiesta pertinente e risultato selezionato |
| D4 | password, PIN, PUK, CVV e segreti equivalenti | mai in embeddings, log o prompt remoto; mostra/copia soltanto con gesto esplicito |

Il modello, se presente, non riceve mai D4. Le azioni future usano comandi tipizzati e una lista chiusa: il modello può proporre una bozza, ma il codice applicativo valida e l'utente conferma. Cancellazioni, condivisioni, invii, cambi di sicurezza e sovrascritture restano vietati all'esecuzione automatica.

## Roadmap tecnica

### A0 — irrobustire la base attuale

- esportare un unico `getCurrentPageContext()` dal router;
- definire esplicitamente inclusione di Account, memorandum, condivisi e archivio;
- separare indice di metadati dal risolutore delle credenziali;
- aggiungere tempi diagnostici senza contenuti e test di privacy;
- conservare ricerca e apertura attuali come fallback universale.

### A1 — guida contestuale senza LLM

- creare schede Markdown e manifest delle 29 pagine;
- gestire intenti come “a cosa serve”, “dove inserisco”, “perché”, “cosa posso fare”;
- collegare campi, validazioni, errori frequenti e percorsi correlati;
- proporre navigazione e wizard, senza scrivere dati;
- integrare le chiavi di traduzione solo dopo la stabilizzazione funzionale.

Questa fase offre il maggiore beneficio con costo cloud zero, peso minimo, risultati verificabili e piena compatibilità offline.

### A2 — ricerca semantica locale opzionale

- usare un piccolo modello di embeddings quantizzato eseguito in Web Worker;
- calcolare in build gli embeddings della documentazione statica;
- calcolare sul dispositivo soltanto la domanda, non password o segreti;
- mantenere un indice piccolo, versionato e ricostruibile;
- usare WASM come fallback e WebGPU soltanto quando rilevato;
- scaricare il modello solo dopo consenso, mostrando peso, spazio libero e possibilità di rimozione.

Prima dell'adozione servono benchmark reali su iPhone, Android e Windows. Transformers.js supporta inferenza WebGPU e quantizzazione a 4/8 bit, ma documenta ancora differenze di compatibilità; non va inserito nel bootstrap.

### A3 — piccolo LLM locale installabile

Un modello da 0,5–1,5B parametri quantizzato può migliorare parafrasi e dialogo, ma non è una base universale. Le configurazioni pubbliche WebLLM indicano per un modello da 1B circa 879–1.129 MB di VRAM a seconda della quantizzazione, oltre a pesi, runtime, cache e memoria temporanea. Il primo download può essere di centinaia di MB o oltre, incide su traffico, spazio, avvio, temperatura e batteria.

Requisiti del laboratorio isolato:

- rilevamento `navigator.gpu`, limiti GPU, RAM/storage stimati e modalità risparmio;
- Web Worker dedicato, generazione breve e annullabile;
- modello non incluso nella shell né nel deploy ordinario;
- download volontario, barra di progresso, integrità dei file, cache cancellabile;
- prompt composto soltanto da D0–D2 e risultati D3 strettamente necessari;
- fallback immediato ad A1 in assenza di capacità o dopo errore.

Safari 26 ha introdotto WebGPU, ma il supporto dell'API non garantisce che ogni iPhone abbia memoria e prestazioni sufficienti. La PWA deve quindi eseguire un benchmark fisico prima di offrire A3.

### A4 — remoto opzionale futuro

Un provider remoto potrà essere solo una funzione premium/avanzata attivata dall'utente, con budget, consenso per richiesta, redazione locale e divieto assoluto di D4. Non è richiesto per utilizzare l'Agente né per le funzioni di base.

## Video tutorial

Il video Home è protetto, richiesto soltanto dopo un gesto, scaricato con token e non precaricato. La stessa regola va mantenuta. Ogni tutorial deve avere `tutorialId`, pagina, durata, dimensione, trascrizione, capitoli e versione; l'Agente usa trascrizione e capitoli, non il video.

Prima di estendere i video occorre fissare un budget per pagina e misurare il traffico. Firebase Hosting conteggia il trasferimento anche quando il file è servito dal CDN; il piano gratuito indicato dalla documentazione offre 10 GB/mese, oltre i quali il costo pubblicato è 0,15 USD/GB sul piano Blaze. Per questo i video devono essere opzionali, compressi, mai nella precache e preferibilmente pochi e riutilizzabili.

## Storage locale e cloud personale

Cache Storage è adatto ad asset e modelli scaricati; IndexedDB ai manifest, indici e configurazioni; OPFS può essere valutato per grandi file in un Worker. Prima di un download si usa `navigator.storage.estimate()` e si può richiedere persistenza. La cache non è un backup: quote ed espulsione dipendono dal browser e i dati dell'origine possono essere rimossi.

Google Drive, OneDrive e iCloud possono in futuro conservare un pacchetto modello o configurazioni, ma aggiungono OAuth, permessi, disponibilità e sincronizzazione e non eseguono inferenza. Non portano vantaggio alla prima roadmap e restano esclusi.

## Costi previsti

| Soluzione | Cloud ricorrente | Costo sul dispositivo | Valutazione |
|---|---:|---:|---|
| A0/A1 regole + manifest | circa zero | trascurabile | raccomandata subito |
| A2 embeddings locali | hosting/download del modello | decine di MB, CPU/GPU moderata | pilota dopo benchmark |
| A3 piccolo LLM locale | hosting/download potenzialmente elevato | centinaia di MB–oltre 1 GB, RAM/batteria elevate | opzionale, non universale |
| A4 LLM remoto | costo per token/richiesta | rete e privacy | futuro premium/fallback |
| storage personale | API generalmente non di inferenza | login, sync e manutenzione | nessuna implementazione ora |

## Gate prima di implementare

1. approvare schema del manifest e contratto D0–D4;
2. realizzare A0/A1 con fixture, senza cambiare la Vault;
3. verificare tutte le 29 pagine e il fallback offline;
4. misurare tempi/peso dell'indice su account piccolo e grande;
5. solo dopo, creare un laboratorio A2 isolato e non pubblicato;
6. provare WebGPU/WASM su iPhone, Android e Windows;
7. decidere separatamente se A3 giustifica download, memoria e batteria;
8. sottoporre accesso ai dati e azioni tipizzate all'audit di sicurezza.

Non viene creata ora una prova LLM: prima servono il manifest di pagina e una misura reale delle capacità del dispositivo. Questa scelta evita di aggiungere peso e dipendenze prima di avere un caso d'uso verificabile.

## Ordine operativo post M0–M10

1. Agente Codex A0/A1: contesto e conoscenza per pagina senza LLM;
2. collaudo fisico Windows online;
3. collaudo offline sistematico con F12 sulle 29 pagine;
4. correzione della consultazione offline reale emersa dal collaudo;
5. rifiniture UI rinviate, inclusi lucchetti, modali, watermark, sticky, glass e animazioni;
6. audit indipendente di crittografia, condivisione, backup e nuovo contratto Agente;
7. per ultime, lingue e riordino definitivo delle Impostazioni.

La lista passa quindi da sei a sette attività: l'evoluzione dell'Agente è un lavoro autonomo che precede i collaudi e non deve essere nascosto dentro le rifiniture UI.

## Fonti tecniche

- [Apple — Safari 26: supporto WebGPU](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes)
- [MDN — WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Hugging Face — Transformers.js su WebGPU](https://huggingface.co/docs/transformers.js/en/guides/webgpu)
- [Hugging Face — modelli quantizzati](https://huggingface.co/docs/transformers.js/main/guides/dtypes)
- [MLC — WebLLM](https://github.com/mlc-ai/web-llm)
- [MDN — StorageManager](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager)
- [MDN — quote ed espulsione dello storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Firebase — quote e prezzi Hosting](https://firebase.google.com/docs/hosting/usage-quotas-pricing)
