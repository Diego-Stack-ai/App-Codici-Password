# Guida del progetto — Codici & Password

> **Stato:** attivo  
> **Autorità:** indice documentale centrale  
> **Versione:** 1.0  
> **Ultima verifica:** 11 settembre 2026  
> **Regola:** questo documento indica dove trovare la regola autorevole. Non sostituisce i contratti specialistici.

## 1. Scopo

Codici & Password è una PWA local-first per custodire e condividere in modo controllato credenziali, dati riservati, scadenze e allegati.

La documentazione distingue sempre:

- **contratto:** ciò che deve essere rispettato;
- **stato corrente:** ciò che il codice fa realmente;
- **roadmap:** ciò che è approvato ma non ancora completato;
- **audit:** fotografia verificata a una versione o commit;
- **laboratorio:** prova isolata, non attiva in produzione;
- **storico:** materiale conservato che non guida nuovi sviluppi.

## 2. Ordine obbligatorio di lettura

Prima di modificare il progetto:

1. leggere questa guida;
2. leggere [ARCHITETTURA_SICUREZZA_V1.md](./ARCHITETTURA_SICUREZZA_V1.md);
3. consultare il contratto specifico dell’area interessata;
4. verificare [GUIDA_AGGIORNAMENTI.md](../Frontend/GUIDA_AGGIORNAMENTI.md) per attività aperte e rischi;
5. controllare Rules, Functions, codice e test reali: la documentazione non sostituisce la verifica;
6. definire impatto, test, migrazione e rollback prima di modificare dati, crittografia o autorizzazioni.

## 3. Gerarchia delle fonti

In caso di conflitto prevale il documento di livello superiore.

| Livello | Fonte | Funzione |
|---:|---|---|
| 1 | `ARCHITETTURA_SICUREZZA_V1.md` | Principi e decisioni di sicurezza non negoziabili |
| 2 | Contratti specialistici in `docs/` | Regole tecniche della singola area |
| 3 | `Frontend/GUIDA.md` | Regole consolidate di implementazione, UI e comportamento |
| 4 | `Frontend/GUIDA_AGGIORNAMENTI.md` | Roadmap, attività aperte e cronologia |
| 5 | Audit, collaudi e baseline generate | Evidenze legate a data, versione o commit |
| 6 | `experiments/` e documenti storici | Prove che non autorizzano il runtime |

Una dichiarazione più recente non prevale automaticamente: deve avere autorità adeguata ed essere approvata.

## 4. Mappa dei documenti autorevoli

| Argomento | Documento principale | Stato |
|---|---|---|
| Sicurezza generale | [ARCHITETTURA_SICUREZZA_V1.md](./ARCHITETTURA_SICUREZZA_V1.md) | Attivo |
| Vault e terminologia delle chiavi | [VAULT_KEY_CONTRACT.md](./VAULT_KEY_CONTRACT.md) | Attivo, da verificare sul codice |
| Funzioni e dati visibili | [FUNCTIONAL_DATA_CONTRACT.md](./FUNCTIONAL_DATA_CONTRACT.md) | Fotografia M0 |
| Accesso ai dati local-first | [DATA_ACCESS_CONTRACT.md](./DATA_ACCESS_CONTRACT.md) | Attivo, transitorio |
| Campi cifrati | [ENCRYPTED_FIELD_INVENTORY.md](./ENCRYPTED_FIELD_INVENTORY.md) | Inventario da aggiornare |
| Condivisioni | [M5_CONDIVISIONE_THREAT_MODEL.md](./M5_CONDIVISIONE_THREAT_MODEL.md) e [M5_PIANO_INTEGRAZIONE.md](./M5_PIANO_INTEGRAZIONE.md) | Target candidato |
| Offline e conflitti | [M6_SINCRONIZZAZIONE_OFFLINE.md](./M6_SINCRONIZZAZIONE_OFFLINE.md) e [OFFLINE_WRITE_CONFLICT_POLICY.md](./OFFLINE_WRITE_CONFLICT_POLICY.md) | Parzialmente attivo |
| Cronologia e cestino | [M7_CRONOLOGIA_CESTINO_AUDIT.md](./M7_CRONOLOGIA_CESTINO_AUDIT.md) | Contratto candidato |
| Backup e recupero | [M8_BACKUP_RECUPERO.md](./M8_BACKUP_RECUPERO.md) | Laboratorio/candidato |
| Salute credenziali | [M9_SALUTE_CREDENZIALI.md](./M9_SALUTE_CREDENZIALI.md) | Laboratorio/candidato |
| Hardening e rilascio | [M10_HARDENING_RILASCIO.md](./M10_HARDENING_RILASCIO.md) | Gate automatico + verifiche reali aperte |
| Widget e coerenza Account | [PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md](./PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md) | In evoluzione |
| Risposta agli incidenti | [RISPOSTA_INCIDENTI_E_RECUPERO.md](./RISPOSTA_INCIDENTI_E_RECUPERO.md) | Attivo |
| Pagine canoniche | [CANONICAL_PAGE_REGISTRY.md](./CANONICAL_PAGE_REGISTRY.md) | Attivo |
| Guida implementativa/UI | [GUIDA.md](../Frontend/GUIDA.md) | Da consolidare |
| Attività aperte | [GUIDA_AGGIORNAMENTI.md](../Frontend/GUIDA_AGGIORNAMENTI.md) | Registro operativo |
| Audit di riallineamento | [AUDIT_MARKDOWN_ARCHITETTURA_SICUREZZA_V1.md](./AUDIT_MARKDOWN_ARCHITETTURA_SICUREZZA_V1.md) | Evidenza 11/09/2026 |

