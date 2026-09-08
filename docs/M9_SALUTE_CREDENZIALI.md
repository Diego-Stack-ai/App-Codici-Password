# M9 — Salute credenziali e integrazioni

## Confine di sicurezza

L'analisi di password deboli, duplicate e datate avviene soltanto in memoria, sul dispositivo e dopo lo sblocco del Vault. Il risultato contiene esclusivamente identificatore del record e categorie di rischio. Le impronte usate per trovare duplicati sono HMAC con una chiave casuale effimera: non vengono persistite, sincronizzate o registrate.

Il laboratorio k-anonimo calcola SHA-1 unicamente per interoperare con servizi di controllo violazioni basati su range: soltanto i primi cinque caratteri potrebbero essere inviati. L'integrazione di rete resta disattivata finché provider, privacy, timeout, cache, risposta e consenso non sono verificati. Password, suffisso e hash completo non devono mai lasciare il dispositivo.

Una passkey salvata per accedere a un servizio è un dato del record e non può sbloccare il Vault. La passkey WebAuthn/PRF locale di sblocco resta disciplinata da `VAULT_KEY_CONTRACT.md`.

Autofill ed estensione browser costituiscono un progetto separato: richiedono associazione forte dell'origine, conferma esplicita, protezione da phishing, messaggistica autenticata e un audit dedicato. Non entrano nel bootstrap della PWA.

## Gate

- [x] rilevamento locale debole, duplicata e datata dimostrato con fixture;
- [x] risultati privi di password e impronte persistenti;
- [x] contratto k-anonimo definito e testato senza rete;
- [x] passkey servizio distinta dalla passkey di sblocco Vault;
- [x] autofill separato dal progetto PWA e dal percorso critico;
- [x] integrazione UI caricata su richiesta dopo lo sblocco: analisi Web Crypto in memoria di Account privati e aziendali, senza persistenza di password o impronte;
- [ ] verifica privacy e sicurezza del provider prima di abilitare il controllo violazioni;
- [ ] collaudo fisico e accessibile su iPhone e Windows.

M9 non abilita automaticamente alcuna integrazione esterna.

Per i record correnti la data dedicata `passwordUpdatedAt` ha precedenza. Nei record legacy che non la possiedono, `updatedAt` è usata soltanto come stima prudenziale dell'ultimo salvataggio delle credenziali; una futura modifica dello schema dovrà aggiornare la data dedicata esclusivamente quando cambia la password.
