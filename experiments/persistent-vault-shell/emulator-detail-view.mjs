import {createAccountListView} from '../../Frontend/public/assets/js/modules/shared/account-list-view.js';

// Basic experimental detail: reuse the canonical card without activating the
// legacy detail orchestrators, their writes, or their security manager.
export async function mountEmulatorDetail(root, context, {selection, openAccount, onBack}) {
    if (context.signal.aborted) return () => {};
    if (!context.unlocked) throw new Error('VAULT_LOCKED');
    const lifecycle = new AbortController();
    const wrapper = document.createElement('section');
    const title = document.createElement('h2'); title.textContent = 'Dettaglio Account';
    const back = document.createElement('button'); back.type = 'button'; back.textContent = 'Torna alla lista';
    const container = document.createElement('div'); container.id = 'accounts-container';
    wrapper.append(title, back, container);
    let disposed = false, view = null, account = null;
    const assertActive = () => {
        if (disposed || context.signal.aborted) throw new DOMException('View disposed', 'AbortError');
    };
    const cleanup = () => {
        if (disposed) return;
        disposed = true;
        context.signal.removeEventListener('abort', cleanup);
        lifecycle.abort();
        account = null;
        try { view?.destroy(); } finally { wrapper.remove(); }
    };
    context.signal.addEventListener('abort', cleanup, {once: true});
    back.addEventListener('click', () => { assertActive(); onBack(); }, {signal: lifecycle.signal});
    root.append(wrapper);
    try {
        assertActive();
        const opened = await openAccount(selection);
        assertActive();
        account = opened;
        const visible = {id: selection.id, isOwner: true, _encrypted: true};
        for (const field of ['nomeAccount', 'username', 'account']) {
            assertActive();
            if (account.has(field)) {
                const value = await account.read(field);
                assertActive();
                visible[field] = value;
            }
        }
        // Presence marker only: the canonical renderer delegates every password
        // request to the capability; it receives neither key nor ciphertext.
        if (account.has('password')) visible.password = 'protected-field-present';
        view = createAccountListView({
            readOnly: true,
            themes: {standard: {accent: 'theme-accent-standard', text: 'theme-text-standard'}},
            getSubtitle: record => record.username || record.account || '',
            onNavigate: () => {},
            emptyStateClass: 'empty-state-box', emptyTextClass: 'empty-state-text',
            async resolveSecret() {
                assertActive();
                const value = await account.read('password');
                assertActive();
                return value;
            }
        });
        assertActive();
        view.render([visible]);
        return cleanup;
    } catch (error) {
        cleanup();
        throw error;
    }
}
