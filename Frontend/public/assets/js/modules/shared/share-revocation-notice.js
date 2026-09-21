// La raccolta `notifications` di un utente è scrivibile solo dal suo proprietario
// (firestore.rules:106-118): il client del proprietario di un Account non può
// scrivere in quella dell'ospite. La notifica di revoca viene quindi tentata
// FUORI dalla transazione che rimuove l'accesso, in modo non bloccante: un errore
// non annulla la revoca e non viene mai presentato come notifica consegnata.
export async function attemptShareRevocationNotice(attempt, {log = () => {}} = {}) {
    if (typeof attempt !== 'function') return Object.freeze({status: 'unavailable'});
    try {
        await attempt();
        return Object.freeze({status: 'delivered'});
    } catch (error) {
        const code = error?.code ?? null;
        try { log('SHARE_REVOCATION_NOTICE_NOT_DELIVERED', code); } catch {}
        return Object.freeze({status: 'not-delivered', code});
    }
}

export function shareRevocationNotice({accountName, ownerEmail, guestEmail} = {}) {
    return {
        title: 'Accesso Revocato',
        message: `Il proprietario ha rimosso il tuo accesso a: ${accountName || 'un account condiviso'}.`,
        accountName: accountName || 'Account',
        type: 'share_revoked',
        ...(ownerEmail ? {ownerEmail} : {}),
        ...(guestEmail ? {guestEmail} : {}),
        timestamp: new Date().toISOString(),
        read: false
    };
}
