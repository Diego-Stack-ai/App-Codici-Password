import { getCurrentLanguage } from '../../translations.js';
import { assistantText } from '../../translations/assistant.js';
import { probeLocalAiCapabilities } from './advanced-local-ai-contract.js';
import { LOCAL_AI_ADVANCED_TIERS, LOCAL_AI_PACKAGE_CATALOG } from './local-ai-package-catalog.js';
import { createLocalAiPackageManager } from './local-ai-package-manager.js';
import { createLocalAiRuntimeLoader } from './local-ai-runtime-loader.js';
import { readSelectedAdvancedTier, readSelectedLocalAi, writeSelectedAdvancedTier, writeSelectedLocalAi } from './local-ai-selection.js';
import { showConfirmModal } from '../../ui-core-v129.js';

const mib = bytes => `${Math.ceil(bytes / 1024 / 1024)} MiB`;

export async function initAssistantPackageSettings(container = document.getElementById('assistant-package-settings')) {
    if (!container) return;
    const language = getCurrentLanguage();
    const label = key => assistantText(language, key);
    const manager = createLocalAiPackageManager();
    const loader = createLocalAiRuntimeLoader({ packageManager:manager });
    const capabilities = await probeLocalAiCapabilities();
    let selected = readSelectedLocalAi();
    let selectedTier = readSelectedAdvancedTier();
    let downloading = null;
    const errors = {};

    const render = async () => {
        container.replaceChildren();
        const heading = document.createElement('div');
        heading.className = 'assistant-package-heading';
        heading.innerHTML = `<strong>${label('title')}</strong><small>${label('device')}</small>`;
        container.append(heading);
        for (const level of ['A1', 'A2']) {
            const candidate = LOCAL_AI_PACKAGE_CATALOG[level];
            const status = await manager.status(level, {
                manifest: candidate.manifest,
                baseUrl: candidate.baseUrl,
                legacyLevel: candidate.legacyLevel
            });
            const capability = capabilities[level];
            const compatible = capability.status === 'candidate';
            if (level === 'A2') {
                const usable = capability.allowedTiers.filter(tier => LOCAL_AI_ADVANCED_TIERS[tier].status === 'available');
                if (!usable.includes(selectedTier)) {
                    selectedTier = usable.at(-1) || 'light';
                    writeSelectedAdvancedTier(selectedTier);
                }
            }
            if (selected === level && level === 'A2' && (!status.verified || !compatible)) {
                selected = 'A1';
                writeSelectedLocalAi(selected);
            }
            const card = document.createElement('section');
            card.className = `assistant-package-card${selected === level && status.verified && compatible ? ' active' : ''}`;
            const title = label(level === 'A1' ? 'ai1' : 'ai2');
            const desc = label(level === 'A1' ? 'ai1Desc' : 'ai2Desc');
            const meta = `${mib(candidate.manifest.approxDownloadBytes)} · ${label('memory')} ${mib(candidate.manifest.maxResidentBytes)}`;
            card.innerHTML = `<div><strong>${title}</strong><small>${desc}</small><small>${meta}</small></div>`;
            if (level === 'A2') {
                const tierList = document.createElement('small');
                tierList.className = 'assistant-package-tiers';
                const tierSummary = ['light','medium','power'].map(tier => {
                    const entry = LOCAL_AI_ADVANCED_TIERS[tier];
                    const allowed = capability.allowedTiers.includes(tier);
                    const state = entry.status === 'available' && allowed
                        ? (tier === selectedTier ? label('tierSelected') : label('tierAvailable'))
                        : entry.status !== 'available' ? label('tierPending') : label('unavailable');
                    return `${label(`tier_${tier}`)}: ${state}`;
                }).join(' · ');
                tierList.replaceChildren(document.createTextNode(tierSummary));
                card.firstElementChild.append(tierList);
                if (capability.recommendedTier && LOCAL_AI_ADVANCED_TIERS[capability.recommendedTier].status !== 'available') {
                    const pending = document.createElement('small');
                    pending.replaceChildren(document.createTextNode(`${label('tierHardwareRecommendation')} ${label(`tier_${capability.recommendedTier}`)} · ${label('tierFallbackLight')}`));
                    card.firstElementChild.append(pending);
                }
            }
            if (errors[level]) {
                const error = document.createElement('small');
                error.className = 'assistant-package-error'; error.textContent = errors[level];
                card.firstElementChild.append(error);
            }
            if (status.installed) {
                const installed = document.createElement('small');
                installed.className = 'assistant-package-installed';
                installed.textContent = status.verified ? (selected === level ? label('active') : label('verified')) : label('verificationRequired');
                card.firstElementChild.append(installed);
            }
            const actions = document.createElement('div'); actions.className = 'assistant-package-actions';
            if (status.installed && status.verified && compatible) {
                const activate = document.createElement('button'); activate.type = 'button';
                activate.textContent = selected === level ? label('active') : label('activate');
                activate.disabled = selected === level;
                activate.onclick = () => { selected = level; writeSelectedLocalAi(level); if (level === 'A2') writeSelectedAdvancedTier(selectedTier); void render(); };
                actions.append(activate);
            }
            if (!status.installed) {
                const install = document.createElement('button'); install.type = 'button';
                install.textContent = compatible ? label('install') : label('unavailable'); install.disabled = !compatible || Boolean(downloading);
                install.onclick = async () => {
                    const confirmed = await showConfirmModal(
                        label('title'),
                        `${label('consent')}\n${mib(candidate.manifest.approxDownloadBytes)} · ${label('storage')} ${mib(Math.ceil(candidate.manifest.approxDownloadBytes * 2.15))}`,
                        label('install'),
                        label('cancel')
                    );
                    if (!confirmed) return;
                    downloading = level; install.textContent = label('downloading');
                    const progress = document.createElement('progress'); progress.max = candidate.manifest.approxDownloadBytes; progress.value = 0; card.append(progress);
                    try {
                        delete errors[level];
                        await manager.install(candidate.manifest, { baseUrl:candidate.baseUrl,
                            onProgress:value => { progress.value = value.completedBytes; } });
                        const runtime = await loader.load(level, { assessment:capabilities, tier:level === 'A2' ? selectedTier : 'light' });
                        await runtime.dispose?.();
                    } catch (error) {
                        if (error?.name !== 'AbortError') errors[level] = 'Installazione o verifica non riuscita su questo dispositivo.';
                    } finally { downloading = null; await render(); }
                };
                actions.append(install);
            }
            if (status.installed && !status.verified && compatible) {
                const verify = document.createElement('button'); verify.type = 'button'; verify.textContent = label('verify');
                verify.onclick = async () => {
                    verify.disabled = true; verify.textContent = label('verifying');
                    try { delete errors[level]; const runtime = await loader.load(level, { assessment:capabilities, tier:level === 'A2' ? selectedTier : 'light' }); await runtime.dispose?.(); }
                    catch { errors[level] = 'Il pacchetto non ha superato la verifica su questo dispositivo.'; }
                    await render();
                };
                actions.append(verify);
            }
            if (status.installed) {
                const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = label('remove');
                remove.onclick = async () => { await manager.remove(level); if (selected === level) { selected = 'A1'; writeSelectedLocalAi(selected); } await render(); };
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
