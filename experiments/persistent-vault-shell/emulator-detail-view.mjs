import {createAccountListView} from '../../Frontend/public/assets/js/modules/shared/account-list-view.js';
import {mountDetailExtraFields} from './detail-extra-fields.mjs';

// Basic experimental detail: reuse the canonical card without activating the
// legacy detail orchestrators, their writes, or their security manager.
export async function mountEmulatorDetail(root, context, {selection, openAccount, onBack, mountSavePanel}) {
    if (context.signal.aborted) return () => {};
    if (!context.unlocked) throw new Error('VAULT_LOCKED');
    const lifecycle = new AbortController();
    const wrapper = document.createElement('section');
    const title = document.createElement('h2'); title.textContent = 'Dettaglio Account';
    const back = document.createElement('button'); back.type = 'button'; back.textContent = 'Torna alla lista';
    const container = document.createElement('div'); container.id = 'accounts-container';
    wrapper.append(title, back, container);
    let disposed = false, view = null, account = null, extraCleanup = null, saveCleanup = null, refreshPending;
    let revision = 0;
    const assertActive = () => {
        if (disposed || context.signal.aborted) throw new DOMException('View disposed', 'AbortError');
    };
    const readVisible = async reader => {
        const visible = {id: selection.id, isOwner: true, _encrypted: true};
        for (const field of ['nomeAccount', 'username', 'account']) {
            assertActive();
            if (reader.has(field)) {
                visible[field] = await reader.read(field);
                assertActive();
            }
        }
        if (reader.has('password')) visible.password = 'protected-field-present';
        return visible;
    };
    const refreshDetail = () => {
        assertActive();
        if (!refreshPending) refreshPending = (async () => {
            const staging = document.createElement('div'); let nextCleanup;
            try {
                const nextAccount = await openAccount(selection); assertActive();
                const visible = await readVisible(nextAccount); assertActive();
                nextCleanup = await mountDetailExtraFields(staging, {account: nextAccount, signal: lifecycle.signal,
                    copyText: value => navigator.clipboard.writeText(value),
                    onError: () => { if (!disposed) title.textContent = 'Dettaglio Account · copia non riuscita'; }});
                assertActive();
                view.render([visible]);
                revision++; account = nextAccount;
                extraCleanup?.();
                wrapper.append(staging);
                extraCleanup = () => { try { nextCleanup?.(); } finally { staging.remove(); } };
            } catch (error) {
                nextCleanup?.(); staging.remove(); throw error;
            }
        })().finally(() => { refreshPending = null; });
        return refreshPending;
    };
    const cleanup = () => {
        if (disposed) return;
        disposed = true;
        context.signal.removeEventListener('abort', cleanup);
        lifecycle.abort();
        account = null;
        try { saveCleanup?.(); } finally {
            try { extraCleanup?.(); } finally { try { view?.destroy(); } finally { wrapper.remove(); } }
        }
    };
    context.signal.addEventListener('abort', cleanup, {once: true});
    back.addEventListener('click', () => { assertActive(); onBack(); }, {signal: lifecycle.signal});
    root.append(wrapper);
    try {
        assertActive();
        const opened = await openAccount(selection);
        assertActive();
        account = opened;
        const visible = await readVisible(account);
        // Presence marker only: the canonical renderer delegates every password
        // request to the capability; it receives neither key nor ciphertext.
        view = createAccountListView({
            readOnly: true,
            themes: {standard: {accent: 'theme-accent-standard', text: 'theme-text-standard'}},
            getSubtitle: record => record.username || record.account || '',
            onNavigate: () => {},
            emptyStateClass: 'empty-state-box', emptyTextClass: 'empty-state-text',
            async resolveSecret() {
                assertActive();
                const requestedRevision = revision;
                const value = await account.read('password');
                assertActive();
                if (requestedRevision !== revision) throw new DOMException('Detail refreshed', 'AbortError');
                return value;
            }
        });
        assertActive();
        view.render([visible]);
        extraCleanup = await mountDetailExtraFields(wrapper, {account, signal: lifecycle.signal,
            copyText: value => navigator.clipboard.writeText(value),
            onError: () => { if (!disposed) title.textContent = 'Dettaglio Account · copia non riuscita'; }
        });
        if (disposed) extraCleanup?.();
        assertActive();
        if (mountSavePanel && selection.domain === 'private') {
            saveCleanup = await mountSavePanel(wrapper, {signal: lifecycle.signal, selection, isActive: () => !disposed && !context.signal.aborted,
                onSaved: refreshDetail});
            if (disposed) saveCleanup?.();
            assertActive();
        }
        return cleanup;
    } catch (error) {
        cleanup();
        throw error;
    }
}
