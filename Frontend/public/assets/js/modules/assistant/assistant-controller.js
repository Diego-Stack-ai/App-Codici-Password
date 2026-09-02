import { ensureMasterKey } from '../core/security-manager.js';
import { loadVaultSearchRecords } from './vault-data-loader.js';
import { VaultSearchIndex } from './vault-search-index.js';
import { createAssistantUI } from './assistant-ui.js?v=1.2.24-ai9';

let activeController = null;

function attachStyles() {
    if (document.querySelector('link[data-vault-assistant]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = '/assets/css/vault-assistant.css'; link.dataset.vaultAssistant = 'true';
    document.head.append(link);
}

export async function initVaultAssistant(user) {
    activeController?.destroy();
    attachStyles();
    await ensureMasterKey();
    const index = new VaultSearchIndex();
    index.replace(await loadVaultSearchRecords(user));
    let dialog = null;
    const close = () => { dialog?.destroy(); dialog = null; };
    const trigger = document.getElementById('ai-assistant-status');
    if (!trigger) throw new Error('Comando Agente AI non disponibile');
    const open = () => {
        close(); dialog = createAssistantUI({ onSearch: query => index.search(query), onClose: close });
    };
    trigger.addEventListener('click', open);
    const destroy = () => { close(); trigger.removeEventListener('click', open); index.clear(); };
    window.addEventListener('pagehide', destroy, { once: true });
    activeController = { destroy, size: index.size };
    return activeController;
}
