# Inventario dei campi cifrati

> **Stato:** fotografia M1 incompleta rispetto al runtime corrente  
> **Autorità:** inventario tecnico, non decisione architetturale  
> **Baseline:** [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md)  
> **Ultima revisione documentale:** 11 settembre 2026

> **Gate P0:** prima di migrare o rimuovere campi, rigenerare l’inventario su codice e dati reali tramite output esclusivamente aggregato. Includere widget, credenziali comuni, scadenze, notifiche, allegati, cache e tutti i metadati in chiaro.

Inventario M1 ricavato dalle chiamate a `encrypt`, `decrypt` ed `encryptAttachmentFile`. Il formato testuale è gestito da `crypto-utils.js`; gli allegati nuovi sono blob AES-GCM con wrapping per-file.

| Documento / area | Campi cifrati osservati |
|---|---|
| `users/{uid}` profilo | `note`; nei dati legacy anche `nome`, `cognome`, `cf`, `birth_place` possono essere letti cifrati |
| `users/{uid}.documenti[]` | `num_serie`, `cf_value`, `id_number`, `license_number`, `cf`, `rilasciato_da`, `luogo_rilascio`, `username`, `password`, `pin`, `puk`, `codice_app`, `note`, `categoria`, `home_page` |
| `users/{uid}.contactEmails[]` | `password`, `note` |
| `users/{uid}.userAddresses[].utilities[]` | `value` |
| `users/{uid}/accounts/{accountId}` | `username`, `account`/`codice`, `password`, `note`, `banking[].passwordDispositiva`, `banking[].cards[].cardNumber`, `pin`, `ccv` |
| account nelle aziende | `username`, `account`/`codice`, `password`, `numeroIscrizione`, `codiceSocieta`, `note`, `banking[].passwordDispositiva`, `banking[].cards[].cardNumber`, `pin`, `ccv` |
| `users/{uid}/aziende/{aziendaId}` | `note`, `emails.pec.password`, `emails.amministrazione.password`, `emails.personale.password`, `emails.extra[].password` |
| allegati privati, azienda e scadenze | contenuto completo; il record conserva URL/percorso e metadati `encryption` |
| widget profilo | `valueEnc` quando il campo dichiara `encrypted` |

## Campi deliberatamente non cifrati nel modello attuale

Restano leggibili dal modello applicativo date e metadati necessari alle liste, telefoni e indirizzi del profilo, anagrafiche aziendali, destinatari email e regole delle Scadenze. È una descrizione dello stato corrente, non una decisione definitiva.

## Compatibilità

- `_encrypted` segnala i documenti che richiedono decifratura selettiva.
- `decrypt` prova la chiave primaria e, quando presente, il fallback del keyring legacy.
- M1 non riscrive documenti, non rimuove fallback e non cambia lo schema Firestore.

## Verifica circoscritta UI 1.2.118 — 13/09/2026

Base `445b338d`, UI `d2ef897e`: nei writer privato e aziendale `banking[].numeroVerde` e `banking[].referenteNome` sono metadati in chiaro, come i telefoni bancari. Password dispositiva, numero carta, PIN e CCV mantengono la cifratura esistente. È una descrizione del codice, non una chiusura dell’inventario globale o una nuova decisione di sicurezza. Nessuna lettura o riscrittura di dati reali durante la preparazione del rilascio.

## Metadati posizione Widget — candidata 1.2.119, 13/09/2026

banking[].bankId e accountWidgets.bankId sono identificativi tecnici non cifrati, privi di IBAN o dati personali. Cifratura e validazione dei valori Widget restano quelle esistenti. Il campo sensibile viene ancora inviato esclusivamente come valueEnc. Nessun dato reale letto o migrato; verifica circoscritta del codice su base a6699e8d, non chiusura dell'inventario globale.
