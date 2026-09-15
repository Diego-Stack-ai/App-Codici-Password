// Only connectivity failures qualify: permissions and decryption keep their own errors.
export function readErrorMessage(error, fallback, online = globalThis.navigator?.onLine) {
    const code = String(error?.code || '').replace(/^firestore\//, '');
    if (online === false && ['unavailable', 'deadline-exceeded', 'offline/cache-miss'].includes(code)) {
        return 'Questi dati non sono disponibili offline sul dispositivo. Connettiti a Internet e riapri la pagina per caricarli.';
    }
    return fallback;
}
