import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { loadVaultSearchRecords } from './vault-data-loader.js';
import { VaultConversationEngine } from './conversation-engine.js?v=1.2.238';
import { createAssistantUI } from './assistant-ui.js?v=1.2.238';
import { decryptIfPossible } from '../core/crypto-utils.js';
import { getOfflineReadiness } from '../../offline-sync.js';
import { archiveAccount } from '../settings/archive-account-service.js';
import { archiveConfirmMessage } from '../settings/archive-account-model.js';
import { showConfirmModal, showToast } from '../../ui-core-v129.js';
import { t, getCurrentLanguage } from '../../translations.js';
import { createLocalAiAssistantService } from './local-ai-assistant-service.js';

let activeController = null;

function attachStyles() {
    if (document.querySelector('link[data-vault-assistant]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = '/assets/css/vault-assistant.css?v=1.2.238'; link.dataset.vaultAssistant = 'true';
    document.head.append(link);
}

export async function initVaultAssistant(user, { includeCompanies = true } = {}) {
    activeController?.destroy();
    attachStyles();
    let vaultKeyMaterial = null;
    let conversation = null;
    let preparation = null;
    let dialog = null;
    let advanced = null;
    const close = () => { dialog?.destroy(); dialog = null; void advanced?.close(); advanced = null; };
    const trigger = document.getElementById('ai-assistant-status');
    if (!trigger) throw new Error('Comando Agente AI non disponibile');
    const prepare = () => {
        if (preparation) return preparation;
        preparation = Promise.all([ensureVaultKeyMaterial(), loadVaultSearchRecords(user, { includeCompanies })]).then(([key, records]) => {
            vaultKeyMaterial = key;
            conversation = new VaultConversationEngine(records);
            return records.length;
        }).catch(error => {
            preparation = null;
            throw error;
        });
        return preparation;
    };
    const open = async () => {
        const label = trigger.querySelector('.ai-assistant-label');
        const previousLabel = label?.textContent;
        trigger.disabled = true;
        trigger.setAttribute('aria-busy', 'true');
        trigger.classList.add('assistant-preparing');
        if (label) label.textContent = 'Preparazione…';
        try {
            await prepare();
            close();
            const readiness = getOfflineReadiness(user.uid);
            const offlineNotice = !navigator.onLine && !readiness?.complete
                ? 'Ricerca sui dati disponibili offline: alcuni risultati potrebbero mancare.'
                : '';
            advanced = createLocalAiAssistantService({ language:getCurrentLanguage() });
            dialog = createAssistantUI({
            onAsk: query => conversation.ask(query),
            onExplain: advanced ? async (query, context) => {
                const intent = await advanced.ask(query, context);
                return conversation.executeIntent(intent, query);
            } : null,
            onClose: close,
                resolveCredential: value => decryptIfPossible(value, vaultKeyMaterial),
                onArchive: async item => {
                    const target = item.archiveAction;
                    if (!target) return false;
                    if (!await showConfirmModal(t('confirm_archive_title'), archiveConfirmMessage(target, t))) return false;
                    try {
                        const result = await archiveAccount(user.uid, target);
                        conversation.removeRecord(item.id);
                        showToast(result.status === 'already-archived' ? t('success_already_archived') : t('success_moved_to_archive'), 'success');
                        return true;
                    } catch (error) {
                        const conflict = ['ARCHIVE_CONFLICT', 'ARCHIVE_UPDATED_AT_CONFLICT', 'ARCHIVE_MARKER_MISSING'].includes(error?.code);
                        showToast(conflict ? t('archive_conflict_refresh') : (error?.code === 'ARCHIVE_ACCOUNT_MISSING' ? t('archive_missing_refresh') : 'Archiviazione non riuscita.'), 'error');
                        return false;
                    }
                },
                offlineNotice,
                language: getCurrentLanguage()
            });
        } catch (error) {
            console.warn('[ASSISTANT] Preparazione non riuscita.', error);
            if (label) label.textContent = 'Non disponibile';
        } finally {
            trigger.disabled = false;
            trigger.removeAttribute('aria-busy');
            trigger.classList.remove('assistant-preparing');
            window.setTimeout(() => {
                if (label) label.textContent = previousLabel || 'AI attiva';
            }, 1200);
        }
    };
    trigger.addEventListener('click', open);
    const destroy = () => { close(); trigger.removeEventListener('click', open); conversation?.clear(); };
    window.addEventListener('pagehide', destroy, { once: true });
    activeController = { destroy, prepare };
    return activeController;
}
