// Synthetic bridge for the real page orchestrators. Never imports Firebase.
let fixture = null;
export function installFixture(records) {
    const current = {records: structuredClone(records)};
    fixture = current;
    return () => { current.records = []; if (fixture === current) fixture = null; };
}
function rows(uid, company) {
    if (uid !== 'demo-user' || !fixture) throw new Error('FIXTURE_ONLY');
    return structuredClone(fixture.records.filter(record => record.company === company));
}
export async function listPrivateAccounts(uid) { return rows(uid, false); }
export const listPrivateAccountsConfirmed = listPrivateAccounts;
export async function listCompanyAccounts(uid, companyId) {
    if (companyId !== 'demo-company') throw new Error('FIXTURE_ONLY');
    return rows(uid, true);
}
export async function listAcceptedInvites() { return []; }
export async function getRecordByPath() { throw new Error('FIXTURE_ONLY'); }
export async function getUserProfile() { throw new Error('FIXTURE_ONLY'); }
