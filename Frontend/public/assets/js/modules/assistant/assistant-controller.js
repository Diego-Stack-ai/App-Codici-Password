import { ensureMasterKey } from '../core/security-manager.js';
import { loadVaultSearchRecords } from './vault-data-loader.js';
import { VaultConversationEngine } from './conversation-engine.js?v=1.2.24-ai11';
import { createAssistantUI } from './assistant-ui.js?v=1.2.24-ai11';

let activeController = null;

function attachStyles() {
    if (document.querySelector('link[data-vault-assistant]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = '/assets/css/vault-assistant.css?v=1.2.24-ai11'; link.dataset.vaultAssistant = 'true';
    document.head.append(link);
}

export async function initVaultAssistant(user) {
    activeController?.destroy();
    attachStyles();
    await ensureMasterKey();
    const records = await loadVaultSearchRecords(user);
    const conversation = new VaultConversationEngine(records);
    let dialog = null;
    const close = () => { dialog?.destroy(); dialog = null; };
    const trigger = document.getElementById('ai-assistant-status');
    if (!trigger) throw new Error('Comando Agente AI non disponibile');
    const open = () => {
        close(); dialog = createAssistantUI({ onAsk: query => conversation.ask(query), onClose: close });
    };
    trigger.addEventListener('click', open);
    const destroy = () => { close(); trigger.removeEventListener('click', open); conversation.clear(); };
    window.addEventListener('pagehide', destroy, { once: true });
    activeController = { destroy, size: records.length };
    return activeController;
}
