import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { auth } from '../../firebase-config.js?v=1.2.267';
import { onAuthStateChanged } from '/assets/js/vendor/firebase-runtime.js';
import { loadVaultSearchRecords } from './vault-data-loader.js';
import { VaultConversationEngine } from './conversation-engine.js?v=1.2.267';
import { createAssistantUI } from './assistant-ui.js?v=1.2.267';
import { decryptIfPossible } from '../core/crypto-utils.js';
import { getOfflineReadiness } from '../../offline-sync.js';
import { archiveAccount } from '../settings/archive-account-service.js';
import { archiveConfirmMessage } from '../settings/archive-account-model.js';
import { showConfirmModal, showToast } from '../../ui-core-v129.js';
import { t, getCurrentLanguage } from '../../translations.js';
import { createDocumentationGuide } from './documentation-guide.js';

let activeController = null;

async function loadDocumentationKnowledge(language) {
    try {
        const response = await fetch('/assets/js/modules/assistant/documentation-catalog.json', { credentials:'omit' });
        if (!response.ok) return null;
        const guide = createDocumentationGuide(await response.json());
        const locale = language || 'it';
        return {
            pageKnowledge:guide.getPageKnowledge(location.pathname, { locale }),
            searchKnowledge:query => guide.searchKnowledge(query, {
                locale,
                limit:5,
                fromPage:location.pathname
            })
        };
    } catch (error) {
        console.warn('[SEARCH] Guida locale non disponibile; la ricerca dati resta attiva.', error?.name || 'Error');
        return null;
    }
}

function attachStyles() {
    if (document.querySelector('link[data-vault-assistant]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = '/assets/css/vault-assistant.css?v=1.2.267'; link.dataset.vaultAssistant = 'true';
    document.head.append(link);
}

export async function initVaultAssistant(user, { includeCompanies = true } = {}) {
    activeController?.destroy();
    attachStyles();
    let vaultKeyMaterial = null;
    let conversation = null;
    let preparation = null;
    let dialog = null;
    let generation = 0, dialogEpoch = 0, disposed = false;
    const current = version => !disposed && version === generation && auth.currentUser?.uid === user.uid;
    const assertCurrent = version => { if (!current(version)) throw new Error('ASSISTANT_SESSION_INVALIDATED'); };
    const close = () => { dialogEpoch++; dialog?.destroy(); dialog = null; };
    const trigger = document.getElementById('search-status');
    if (!trigger) throw new Error('Comando Ricerca non disponibile');
    const idleLabel = trigger.querySelector('.search-status-label')?.textContent || 'Ricerca';
    const resetBusy = () => {
        trigger.disabled = false;
        trigger.removeAttribute('aria-busy');
        trigger.classList.remove('assistant-preparing');
        const label = trigger.querySelector('.search-status-label');
        if (label) label.textContent = idleLabel;
    };
    const invalidate = () => {
        generation++;
        close();
        conversation?.clear();
        conversation = null;
        vaultKeyMaterial = null;
        preparation = null;
        resetBusy();
    };
    const prepare = () => {
        const version = generation;
        assertCurrent(version);
        if (preparation) return preparation;
        const language = getCurrentLanguage();
        preparation = Promise.all([
            ensureVaultKeyMaterial(),
            loadVaultSearchRecords(user, { includeCompanies }),
            loadDocumentationKnowledge(language)
        ]).then(([key, records, documentation]) => {
            assertCurrent(version);
            vaultKeyMaterial = key;
            conversation = new VaultConversationEngine(records, documentation || {});
            return records.length;
        }).catch(error => {
            if (version === generation) preparation = null;
            throw error;
        });
        return preparation;
    };
    const open = async () => {
        const version = generation;
        if (!current(version)) return;
        const label = trigger.querySelector('.search-status-label');
        const previousLabel = label?.textContent;
        trigger.disabled = true;
        trigger.setAttribute('aria-busy', 'true');
        trigger.classList.add('assistant-preparing');
        if (label) label.textContent = 'Preparazione…';
        try {
            await prepare();
            assertCurrent(version);
            close();
            const epoch = dialogEpoch;
            const dialogCurrent = () => current(version) && epoch === dialogEpoch;
            const assertDialog = () => { if (!dialogCurrent()) throw new Error('ASSISTANT_SESSION_INVALIDATED'); };
            const readiness = getOfflineReadiness(user.uid);
            const offlineNotice = !navigator.onLine && !readiness?.complete
                ? 'Ricerca sui dati disponibili offline: alcuni risultati potrebbero mancare.'
                : '';
            dialog = createAssistantUI({
                onAsk: async query => {
                    assertDialog();
                    const answer = await conversation.ask(query);
                    assertDialog();
                    return answer;
                },
                onClose: () => { if (dialogCurrent()) close(); },
                isSessionActive: dialogCurrent,
                resolveCredential: async value => {
                    assertDialog();
                    const clear = await decryptIfPossible(value, vaultKeyMaterial);
                    assertDialog();
                    return clear;
                },
                onArchive: async item => {
                    if (!dialogCurrent()) return false;
                    const target = item.archiveAction;
                    if (!target) return false;
                    if (!await showConfirmModal(t('confirm_archive_title'), archiveConfirmMessage(target, t))) return false;
                    if (!dialogCurrent()) return false;
                    try {
                        const result = await archiveAccount(user.uid, target);
                        if (!dialogCurrent()) return false;
                        conversation.removeRecord(item.id);
                        showToast(result.status === 'already-archived' ? t('success_already_archived') : t('success_moved_to_archive'), 'success');
                        return true;
                    } catch (error) {
                        if (!dialogCurrent()) return false;
                        const conflict = ['ARCHIVE_CONFLICT', 'ARCHIVE_UPDATED_AT_CONFLICT', 'ARCHIVE_MARKER_MISSING'].includes(error?.code);
                        showToast(conflict ? t('archive_conflict_refresh') : (error?.code === 'ARCHIVE_ACCOUNT_MISSING' ? t('archive_missing_refresh') : 'Archiviazione non riuscita.'), 'error');
                        return false;
                    }
                },
                offlineNotice,
                language:getCurrentLanguage()
            });
        } catch (error) {
            if (!current(version)) return;
            console.warn('[SEARCH] Preparazione non riuscita.', error);
            if (label) label.textContent = t('profile_document_not_provided');
        } finally {
            if (current(version)) {
                trigger.disabled = false;
                trigger.removeAttribute('aria-busy');
                trigger.classList.remove('assistant-preparing');
                window.setTimeout(() => {
                    if (current(version) && label) label.textContent = previousLabel || idleLabel;
                }, 1200);
            }
        }
    };
    trigger.addEventListener('click', open);
    let unsubscribe = () => {};
    const destroy = () => {
        if (disposed) return;
        disposed = true;
        invalidate();
        trigger.removeEventListener('click', open);
        window.removeEventListener('pagehide', destroy);
        window.removeEventListener('vault-session-locked', invalidate);
        window.removeEventListener('private-auth-blocked', invalidate);
        unsubscribe();
    };
    window.addEventListener('pagehide', destroy, { once: true });
    window.addEventListener('vault-session-locked', invalidate);
    window.addEventListener('private-auth-blocked', invalidate);
    unsubscribe = onAuthStateChanged(auth, currentUser => { if (currentUser?.uid !== user.uid) destroy(); });
    if (disposed) unsubscribe();
    activeController = { destroy, prepare };
    return activeController;
}
