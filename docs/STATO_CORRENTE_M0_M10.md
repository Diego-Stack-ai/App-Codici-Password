# Stato corrente M0–M10 — fotografia operativa del 23/09/2026

> **Natura del documento:** vista **operativa, datata e NON normativa**. Non sostituisce la baseline di
> sicurezza, i contratti specialistici, il piano di maturazione né il registro di coordinamento: in caso
> di divergenza **valgono le fonti citate**, non questa fotografia. Non introduce decisioni, non chiude
> gate e non approva nulla.
>
> **Fotografia di:** ramo `integration/vault-shell-v127-security`, commit `3b7b96a636a18e3d00fda2fee0fc88b55961a752`
> (`3b7b96a6`, D01), **working tree pulito**, data **23/09/2026**. Versione in `package.json` invariata:
> `1.2.127`.
>
> **Perimetro della fotografia:** solo repository e documentazione versionata; **nessun** accesso a
> console, ambienti distribuiti, dati reali o dispositivi. Nessun codice, test, Rules, Functions,
> versione o dato reale è stato modificato per produrla.

## 1. Fonti autorevoli e loro precedenza

| Priorità | Fonte | Ruolo |
|---|---|---|
| 1 | [ARCHITETTURA_SICUREZZA_V1.md](./ARCHITETTURA_SICUREZZA_V1.md), [VAULT_KEY_CONTRACT.md](./VAULT_KEY_CONTRACT.md), [DATA_ACCESS_CONTRACT.md](./DATA_ACCESS_CONTRACT.md), [FUNCTIONAL_DATA_CONTRACT.md](./FUNCTIONAL_DATA_CONTRACT.md), [PAGE_SHELL_CONTRACT.md](./PAGE_SHELL_CONTRACT.md), [UI_DESIGN_SYSTEM_CONTRACT.md](./UI_DESIGN_SYSTEM_CONTRACT.md), [OFFLINE_WRITE_CONFLICT_POLICY.md](./OFFLINE_WRITE_CONFLICT_POLICY.md), [ENCRYPTED_FIELD_INVENTORY.md](./ENCRYPTED_FIELD_INVENTORY.md) | **Normative**: baseline di sicurezza e contratti |
| 2 | [PIANO_MATURITA_PROFESSIONALE.md](./PIANO_MATURITA_PROFESSIONALE.md) (§6 programma, §8 stato) | Programma M0–M10 e stato dichiarato delle fasi |
| 3 | [CENSIMENTO_GATE_M6_M10.md](./CENSIMENTO_GATE_M6_M10.md) (21/09/2026, aggiornato al 22/09) | Gate M6–M10 aperti, evidenza, dipendenze |
| 4 | [M6_SINCRONIZZAZIONE_OFFLINE.md](./M6_SINCRONIZZAZIONE_OFFLINE.md), [M7_RETENTION_CENSIMENTO.md](./M7_RETENTION_CENSIMENTO.md), [M7_CRONOLOGIA_CESTINO_AUDIT.md](./M7_CRONOLOGIA_CESTINO_AUDIT.md), [M8_BACKUP_RECUPERO.md](./M8_BACKUP_RECUPERO.md), [M9_SALUTE_CREDENZIALI.md](./M9_SALUTE_CREDENZIALI.md), [M10_HARDENING_RILASCIO.md](./M10_HARDENING_RILASCIO.md) | Contratti e censimenti specialistici per fase |
| 5 | [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) | Registro di coordinamento: incarichi, consegne `DA_VERIFICARE`, revisioni Codex |
| 6 | Questo documento | **Sola vista operativa datata**: nessuna autorità normativa |

**Regola di lettura.** Baseline e contratti (priorità 1) restano **normativi**; il piano (2) definisce il
programma; il censimento (3) e i contratti per fase (4) riportano evidenza e gate; il registro (5)
riporta chi ha consegnato e chi ha revisionato. **Questo file non sostituisce nessuno dei precedenti** e
la sua data **non rende automaticamente attuali** prove storiche: ogni riga della tabella §3 rimanda
alla fonte e alla data della sua ultima verifica disponibile, che resta quella.

## 2. Livelli da non confondere

