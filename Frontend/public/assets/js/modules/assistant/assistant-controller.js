import { ensureMasterKey } from '../core/security-manager.js';
import { loadVaultSearchRecords } from './vault-data-loader.js';
import { VaultSearchIndex } from './vault-search-index.js';
import { createAssistantButton, createAssistantUI } from './assistant-ui.js';

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
    const button = createAssistantButton(() => {
        close(); dialog = createAssistantUI({ onSearch: query => index.search(query), onClose: close });
    });
    const destroy = () => { close(); button.destroy(); index.clear(); };
    window.addEventListener('pagehide', destroy, { once: true });
    activeController = { destroy, size: index.size };
    return activeController;
}
