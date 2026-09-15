import {parseAccountDestination} from './account-route.mjs';
const sources = new Set(['contactEmails', 'contactPhones', 'documenti']);

export function profileAccountLink(item, collection, uid) {
    if (!item?.linkedAccountId) return null;
    if (!sources.has(collection) || typeof item.id !== 'string' || !item.id) throw new Error('PROFILE_LINK_INVALID');
    if (typeof item.linkedAccountId !== 'string' || (item.linkedAccountCompanyId && typeof item.linkedAccountCompanyId !== 'string')) throw new Error('PROFILE_LINK_INVALID');
    const companyId = item.linkedAccountCompanyId || undefined;
    const url = `dettaglio_account_${companyId ? 'azienda' : 'privato'}.html?id=${encodeURIComponent(item.linkedAccountId)}` +
        (companyId ? `&aziendaId=${encodeURIComponent(companyId)}` : '');
    const selection = parseAccountDestination(url, {uid, companyId});
    return Object.freeze({collection, sourceId: item.id, selection});
}

export function createProfileLinkedAccountReader({context, getUser, repository, isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    const check = () => {
        if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
        if (!uid || getUser()?.uid !== uid) throw new Error('AUTH_CHANGED');
        context.assertUnlocked();
    };
    async function resolve(link) {
        check();
        if (!link || !sources.has(link.collection) || typeof link.sourceId !== 'string' || !link.sourceId) throw new Error('PROFILE_LINK_INVALID');
        const profile = await repository[isOnline() ? 'getUserProfileConfirmed' : 'getUserProfile'](uid);
        check();
        if (!profile || (Object.hasOwn(profile, 'ownerId') && profile.ownerId !== uid)) throw new Error('PROFILE_LINK_UNAVAILABLE');
        const items = profile[link.collection];
        if (!Array.isArray(items)) throw new Error('PROFILE_LINK_UNAVAILABLE');
        const matches = items.filter(item => item?.id === link.sourceId);
        if (matches.length !== 1) throw new Error('PROFILE_LINK_UNAVAILABLE');
        const current = profileAccountLink(matches[0], link.collection, uid)?.selection;
        if (!current || current.domain !== link.selection?.domain || current.id !== link.selection?.id ||
            current.companyId !== link.selection?.companyId) throw new Error('PROFILE_LINK_CHANGED');
        return current;
    }
    async function load(link) {
        const selection = await resolve(link); check();
        const suffix = isOnline() ? 'Confirmed' : '';
        const account = selection.domain === 'company'
            ? await repository['getCompanyAccount' + suffix](uid, selection.companyId, selection.id)
            : await repository['getPrivateAccount' + suffix](uid, selection.id);
        check();
        if (!account || account.isArchived || (Object.hasOwn(account, 'ownerId') && account.ownerId !== uid)) throw new Error('ACCOUNT_UNAVAILABLE');
        return {selection, account};
    }
    return Object.freeze({
        async open(link) { const {selection} = await load(link); await resolve(link); check(); return selection; },
        async readPassword(link) {
            const {account} = await load(link);
            const value = account.password;
            const password = value === undefined || value === null || value === '' ? '' : await context.read({ownerId: uid, ciphertext: value});
            check(); await resolve(link); check();
            if (typeof password !== 'string') throw new Error('PASSWORD_INVALID');
            return password;
        }
    });
}