| Livello | Che cosa è in questa fotografia | Che cosa **non** è |
|---|---|---|
| **Branch / repository** | Ramo `integration/vault-shell-v127-security` a `3b7b96a6`: codice, test e **69 file MD versionati** (conteggio `git ls-files "*.md"`, comprensivo del file nascosto `.github/copilot-instructions.md`) | Non è `master`; i commit dal 15/09/2026 in poi **non** sono distribuiti |
| **Runtime locale** | Moduli in `Frontend/public/**` presenti nel ramo (coda, lease, client, sincronizzatore, pilota) | Non è attivo per default: Web Locks resta prioritario e il lease è **opt-in** (`?m6pilot=1&m6lease=1`); la coda distribuita è ancora v1 |
| **Laboratorio** | Banchi `experiments/offline-sync/**` e suite Node, con dati sintetici, profili usa e getta, Chrome/Edge headless | Non è collaudo fisico, non è una PWA, non è una seconda scheda/dispositivo reale |
| **Build candidata** | I commit locali del ramo (M6-A-7, M6-A-8a…8e) non pubblicati | Non è una release: nessun bump di versione, nessun artefatto distribuito |
| **Distribuito** | Ciò che risulta pubblicato su Hosting secondo i documenti di rilascio (ultimo: `1.2.127`, 15/09/2026 — `M6_SINCRONIZZAZIONE_OFFLINE.md` §Rilascio isolato Auth) | Non contiene i lavori M6-A-7/M6-A-8*: nessun deploy li include |
| **Produzione** | Applicazione usata dagli utenti su `1.2.127` | Non è toccata da questa fotografia né dagli incarichi M6-A-8*: nessun dato reale, deploy o modifica a Rules/Functions |

## 3. Tabella M0–M10 — stato documentato, ultima verifica disponibile, gate aperti

Nessuna riga chiude un gate: dove il piano non registra una data, la data è indicata come **non dichiarata**.

