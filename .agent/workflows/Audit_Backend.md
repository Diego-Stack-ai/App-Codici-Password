---
description: Protocollo di Audit Backend V8.0 - Verifica atomica e crittografica su Firebase
---

# Protocollo di Audit Backend (V8.0 Blindato)

Questo workflow esegue il comando categorico definito nella Sezione 24 della GUIDA.md per validare l'integrità dei dati e della crittografia.

## 🤖 Comando: audit_create_and_verify_accounts_v8()

### Obiettivo:
Verificare che la crittografia AES-256-GCM venga applicata correttamente durante la creazione di nuovi account e che i dati siano scritti in modo atomico su Firebase.

### Procedura:
1. Inizializza il vault assicurando la presenza della `masterKey`.
2. Crea record dummy (uno Privato e uno Ditta).
3. Esegue la cifratura forzata su: `utente`, `password`, `codice`, `note`.
4. Include il flag `_encrypted: true`.
5. Verifica che i dati salvati su Firebase non siano leggibili in chiaro.
6. Restituisce il report di audit.

### Regole Operative:
- **Crypto Silence**: Niente log in console dei dati processati.
- **Integrità**: Solo transazioni atomiche.

```javascript
// Esempio rapido di esecuzione
const result = await audit_create_and_verify_accounts_v8();
if (result.allFieldsPresent && result.cryptoBlindness) {
    // Audit Passato
}
```
