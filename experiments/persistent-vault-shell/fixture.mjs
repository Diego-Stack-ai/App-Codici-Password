// Public, synthetic demonstration credential. Never use with real data.
const demoPhrase = 'SOLO DATI FITTIZI - NON UNA PASSWORD UTENTE';
const encoder = new TextEncoder();
async function demoKey(salt) {
    const input = await crypto.subtle.importKey('raw', encoder.encode(demoPhrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000}, input,
        {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
export async function createFixture() {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await demoKey(salt);
    const records = {};
    for (const [name, value] of Object.entries({
        overview: 'Profilo dimostrativo · 1 account fittizio',
        account: 'Gestore demo · numero fittizio 000 000000 · codice DEMO-2076',
        lists: JSON.stringify([
            {id: 'demo-private', nomeAccount: 'Gestore personale demo', username: 'utente.fittizio', password: 'PASSWORD-FITTIZIA', company: false},
            {id: 'demo-company', nomeAccount: 'Gestore aziendale demo', username: 'azienda.fittizia', password: 'PASSWORD-FITTIZIA', company: true}
        ])
    })) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        records[name] = {iv, ciphertext: await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, encoder.encode(value))};
    }
    // Returned closure contains salt/ciphertext only; the derived key is recreated on explicit unlock.
    return {records, unlockKey: demoKey.bind(null, salt)};
}
export async function decryptRecord(key, record) {
    return new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: record.iv}, key, record.ciphertext));
}
