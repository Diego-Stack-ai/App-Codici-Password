import {createAccountNoteQueueAccess} from './account-note-queue-access.mjs';
import {mountAccountNoteEditorProvider} from './account-note-editor-provider.mjs';

const outsideLegacyScope = new Set(['PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED', 'PRIVATE_ACCOUNT_MUTATION_PREPARATION_INVALID', 'NOTE_PROVIDER_SCOPE']);
export function createAccountNotePanelRouter({context, getUser, openQueue, legacyProvider, mountEditor = mountAccountNoteEditorProvider,
    isOnline = () => globalThis.navigator?.onLine !== false, ...options}) {
    return async (root, boundary) => {
        const scoped = {...context, signal: boundary.signal}, account = boundary.selection;
        const queue = createAccountNoteQueueAccess({context: scoped, getUser, account, openQueue});
        const state = await queue.inspect();
        if (account.domain === 'private') {
            if (state.status === 'pending') return legacyProvider(root, {...boundary, recoveryOnly: true});
            if (isOnline()) {
                try {return await legacyProvider(root, boundary);}
                catch (error) {if (!outsideLegacyScope.has(error.message)) throw error;}
            }
        }
        let disposed = false, cleanup, editing = false;
        const controls = new AbortController(), host = document.createElement('section'), action = document.createElement('button');
        const editor = document.createElement('div'), status = document.createElement('p');
        action.type = 'button'; action.dataset.accountNoteAction = 'true'; status.setAttribute('role', 'status');
        const check = () => {
            if (disposed || scoped.signal.aborted || getUser()?.uid !== scoped.user.uid) throw Error('VIEW_DISPOSED');
            scoped.assertUnlocked();
        };
        const show = () => {
            check(); editing = false; action.disabled = false; action.hidden = false;
            const present = boundary.hasNote(); action.textContent = present ? '✎' : 'Aggiungi nota';
            action.setAttribute('aria-label', present ? 'Modifica nota' : 'Aggiungi nota');
        };
        const dispose = () => {
            if (disposed) return; disposed = true; controls.abort(); scoped.signal.removeEventListener('abort', dispose);
            cleanup?.(); action.textContent = status.textContent = ''; host.remove();
        };
        scoped.signal.addEventListener('abort', dispose, {once: true});
        try {
            check(); show(); host.append(action, status, editor); root.append(host);
            action.addEventListener('click', () => {void (async () => {
                if (editing) return;
                try {
                    check(); editing = true; action.disabled = true; status.textContent = '';
                    const mounted = await mountEditor(editor, scoped, {...options, account, getUser, isOnline,
                        assertNoPendingMutation: queue.assertNoPendingMutation,
                        onSaved: async () => {check(); await boundary.onSaved(); check(); show();}, onCancel: show});
                    if (disposed || scoped.signal.aborted) {mounted?.(); return;}
                    cleanup = mounted;
                    if (editing) action.hidden = true;
                } catch {
                    if (!disposed && !scoped.signal.aborted) {
                        try {show(); status.textContent = 'Nota non modificabile ora. Verifica la connessione o le modifiche in attesa.';} catch {dispose();}
                    }
                }
            })();}, {signal: controls.signal});
            return dispose;
        } catch (error) {dispose(); throw error;}
    };
}
