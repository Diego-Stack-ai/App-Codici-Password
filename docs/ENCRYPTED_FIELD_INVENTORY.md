# Inventario dei campi cifrati

> **Stato:** fotografia M1 incompleta rispetto al runtime corrente  
> **Autorità:** inventario tecnico, non decisione architetturale  
> **Baseline:** [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md)  
> **Ultima revisione documentale:** 11 settembre 2026

> **Gate P0:** prima di migrare o rimuovere campi, rigenerare l’inventario su codice e dati reali tramite output esclusivamente aggregato. Includere widget, credenziali comuni, scadenze, notifiche, allegati, cache e tutti i metadati in chiaro.

Inventario M1 ricavato dalle chiamate a `encrypt`, `decrypt` ed `encryptAttachmentFile`. Il formato testuale è gestito da `crypto-utils.js`; gli allegati nuovi sono blob AES-GCM con wrapping per-file.

Compatibilità sperimentale 12/09/2026, base `553a35d5`: verifier/envelope v2 e CPVK2 letti dal gestore in RAM su fixture sintetiche tramite le funzioni originali. Nessuna scrittura o trasformazione dei record. La cache offline dell’anteprima contiene solo file statici fittizi, non sessioni sbloccate o dati reali. [Evidenze](./AUDIT_VAULT_SESSION_P0.md#13-compatibilità-e-anteprima-offline--12092026).

Laboratorio 12/09/2026, base `a6f756cc`: `persistent-vault-shell` usa due record fittizi AES-GCM solo in RAM. Nessun campo reale aggiunto o migrato; fixture e credenziale pubblica del laboratorio non sono un nuovo formato Vault produttivo. [Perimetro](./AUDIT_VAULT_SESSION_P0.md#11-prototipo-autorizzato--12092026).

Seconda verifica di impatto 12/09/2026, base `67288cc3`: i contatori che invalidano sblocchi/salvataggi precedenti restano solo in RAM. Nessun campo aggiunto allo schema o allo storage. Il cambio Master Password conserva i contenitori cifrati di una scrittura già completata, ma non riapre la Vault dopo logout. [Prove e limiti](./AUDIT_VAULT_SESSION_P0.md#9-correzione-locale-del-12092026--operazioni-concorrenti).

Verifica di impatto 12/09/2026, correzione locale logout su base v1.2.110: nessuna aggiunta/rimozione o ricifratura di campi. Cambia soltanto il momento della pulizia della RAM Vault e delle chiavi `vault_session_v1`, `codex_vault_session_wrapping_key_v1`, `vault_s_key`, `vault_s_expiry`, ora prima di tutti i logout espliciti. Verifier, envelope e contenitori WebAuthn non vengono cancellati. L’inventario dei dati reali resta aperto; vedere [Audit Vault §8](./AUDIT_VAULT_SESSION_P0.md#8-correzione-locale-del-12092026--blocco-1-logout).

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