| Fase | Stato documentato | Ultima verifica disponibile (data · fonte) | Gate ancora aperti |
|---|---|---|---|
| **M0** Baseline e congelamento contratti | **Completata** (piano §8) | 06/09/2026 · `PIANO_MATURITA_PROFESSIONALE.md` §8 · riscontri: [FUNCTIONAL_DATA_CONTRACT.md](./FUNCTIONAL_DATA_CONTRACT.md), [RUNTIME_PERFORMANCE_BASELINE.md](./RUNTIME_PERFORMANCE_BASELINE.md), [FILE_INVENTORY.md](./FILE_INVENTORY.md) | Nessun gate M0 registrato come aperto; obiettivi runtime su dispositivo non rimisurati (limite dichiarato) |
| **M1** Nomenclatura e contratti Vault | **Completata** (piano §8) | 06/09/2026 · piano §8 · riscontri: [VAULT_KEY_CONTRACT.md](./VAULT_KEY_CONTRACT.md), [ENCRYPTED_FIELD_INVENTORY.md](./ENCRYPTED_FIELD_INVENTORY.md) | Estensione inventario ai campi successivi e inventario reale; integrazione logout/blocco e conformità persistenza — P0 della chiave di wrapping in `sessionStorage` ([AUDIT_VAULT_SESSION_P0.md](./AUDIT_VAULT_SESSION_P0.md), 15/09/2026) |
| **M2** Data access local-first | **Completata** (piano §6/§8) | 06/09/2026 · piano §8 · riscontri: [DATA_ACCESS_CONTRACT.md](./DATA_ACCESS_CONTRACT.md), [OFFLINE_WRITE_CONFLICT_POLICY.md](./OFFLINE_WRITE_CONFLICT_POLICY.md) | Nessun gate M2 aperto; il cutover delle scritture offline è materia di M6 |
| **M3** Rifattorizzazione pagine | **Completata** (piano §8) | 06/09/2026 · piano §8 · riscontro: [CANONICAL_PAGE_REGISTRY.md](./CANONICAL_PAGE_REGISTRY.md) | Nessun gate M3 aperto nel piano |
| **M4** Componenti e design system | **Completata l'08/09/2026**; matrice estesa di regressione **trasferita a M10** (piano §8) | 08/09/2026 · piano §8 · riscontro: [M4_VISUAL_ACCEPTANCE.md](./M4_VISUAL_ACCEPTANCE.md) | Il gate vive in **M10-3** (matrice end-to-end su dispositivi e browser) |
| **M5** Condivisione professionale | **Laboratorio e architettura completati**; attivazione reale subordinata a collaudo fisico, M6, M8 e approvazione (piano §8) | Data non dichiarata nel piano §8; ultimo aggiornamento dei riscontri 08/09/2026 · [M5_PIANO_INTEGRAZIONE.md](./M5_PIANO_INTEGRAZIONE.md), [M5_CONDIVISIONE_THREAT_MODEL.md](./M5_CONDIVISIONE_THREAT_MODEL.md), [M5_INVENTARIO_DATI_CONDIVISI.md](./M5_INVENTARIO_DATI_CONDIVISI.md), [M5_COLLAUDO_DUE_DISPOSITIVI.md](./M5_COLLAUDO_DUE_DISPOSITIVI.md) | Collaudo su due dispositivi reali; attivazione reale della condivisione |
| **M6** Sincronizzazione e scritture offline | **Cutover privato isolato attivo**; consultazione bancaria iPhone e matrice completa aperte (piano §8). Nel ramo: lettore compatibile, upgrade additivo esplicito, scrittore v1/v2, pilota opt-in con lease e fencing | **23/09/2026** (ramo, commit `3b7b96a6`) · `M6_SINCRONIZZAZIONE_OFFLINE.md` (sezioni M6-CLOSE 18/09, M6-2 21/09, M6-1-LAB 22/09, M6-A-8b…8e 22–23/09); gate: `CENSIMENTO_GATE_M6_M10.md` (21/09, agg. 22/09) | **M6-1** (consultazione bancaria su iPhone e matrice completa), **M6-2** (adozione del fallback nel runtime distribuito, schema delle copie PWA installate, trasporto autenticato/App Check, concorrenza reale, collaudi fisici), **M6-3** (mutazioni sotto il nuovo schema, copie PWA precedenti, rollback distribuito); casi **7–8** della matrice §8 (dispositivi reali, PWA installata); **M6-F3** aperto |
| **M7** Cronologia, cestino e audit | **Funzioni e collaudo storico registrati**; retention complessiva **non approvata** (piano §8) | 21/09/2026 · [M7_RETENTION_CENSIMENTO.md](./M7_RETENTION_CENSIMENTO.md), [M7_CRONOLOGIA_CESTINO_AUDIT.md](./M7_CRONOLOGIA_CESTINO_AUDIT.md) e `CENSIMENTO_GATE_M6_M10.md`; approvazioni Codex M7-R1…R7C-1 del 21/09/2026 nel registro di coordinamento | **M7-1** (decisioni D1–D16 ancora aperte, parti residue di D3, bonifica record storici, vista utente, rilascio del job), **M7-2** (verifica esterna TTL/lifecycle: esito `non verificato`), **M7-3** (protocollo condiviso purge/ripristino e planner non attivato) |
| **M8** Backup e recupero | **Runtime e collaudo riuscito registrati**; interruzioni, staging e recupero complessivo **non certificati** (piano §8) | 22/09/2026 · [M8_BACKUP_RECUPERO.md](./M8_BACKUP_RECUPERO.md) e `CENSIMENTO_GATE_M6_M10.md`; domande in [M8_DOMANDE_RIPRISTINO_INTERROTTO.md](./M8_DOMANDE_RIPRISTINO_INTERROTTO.md), [M8_DOMANDE_RIPRISTINO_NUOVA_SESSIONE.md](./M8_DOMANDE_RIPRISTINO_NUOVA_SESSIONE.md), [M8_DOMANDE_RIPRISTINO_CAS_PARZIALE.md](./M8_DOMANDE_RIPRISTINO_CAS_PARZIALE.md) | **M8-1** (interruzioni fra blocchi e allegati; Q1–Q5, N1–N4, S1–S2 aperte), **M8-2** (staging/ripresa su copia non produttiva: staging non implementato), **M8-3** (limiti di memoria e matrice fisica) |
| **M9** Salute credenziali e integrazioni | **Analisi locale attiva e iPhone collaudato**; Windows e provider di rete aperti (piano §8) | 14/09/2026 · [M9_SALUTE_CREDENZIALI.md](./M9_SALUTE_CREDENZIALI.md); gate in `CENSIMENTO_GATE_M6_M10.md` | **M9-1** (collaudo fisico e accessibile su Windows con screen reader), **M9-2** (provider violazioni, privacy e consenso prima di qualsiasi rete) |
| **M10** Hardening e rilascio maturo | **Attiva**: gate statici e procedura incidenti presenti; restano verifiche reali, matrice fisica e audit indipendente (piano §8) | 22/09/2026 · [M10_REVISIONE_LOCALE.md](./M10_REVISIONE_LOCALE.md) (M10-1-REVIEW: 15 controlli automatici rieseguiti, nessuna vulnerabilità dimostrata, 4 voci da assegnare), [M10_GUIDA_UTENTE_BOZZA.md](./M10_GUIDA_UTENTE_BOZZA.md), [M10_REVISIONE_PRIVACY_PRELIMINARE.md](./M10_REVISIONE_PRIVACY_PRELIMINARE.md); [M10_HARDENING_RILASCIO.md](./M10_HARDENING_RILASCIO.md) (15/09/2026); gate in `CENSIMENTO_GATE_M6_M10.md` | **M10-1** (revisione OWASP finale firmata e audit indipendente; decisione PBKDF2 dei campi), **M10-2** (verifica in produzione di App Check/Rules/indici/log con approvazione esplicita), **M10-3** (matrice end-to-end fisica), **M10-4** (guida utente, privacy finale, informazioni organizzative) |
| **Post-M10** Lingue, Impostazioni, campi protetti | Programmata (piano §6) | — | Non avviata: fuori dal perimetro M0–M10 |

