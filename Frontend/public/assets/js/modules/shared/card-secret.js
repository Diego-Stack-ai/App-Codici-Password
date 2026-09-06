import { decrypt, ensureMasterKey } from '../core/security-manager.js';

/**
 * Crea un risolutore lazy per un segreto mostrato direttamente in una card.
 * Il valore in chiaro resta soltanto nella closure della card dopo una richiesta
 * esplicita dell'utente e non viene scritto in storage o nel documento sorgente.
 */
export function createCardSecretResolver(value, encrypted) {
    let resolvedValue = encrypted ? null : value;
    return async () => {
        if (resolvedValue != null) return resolvedValue;
        const masterKey = await ensureMasterKey();
        resolvedValue = await decrypt(value, masterKey);
        return resolvedValue;
    };
}
