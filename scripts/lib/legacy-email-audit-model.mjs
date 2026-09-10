function hasOwn(record, key) {
    return Object.prototype.hasOwnProperty.call(record || {}, key);
}

function companyEmails(company = {}) {
    const emails = company.emails && typeof company.emails === 'object' ? company.emails : {};
    return [emails.pec, emails.amministrazione, emails.personale, ...(Array.isArray(emails.extra) ? emails.extra : [])]
        .filter(item => item && typeof item === 'object');
}

export function summarizeLegacyEmailMetadata(users = []) {
    const result = {
        users: users.length,
        profileEmailEntries: 0,
        profileEmailPasswordFieldPresent: 0,
        profileEmailPasswordRepresentationNonEmpty: 0,
        profileEmailLinked: 0,
        profileEmailLinkedWithPasswordField: 0,
        profileAccountBacklinks: 0,
        profileLinksMissingBacklink: 0,
        profileBacklinksMissingEmailLink: 0,
        companies: 0,
        companyEmailEntries: 0,
        companyEmailPasswordFieldPresent: 0,
        companyEmailPasswordRepresentationNonEmpty: 0,
        companyLegacyPasswordFieldPresent: 0,
        privateAccounts: 0,
        companyAccounts: 0,
        crossScopeAccountIdCollisions: 0
    };

    for (const user of users) {
        const profileEmails = Array.isArray(user.profile?.contactEmails) ? user.profile.contactEmails.filter(Boolean) : [];
        const privateAccounts = Array.isArray(user.privateAccounts) ? user.privateAccounts : [];
        const companies = Array.isArray(user.companies) ? user.companies : [];
        const linkedEmailIds = new Set(profileEmails.filter(email => email.linkedAccountId).map(email => String(email.id || '')));
        const backlinkEmailIds = new Set(privateAccounts
            .filter(account => account.linkedProfileField?.type === 'email')
            .map(account => String(account.linkedProfileField?.id || '')));

        result.profileEmailEntries += profileEmails.length;
        result.profileEmailPasswordFieldPresent += profileEmails.filter(email => hasOwn(email, 'password')).length;
        result.profileEmailPasswordRepresentationNonEmpty += profileEmails.filter(email => String(email.password || '').length > 0).length;
        result.profileEmailLinked += profileEmails.filter(email => email.linkedAccountId).length;
        result.profileEmailLinkedWithPasswordField += profileEmails.filter(email => email.linkedAccountId && hasOwn(email, 'password')).length;
        result.profileAccountBacklinks += privateAccounts.filter(account => account.linkedProfileField?.type === 'email').length;
        result.profileLinksMissingBacklink += [...linkedEmailIds].filter(id => id && !backlinkEmailIds.has(id)).length;
        result.profileBacklinksMissingEmailLink += [...backlinkEmailIds].filter(id => id && !linkedEmailIds.has(id)).length;
        result.privateAccounts += privateAccounts.length;
        result.companies += companies.length;

        const privateIds = new Set(privateAccounts.map(account => account.id).filter(Boolean));
        for (const company of companies) {
            const entries = companyEmails(company.data);
            const companyAccounts = Array.isArray(company.accounts) ? company.accounts : [];
            result.companyEmailEntries += entries.length;
            result.companyEmailPasswordFieldPresent += entries.filter(email => hasOwn(email, 'password')).length;
            result.companyEmailPasswordRepresentationNonEmpty += entries.filter(email => String(email.password || '').length > 0).length;
            result.companyLegacyPasswordFieldPresent += hasOwn(company.data, 'aziendaEmailPassword') ? 1 : 0;
            result.companyAccounts += companyAccounts.length;
            result.crossScopeAccountIdCollisions += companyAccounts.filter(account => privateIds.has(account.id)).length;
        }
    }
    return result;
}
