import { getCurrentLanguage } from '../../translations.js';
import { assistantText } from '../../translations/assistant.js';
import { probeLocalAiCapabilities } from './advanced-local-ai-contract.js';
import { LOCAL_AI_PACKAGE_CATALOG } from './local-ai-package-catalog.js';
import { createLocalAiPackageManager } from './local-ai-package-manager.js';

const SELECTED_KEY = 'codex.local-ai.selected.v1';
const mib = bytes => `${Math.ceil(bytes / 1024 / 1024)} MiB`;

export async function initAssistantPackageSettings(container = document.getElementById('assistant-package-settings')) {
    if (!container) return;
    const language = getCurrentLanguage();
    const label = key => assistantText(language, key);
    const manager = createLocalAiPackageManager();
    const capabilities = await probeLocalAiCapabilities();
    let selected = localStorage.getItem(SELECTED_KEY) || 'A1';
    let downloading = null;

    const render = async () => {
        container.replaceChildren();
        const heading = document.createElement('div');
        heading.className = 'assistant-package-heading';
        heading.innerHTML = `<strong>${label('title')}</strong><small>${label('device')}</small>`;
        container.append(heading);
        for (const level of ['A1', 'A2', 'A3']) {
            const candidate = LOCAL_AI_PACKAGE_CATALOG[level];
            const status = level === 'A1' ? { installed:true } : await manager.status(level);
            const capability = capabilities[level];
            const compatible = level === 'A1' || capability.status === 'candidate';
            const card = document.createElement('section');
            card.className = `assistant-package-card${selected === level ? ' active' : ''}`;
            const title = level === 'A1' ? label('base') : label(level.toLowerCase());
            const desc = level === 'A1' ? label('baseDesc') : label(`${level.toLowerCase()}Desc`);
            const meta = candidate ? `${mib(candidate.manifest.approxDownloadBytes)} · ${label('memory')} ${mib(candidate.manifest.maxResidentBytes)}` : label('fallback');
            card.innerHTML = `<div><strong>${title}</strong><small>${desc}</small><small>${meta}</small></div>`;
            const actions = document.createElement('div'); actions.className = 'assistant-package-actions';
            if (status.installed && compatible) {
                const activate = document.createElement('button'); activate.type = 'button';
                activate.textContent = selected === level ? label('active') : label('activate');
                activate.disabled = selected === level;
                activate.onclick = () => { selected = level; localStorage.setItem(SELECTED_KEY, level); void render(); };
                actions.append(activate);
            }
            if (level !== 'A1' && !status.installed) {
                const install = document.createElement('button'); install.type = 'button';
                install.textContent = compatible ? label('install') : label('unavailable'); install.disabled = !compatible || Boolean(downloading);
                install.onclick = async () => {
                    if (!confirm(`${label('consent')}\n${mib(candidate.manifest.approxDownloadBytes)} · ${label('storage')} ${mib(Math.ceil(candidate.manifest.approxDownloadBytes * 2.15))}`)) return;
                    downloading = level; install.textContent = label('downloading');
                    const progress = document.createElement('progress'); progress.max = candidate.manifest.approxDownloadBytes; progress.value = 0; card.append(progress);
                    try {
                        await manager.install(candidate.manifest, { baseUrl:candidate.baseUrl,
                            onProgress:value => { progress.value = value.completedBytes; } });
                    } catch (error) {
                        if (error?.name !== 'AbortError') card.dataset.error = `${label('failed')}: ${error.message}`;
                    } finally { downloading = null; await render(); }
                };
                actions.append(install);
            }
            if (level !== 'A1' && status.installed) {
                const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = label('remove');
                remove.onclick = async () => { await manager.remove(level); if (selected === level) { selected = 'A1'; localStorage.setItem(SELECTED_KEY, selected); } await render(); };
                actions.append(remove);
            }
            if (downloading === level) {
                const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = label('cancel'); cancel.onclick = () => manager.abort(); actions.append(cancel);
            }
            card.append(actions); container.append(card);
        }
    };
    await render();
}
