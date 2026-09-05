const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

export function passesLuhn(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let double = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
        let digit = Number(digits[index]);
        if (double) { digit *= 2; if (digit > 9) digit -= 9; }
        sum += digit;
        double = !double;
    }
    return sum % 10 === 0;
}

export function parsePaymentCard(rawText) {
    const text = clean(rawText);
    const digitRuns = text.match(/[\d -]{13,}/g) || [];
    let number = '';
    for (const run of digitRuns) {
        const digits = run.replace(/\D/g, '');
        for (let length = Math.min(19, digits.length); length >= 13 && !number; length -= 1) {
            for (let start = 0; start + length <= digits.length; start += 1) {
                const candidate = digits.slice(start, start + length);
                if (passesLuhn(candidate)) {
                    number = candidate;
                    break;
                }
            }
        }
        if (number) break;
    }
    const expiryMatch = text.match(/\b(0[1-9]|1[0-2])\s*[\/-]\s*(\d{2}|20\d{2})\b/);
    return {
        type: 'payment-card',
        number,
        expiryMonth: expiryMatch?.[1] || '',
        expiryYear: expiryMatch?.[2] || '',
        // Il CVV non viene mai estratto automaticamente.
        cvv: null,
        requiresConfirmation: true
    };
}

export function parseBusinessCard(rawText) {
    const lines = String(rawText || '').split(/\r?\n/).map(clean).filter(Boolean);
    const email = lines.flatMap(line => line.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [])[0] || '';
    const website = lines.flatMap(line => line.match(/(?:https?:\/\/|www\.)[^\s]+/gi) || [])[0] || '';
    const phone = lines.flatMap(line => line.match(/(?:\+?\d[\d ().-]{6,}\d)/g) || [])
        .find(value => !passesLuhn(value)) || '';
    const descriptive = lines.filter(line => !line.includes(email) && !line.includes(website) && !line.includes(phone));
    return {
        type: 'business-card',
        displayName: descriptive[0] || '',
        organization: descriptive[1] || '',
        role: descriptive[2] || '',
        email,
        phone: clean(phone),
        website,
        requiresConfirmation: true
    };
}

export function classifyCode(rawValue) {
    const value = clean(rawValue);
    let type = 'text';
    if (/^https?:\/\//i.test(value)) type = 'url';
    else if (/^WIFI:/i.test(value)) type = 'wifi';
    else if (/^BEGIN:VCARD/i.test(value)) type = 'vcard';
    return { type, value, requiresConfirmation: true, autoOpen: false };
}

export function parseGenericCard(rawText) {
    return {
        type: 'generic-card',
        lines: String(rawText || '').split(/\r?\n/).map(clean).filter(Boolean),
        requiresConfirmation: true
    };
}
