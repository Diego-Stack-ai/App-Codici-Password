export const PASSWORD_POLICIES = Object.freeze({
    account: Object.freeze({ minLength: 12, label: 'Password account' }),
    master: Object.freeze({ minLength: 16, label: 'Master Password' })
});

export const ACCOUNT_PASSWORD_POLICY_VERSION = 1;

export function generateSecurePassword(length = 20) {
    const groups = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%&*+-=?'];
    const randomIndex = (max) => {
        const limit = Math.floor(0x100000000 / max) * max;
        const buffer = new Uint32Array(1);
        do crypto.getRandomValues(buffer); while (buffer[0] >= limit);
        return buffer[0] % max;
    };
    const chars = groups.map(group => group[randomIndex(group.length)]);
    const alphabet = groups.join('');
    while (chars.length < Math.max(length, 12)) chars.push(alphabet[randomIndex(alphabet.length)]);
    for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = randomIndex(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}

const RULE_LABELS = Object.freeze({
    minLength: (policy) => `Almeno ${policy.minLength} caratteri`,
    lowercase: () => 'Almeno una lettera minuscola',
    uppercase: () => 'Almeno una lettera maiuscola',
    number: () => 'Almeno un numero',
    symbol: () => 'Almeno un simbolo',
    noOuterWhitespace: () => 'Nessuno spazio all’inizio o alla fine'
});

export function evaluatePassword(password, type = 'account') {
    const policy = PASSWORD_POLICIES[type];
    if (!policy) throw new Error(`Policy password sconosciuta: ${type}`);
    const value = String(password ?? '').normalize('NFC');
    const rules = {
        minLength: value.length >= policy.minLength,
        lowercase: /[a-z]/.test(value),
        uppercase: /[A-Z]/.test(value),
        number: /[0-9]/.test(value),
        symbol: /[^A-Za-z0-9\s]/.test(value),
        noOuterWhitespace: value === value.trim()
    };
    return { valid: Object.values(rules).every(Boolean), rules, policy, value };
}

export function passwordPolicyMessage(type = 'account') {
    const policy = PASSWORD_POLICIES[type];
    return `${policy.label}: minimo ${policy.minLength} caratteri, almeno una minuscola, una maiuscola, un numero e un simbolo.`;
}

export function firstPasswordPolicyError(password, type = 'account') {
    const result = evaluatePassword(password, type);
    const failed = Object.keys(result.rules).find(rule => !result.rules[rule]);
    return failed ? RULE_LABELS[failed](result.policy) : '';
}

export function bindPasswordChecklist(input, checklist, type = 'account') {
    if (!input || !checklist) return () => {};
    const update = () => {
        const { rules } = evaluatePassword(input.value, type);
        checklist.querySelectorAll('[data-password-rule]').forEach((item) => {
            const valid = !!rules[item.dataset.passwordRule];
            item.classList.toggle('is-valid', valid);
            item.classList.toggle('is-pending', !valid);
            item.setAttribute('aria-checked', String(valid));
        });
    };
    input.addEventListener('input', update);
    update();
    return update;
}
