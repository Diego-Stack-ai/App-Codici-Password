import { applyGlobalTranslations } from '../translations.js';

let observer = null;

export function observeTranslatedSubtrees(root = document.body) {
    observer?.disconnect();
    if (!root || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(records => {
        for (const { addedNodes } of records) {
            for (const node of addedNodes) {
                if (node instanceof Element) applyGlobalTranslations(node);
            }
        }
    });
    observer.observe(root, { childList: true, subtree: true });
}
