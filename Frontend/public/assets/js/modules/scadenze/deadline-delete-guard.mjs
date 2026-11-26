// Deadline deletion reuses an already unlocked session; it never requests a fresh grant.
export async function createDeadlineDeleteGuard({uid, isActive, auth, transport, fence, isUnlocked}) {
    const child = transport.isChild();
    const generation = child ? transport.generation() : null;
    const suspension = child ? transport.suspensionGeneration() : null;
    let permit = null;
    const assertLocal = () => {
        if (!uid || auth.currentUser?.uid !== uid || !isActive() || !isUnlocked()
            || transport.isChild() !== child
            || (child && (generation !== transport.generation()
                || suspension !== transport.suspensionGeneration() || !transport.isUnlocked()
                || (permit && !fence.isLocallyCurrent(permit))))) {
            throw new Error('DEADLINE_DELETE_SESSION_CHANGED');
        }
    };
    const current = async () => {
        assertLocal();
        if (child && (!permit || !await fence.isCurrent(permit))) throw new Error('DEADLINE_DELETE_SESSION_CHANGED');
        assertLocal();
    };
    assertLocal();
    if (child) permit = await fence.readPermit();
    await current();
    current.assertLocal = assertLocal;
    return current;
}