## 5. Regole per aggiornare la documentazione

Ogni documento manuale nuovo o revisionato deve dichiarare:

- stato;
- autorità;
- versione o commit di riferimento;
- ultima verifica;
- codice o area interessata;
- dipendenze;
- documento sostituito, se esiste.

Quando cambia il codice:

| Modifica | Documento da aggiornare |
|---|---|
| Cifratura, KDF, envelope o sessione Vault | Architettura sicurezza + contratto Vault + inventario cifratura |
| Schema Firestore o campi | Contratto funzionale + inventario cifratura |
| Rules o percorso diretto/Function | Architettura sicurezza + contratto area + roadmap |
| Condivisione o revoca | Documenti M5 |
| Cache, offline o conflitti | Documenti M6 + policy conflitti |
| Cestino, cronologia o cancellazione | M7 |
| Backup o recupero | M8 + risposta incidenti |
| CSP, App Check o release gate | M10 |
| UI strutturale o pagine | Guida implementativa + registro pagine |
| Widget o campi Account | Roadmap Profilo/Account/Widget/Cache |

I report generati devono essere rigenerati, non corretti manualmente.

## 6. Regole per gli agenti AI

Un agente deve:

1. distinguere fatto verificato, inferenza e proposta;
2. non dichiarare produzione ciò che esiste soltanto in laboratorio;
3. non modificare dati reali, Rules, Functions, cifratura o deploy senza autorizzazione esplicita;
4. non creare nuove varianti di pagina o nuovi contratti duplicati;
5. non inserire segreti, token, dati Vault o dati personali nei log, commit, report o chat;
6. preservare compatibilità legacy fino a inventario, migrazione e rollback approvati;
7. aggiornare il contratto interessato nello stesso lavoro che cambia una regola consolidata;
8. fermarsi se due fonti autorevoli sono in conflitto e registrare la decisione;
9. verificare il codice e i test, non affidarsi soltanto al testo;
10. indicare chiaramente ciò che richiede collaudo su Firebase o dispositivi reali.

## 7. Gate documentale

Prima di considerare completa una revisione:

- nessun collegamento Markdown interno rotto;
- una sola fonte autorevole per argomento;
- stato reale separato da target e laboratorio;
- nessuna contraddizione con la baseline sicurezza;
- file generati aggiornati;
- commit e data di verifica riportati negli audit;
- attività aperte registrate nella roadmap;
- modifiche distruttive accompagnate da backup, migrazione e rollback.

## 8. Prossima fase

Dopo il consolidamento degli MD, il progetto deve essere ricontrollato integralmente rispetto ai contratti:

1. crittografia e ciclo delle chiavi;
2. persistenza locale e sessione Vault;
3. Firestore Rules e percorsi di scrittura;
4. Cloud Functions e autorizzazioni Admin SDK;
5. Storage e allegati;
6. condivisione e revoca;
7. offline, coda e conflitti;
8. backup, recupero e cancellazione;
9. App Check, CSP, dipendenze e logging;
10. test automatici e collaudo reale su iPhone e Windows.

L’esito dovrà essere un audit separato con prove, gravità, file interessati e piano di correzione. Il riordino documentale non equivale a certificazione del progetto.
