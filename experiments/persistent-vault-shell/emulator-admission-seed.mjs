// Test setup only: never imported into a browser/runtime bundle.
export async function seedEmulatorAdmission({projectId, authHost, firestoreHost, uid, email,
    getUser, updateUser, writePolicy}) {
    if (projectId !== 'demo-vault-shell' || authHost !== '127.0.0.1:9099' ||
        firestoreHost !== '127.0.0.1:8085') throw new Error('EMULATOR_ONLY');
    if (!['a@example.invalid', 'b@example.invalid'].includes(email) ||
        typeof uid !== 'string' || !uid || uid.includes('/')) throw new Error('INVALID_FIXTURE');
    const user = await getUser(uid);
    if (user?.uid !== uid || user.email !== email) throw new Error('FIXTURE_OWNER_MISMATCH');
    await updateUser(uid, {emailVerified: true});
    await writePolicy(uid, {passwordPolicyVersion: 1});
}
