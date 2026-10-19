import { getCurrentLanguage } from '../../translations.js';
import { assistantText } from '../../translations/assistant.js';
import { probeLocalAiCapabilities } from './advanced-local-ai-contract.js';
import { getLocalAiPackageCandidate, LOCAL_AI_ADVANCED_TIERS } from './local-ai-package-catalog.js';
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
            const capability = capabilities[level];
            const compatible = capability.status === 'candidate';
            let usableTiers = [];
            if (level === 'A2') {
                usableTiers = capability.allowedTiers.filter(tier => LOCAL_AI_ADVANCED_TIERS[tier].status === 'available');
                if (!usableTiers.includes(selectedTier)) {
                    selectedTier = usableTiers.at(-1) || 'light';
                    writeSelectedAdvancedTier(selectedTier);
                }
            }
            const candidate = getLocalAiPackageCandidate(level, { tier:selectedTier });
            const status = await manager.status(level, {
                manifest: candidate.manifest,
                baseUrl: candidate.baseUrl,
                legacyLevel: candidate.legacyLevel
            });
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
                const recommendation = document.createElement('small');
                recommendation.className = 'assistant-package-tier-recommendation';
                recommendation.textContent = capability.recommendedTier
                    ? `${label('tierHardwareRecommendation')} ${label(`tier_${capability.recommendedTier}`)}`
                    : label('unavailable');
                card.firstElementChild.append(recommendation);
                const tierSelector = document.createElement('div');
                tierSelector.className = 'assistant-package-tier-selector';
                tierSelector.setAttribute('role', 'radiogroup');
                tierSelector.setAttribute('aria-label', label('tierChoose'));
                for (const tier of ['light','medium','power']) {
                    const entry = LOCAL_AI_ADVANCED_TIERS[tier];
                    const allowed = usableTiers.includes(tier);
                    const tierButton = document.createElement('button');
                    tierButton.type = 'button';
                    tierButton.className = 'assistant-package-tier';
                    tierButton.dataset.tier = tier;
                    tierButton.disabled = !allowed || entry.status !== 'available' || Boolean(downloading);
                    tierButton.setAttribute('role', 'radio');
                    tierButton.setAttribute('aria-checked', String(tier === selectedTier));
                    tierButton.classList.toggle('selected', tier === selectedTier);
                    tierButton.classList.toggle('recommended', tier === capability.recommendedTier);
                    const state = !allowed ? label('unavailable')
                        : tier === capability.recommendedTier ? label('tierRecommended') : label('tierAvailable');
                    tierButton.replaceChildren(document.createTextNode(
                        `${label(`tier_${tier}`)} · ${mib(entry.manifest.approxDownloadBytes)} · ${state}`
                    ));
                    tierButton.onclick = () => {
                        if (tier === selectedTier) return;
                        selectedTier = tier;
                        writeSelectedAdvancedTier(tier);
                        delete errors.A2;
                        void render();
                    };
                    tierSelector.append(tierButton);
                }
                card.firstElementChild.append(tierSelector);
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