## 4. M6-A-8 — tracciabilità delle approvazioni

Distinzione richiesta fra **ciò che è nel repository** e **ciò che è stato comunicato fuori**.

- **Tracciabile nel repository:** **M6-A-1 → M6-A-8a R1** con revisioni Codex datate 22/09/2026 nel registro di coordinamento; l'ultima con esito `APPROVATO` è **M6-A-8a R1**, limitata al commit `99c78a0d` e alla compatibilità dello scrittore con lo schema v1/v2 nel ramo di sviluppo.
- **M6-A-8b** (`583c3d7c`), **M6-A-8c** (`a200a334`), **M6-A-8c R1** (`d0a1d71c`), **M6-A-8d** (`6ab70723`): nel repository risultano **solo rapporti `DA_VERIFICARE`**; **nessuna approvazione è rintracciata in repository** e in questa fotografia **non ne viene presunta alcuna**.
- **M6-A-8e** (`3b7b96a6`): nel repository è registrato come `DA_VERIFICARE`. In aggiunta è stata comunicata — **fuori dal repository** — un'**approvazione esterna** da **Sol il 23/09/2026 nella chat Harness**, **limitata al commit `3b7b96a6`** per la sola consegna M6-A-8e (casi 6, 6-bis, 6-ter come evidenza di laboratorio). Questa approvazione:
  - è **distinta** dalle prove presenti nel repository (che restano quelle dei banchi e delle suite, con i limiti dichiarati);
  - **non** chiude **M6** né i gate **fisici**, **PWA** o **produttivi**;
  - **non** chiude M6-1/M6-2/M6-3, **M6-F3**, la matrice delle copie installate, il messaggio definitivo o il rilascio.
- **Nota di datazione.** I commit di M6-A-8c/8c R1/8d/8e hanno data Git **2026-09-23**, mentre le sezioni corrispondenti di `M6_SINCRONIZZAZIONE_OFFLINE.md` sono intestate **22/09/2026**: la discrepanza è **dichiarata** e non va letta come due verifiche distinte.

## 5. Avvertenze e limiti di questa fotografia

- **Nessuna equiparazione a rilascio.** Prove locali, suite verdi e banchi di laboratorio **non** equivalgono a deploy, produzione o gate chiuso: i gate richiedono anche ambiente reale, dispositivi, decisioni di prodotto o audit esterni (vedi `CENSIMENTO_GATE_M6_M10.md` §3).
- **La data dello snapshot non aggiorna nulla.** Le date riportate sono quelle delle fonti; una prova del 21/09 non diventa "attuale" il 23/09.
- **Stato dei gate M0–M5.** Il censimento versionato copre M6–M10; per M0–M5 questa fotografia riporta solo quanto dichiarato dal piano e dai riscontri citati, senza aggiungere gate.
- **Nessun dato reale o segreto.** Identificatori e riferimenti sono quelli già presenti nei documenti versionati; nessun segreto, credenziale o dato personale è stato aggiunto.
- **Documenti non aggiornati da D01.** [FILE_INVENTORY.md](./FILE_INVENTORY.md) e questo file non sono registrati nell'inventario: l'aggiornamento dell'inventario non è parte di D01 e resta un passo separato.
- **Perimetro di D01.** Unico file creato: questo documento. Nessuna modifica a codice, test, altri MD, versione, Rules/Functions, dati reali, PWA o produzione; nessun push o deploy.
