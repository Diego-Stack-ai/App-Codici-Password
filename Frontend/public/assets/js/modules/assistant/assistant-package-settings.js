import { getCurrentLanguage } from '../../translations.js';
import { assistantText } from '../../translations/assistant.js';
import { probeLocalAiCapabilities } from './advanced-local-ai-contract.js';
import { getLocalAiPackageCandidate, LOCAL_AI_ADVANCED_TIERS } from './local-ai-package-catalog.js';
import { createLocalAiPackageManager } from './local-ai-package-manager.js';
import { createLocalAiRuntimeLoader, readLocalAiRuntimeDiagnostic } from './local-ai-runtime-loader.js';
import { clearLocalAiRuntimeState, readLocalAiRuntimeState, writeLocalAiRuntimeState } from './local-ai-runtime-state.js';
import { readDesktop32RamConfirmation, readSelectedAdvancedTier, readSelectedLocalAi,
    writeDesktop32RamConfirmation, writeSelectedAdvancedTier, writeSelectedLocalAi } from './local-ai-selection.js';
import { showConfirmModal } from '../../ui-core-v129.js';

const size = bytes => bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GiB`
    : `${Math.ceil(bytes / 1024 / 1024)} MiB`;
const DIAGNOSTIC_STORAGE_PREFIX = 'codici-password:local-ai-diagnostic:v1';

function diagnosticKey(level, tier) {
    return `${DIAGNOSTIC_STORAGE_PREFIX}:${level}:${level === 'A2' ? tier : 'default'}`;
}

function readStoredDiagnostic(level, tier) {
    const runtimeState = readLocalAiRuntimeState(level, tier);
    if (runtimeState?.status === 'failed') return runtimeState.diagnostic;
    try {
        const value = JSON.parse(sessionStorage.getItem(diagnosticKey(level, tier)) || 'null');
        if (!value || !/^LOCAL_AI_[A-Z0-9_]+$/.test(value.code) || !/^[a-z][a-z0-9-]{0,47}$/.test(value.stage)) return null;
        return { code:value.code, stage:value.stage, errorName:String(value.errorName || 'Error') };
    } catch { return null; }
}

function persistDiagnostic(level, tier, diagnostic) {
    try { sessionStorage.setItem(diagnosticKey(level, tier), JSON.stringify(diagnostic)); } catch { /* Diagnostica best effort. */ }
    writeLocalAiRuntimeState(level, tier, { status:'failed', stage:diagnostic.stage, diagnostic });
}

function clearDiagnostic(level, tier) {
    try { sessionStorage.removeItem(diagnosticKey(level, tier)); } catch { /* Diagnostica best effort. */ }
    clearLocalAiRuntimeState(level, tier);
}

function reportVerificationFailure(level, tier, error, fallbackStage) {
    const diagnostic = readLocalAiRuntimeDiagnostic(error, fallbackStage);
    persistDiagnostic(level, tier, diagnostic);
    console.error('[Local AI verification failed]', {
        level,
        tier:level === 'A2' ? tier : 'default',
        code:diagnostic.code,
        stage:diagnostic.stage,
        errorName:diagnostic.errorName
    });
    return diagnostic;
}

export async function initAssistantPackageSettings(container = document.getElementById('assistant-package-settings')) {
    if (!container) return;
    const language = getCurrentLanguage();
    const label = key => assistantText(language, key);
    const manager = createLocalAiPackageManager();
    const loader = createLocalAiRuntimeLoader({ packageManager:manager });
    const capabilities = await probeLocalAiCapabilities();
    let selected = readSelectedLocalAi();
    let selectedTier = readSelectedAdvancedTier();
    let ramConfirmed = readDesktop32RamConfirmation();
    let downloading = null;
    const errors = {
        A1:readStoredDiagnostic('A1', 'default'),
        A2:readStoredDiagnostic('A2', selectedTier)
    };

    const render = async () => {
        container.replaceChildren();
        const heading = document.createElement('div');
        heading.className = 'assistant-package-heading';
        heading.innerHTML = `<strong>${label('title')}</strong><small>${label('device')}</small>`;
        container.append(heading);
        for (const level of ['A1', 'A2']) {
            const capability = capabilities[level];
            let compatible = capability.status === 'candidate';
            let usableTiers = [];
            if (level === 'A2') {
                usableTiers = capability.allowedTiers.filter(tier => LOCAL_AI_ADVANCED_TIERS[tier].status === 'available');
                if (!usableTiers.includes(selectedTier)) {
                    selectedTier = 'desktop32';
                    writeSelectedAdvancedTier(selectedTier);
                }
                compatible = compatible && ramConfirmed && usableTiers.includes('desktop32');
            }
            const candidate = getLocalAiPackageCandidate(level, { tier:selectedTier });
            const status = await manager.status(level, {
                manifest: candidate.manifest,
                baseUrl: candidate.baseUrl,
                legacyLevel: candidate.legacyLevel
            });
            const runtimeTier = level === 'A2' ? selectedTier : 'default';
            const runtimeState = readLocalAiRuntimeState(level, runtimeTier);
            if (runtimeState?.status === 'failed') errors[level] = runtimeState.diagnostic;
            else if (runtimeState && runtimeState.status !== 'failed') delete errors[level];
            if (selected === level && level === 'A2' && (!status.verified || !compatible)) {
                selected = 'A1';
                writeSelectedLocalAi(selected);
            }
            const card = document.createElement('section');
            card.className = `assistant-package-card${selected === level && runtimeState?.status === 'ready' ? ' active' : ''}`;
            const title = label(level === 'A1' ? 'ai1' : 'ai2');
            const desc = label(level === 'A1' ? 'ai1Desc' : 'ai2Desc');
            const meta = `${size(candidate.manifest.approxDownloadBytes)} · ${label('memory')} ${size(candidate.manifest.maxResidentBytes)}`;
            card.innerHTML = `<div><strong>${title}</strong><small>${desc}</small><small>${meta}</small></div>`;
            if (level === 'A2') {
                const requirement = document.createElement('small');
                requirement.className = 'assistant-package-tier-recommendation';
                requirement.textContent = label('desktop32Requirement');
                card.firstElementChild.append(requirement);
                const confirmation = document.createElement('label');
                confirmation.className = 'assistant-package-ram-confirmation';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = ramConfirmed;
                checkbox.disabled = Boolean(downloading);
                checkbox.onchange = () => {
                    ramConfirmed = checkbox.checked;
                    writeDesktop32RamConfirmation(ramConfirmed);
                    if (!ramConfirmed && selected === 'A2') {
                        selected = 'A1';
                        writeSelectedLocalAi(selected);
                    }
                    void render();
                };
                confirmation.append(checkbox, document.createTextNode(label('desktop32Confirm')));
                card.firstElementChild.append(confirmation);
            }
            if (errors[level]) {
                const error = document.createElement('small');
                error.className = 'assistant-package-error';
                error.setAttribute('role', 'alert');
                error.textContent = `${label('failed')}. ${label('fallback')}. ${label('diagnosticCode')}: ${errors[level].code} · ${label('diagnosticStage')}: ${errors[level].stage} · ${errors[level].errorName}`;
                card.firstElementChild.append(error);
            }
            if (status.installed) {
                const installed = document.createElement('small');
                installed.className = 'assistant-package-installed';
                installed.textContent = !status.verified
                    ? label('verificationRequired')
                    : selected !== level
                        ? label('verified')
                        : runtimeState?.status === 'ready'
                            ? label('runtimeReady')
                            : runtimeState?.status === 'starting'
                                ? label('runtimeStarting')
                                : runtimeState?.status === 'failed'
                                    ? label('runtimeFailed')
                                    : label('selected');
                card.firstElementChild.append(installed);
            }
            const actions = document.createElement('div'); actions.className = 'assistant-package-actions';
            if (status.installed && status.verified && compatible && runtimeState?.status !== 'failed') {
                const activate = document.createElement('button'); activate.type = 'button';
                activate.textContent = selected === level ? label('selected') : label('activate');
                activate.disabled = selected === level;
                activate.onclick = () => {
                    selected = level;
                    writeSelectedLocalAi(level);
                    if (level === 'A2') writeSelectedAdvancedTier(selectedTier);
                    writeLocalAiRuntimeState(level, runtimeTier, { status:'verified', stage:'package-check' });
                    void render();
                };
                actions.append(activate);
            }
            if (!status.installed) {
                const install = document.createElement('button'); install.type = 'button';
                install.textContent = compatible ? label('install') : label('unavailable'); install.disabled = !compatible || Boolean(downloading);
                install.onclick = async () => {
                    const confirmed = await showConfirmModal(
                        label('title'),
                        `${label('consent')}\n${label('desktop32Confirm')}\n${size(candidate.manifest.approxDownloadBytes)} · ${label('storage')} ${size(Math.ceil(candidate.manifest.approxDownloadBytes * 2.15))}`,
                        label('install'),
                        label('cancel')
                    );
                    if (!confirmed) return;
                    downloading = level; install.textContent = label('downloading');
                    const progress = document.createElement('progress'); progress.max = candidate.manifest.approxDownloadBytes; progress.value = 0; card.append(progress);
                    let lastStage = 'download';
                    try {
                        delete errors[level];
                        clearDiagnostic(level, selectedTier);
                        await manager.install(candidate.manifest, { baseUrl:candidate.baseUrl,
                            onProgress:value => { progress.value = value.completedBytes; } });
                        const runtime = await loader.load(level, {
                            assessment:capabilities,
                            tier:level === 'A2' ? selectedTier : 'desktop32',
                            onStage:stage => {
                                lastStage = stage;
                                writeLocalAiRuntimeState(level, runtimeTier, { status:'starting', stage });
                            }
                        });
                        writeLocalAiRuntimeState(level, runtimeTier, { status:'ready', stage:'ready' });
                        await runtime.dispose?.();
                        writeLocalAiRuntimeState(level, runtimeTier, { status:'verified', stage:'verification-save' });
                    } catch (error) {
                        if (error?.name !== 'AbortError') errors[level] = reportVerificationFailure(level, selectedTier, error, lastStage);
                    } finally { downloading = null; await render(); }
                };
                actions.append(install);
            }
            if (status.installed && (!status.verified || runtimeState?.status === 'failed') && compatible) {
                const verify = document.createElement('button'); verify.type = 'button'; verify.textContent = label('verify');
                verify.onclick = async () => {
                    verify.disabled = true; verify.textContent = label('verifying');
                    let lastStage = 'preflight';
                    try {
                        delete errors[level];
                        clearDiagnostic(level, selectedTier);
                        const runtime = await loader.load(level, {
                            assessment:capabilities,
                            tier:level === 'A2' ? selectedTier : 'desktop32',
                            onStage:stage => {
                                lastStage = stage;
                                writeLocalAiRuntimeState(level, runtimeTier, { status:'starting', stage });
                            }
                        });
                        writeLocalAiRuntimeState(level, runtimeTier, { status:'ready', stage:'ready' });
                        await runtime.dispose?.();
                        writeLocalAiRuntimeState(level, runtimeTier, { status:'verified', stage:'verification-save' });
                    } catch (error) {
                        errors[level] = reportVerificationFailure(level, selectedTier, error, lastStage);
                    }
                    await render();
                };
                actions.append(verify);
            }
            if (status.installed) {
                const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = label('remove');
                remove.onclick = async () => { await manager.remove(level); clearDiagnostic(level, selectedTier); delete errors[level]; if (selected === level) { selected = 'A1'; writeSelectedLocalAi(selected); } await render(); };
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
