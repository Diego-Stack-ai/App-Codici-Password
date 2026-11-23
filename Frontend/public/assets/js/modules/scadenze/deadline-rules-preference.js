const DOMAINS = Object.freeze(['personal', 'vehicles', 'home', 'health', 'sport', 'contracts', 'user-company', 'company']);
const keyFor = uid => typeof uid === 'string' && uid.trim() ? 'codex_deadline_rules_domain:' + uid : null;

export function readDeadlineRulesDomain(storage, uid) {
    const key = keyFor(uid);
    if (!key) return null;
    try {
        const domain = storage?.getItem(key);
        return DOMAINS.includes(domain) ? domain : null;
    } catch { return null; }
}

export function rememberDeadlineRulesDomain(storage, uid, domain) {
    const key = keyFor(uid);
    if (!key || !DOMAINS.includes(domain)) return false;
    try {
        if (!storage) return false;
        storage.setItem(key, domain);
        return true;
    } catch { return false; }
}
