import { auth } from '../../firebase-config.js?v=1.2.157';
import { listContacts } from '../data/vault-repository.js';

const normalizeEmail = email => String(email || '').trim().toLowerCase();
const fullName = contact => [contact?.nome, contact?.cognome].filter(Boolean).join(' ').trim() || contact?.email || '';

/**
 * Il dettaglio Account è intenzionalmente di sola lettura per tipologia e
 * condivisione. Carica esclusivamente i nomi della rubrica necessari a rendere
 * leggibile la lista; destinatari, canali e tipologia si gestiscono nel form
 * Crea/Modifica, unico writer client di questo flusso.
 */
export async function loadDetailSharingContactNames({ownerId, readOnly = false, isActive = () => true, signal} = {}) {
    const active = () => !signal?.aborted && isActive();
    if (!active() || readOnly || !ownerId || auth.currentUser?.uid !== ownerId) return new Map();
    try {
        const ownerEmail = normalizeEmail(auth.currentUser?.email);
        const contacts = await listContacts(ownerId);
        if (!active()) return undefined;
        return new Map(contacts
            .filter(contact => contact?.active !== false)
            .filter(contact => contact?.uid !== ownerId && contact?.id !== ownerId)
            .map(contact => [normalizeEmail(contact?.email), fullName(contact)])
            .filter(([email, name]) => email && email !== ownerEmail && name));
    } catch (error) {
        if (!active()) return undefined;
        console.warn('[DetailSharing] Rubrica non disponibile', error);
        return new Map();
    }
}
