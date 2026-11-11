import {vaultFrameClient} from '../core/vault-frame-client.js';
import {navigateDocument, beginFrameLogout} from '../../frame-navigation.js';
/**
 * IMPOSTAZIONI MODULE (V4.6)
 * Gestisce le impostazioni dell'utente, lingua, tema e vincoli di sicurezza.
 */

import { auth, db } from '../../firebase-config.js?v=1.2.270';
import { signOut, onAuthStateChanged } from "/assets/js/vendor/firebase-runtime.js";
import { doc, updateDoc } from "/assets/js/vendor/firebase-runtime.js";
import { t, tf, getCurrentLanguage } from '../../translations.js';
import { syncTimeoutWithFirestore } from '../../inactivity-timer.js';
import { showToast, showConfirmModal, showInputModal } from '../../ui-core-v129.js';
import { safeSetText, setChildren, createElement, clearElement } from '../../dom-utils.js';
import { decrypt, ensureVaultKeyMaterial, clearSession, resetVault, isBiometricUnlockConfigured, changeMasterPassword } from '../core/security-manager.js';
import { enrollTotp, unenrollTotp, getTotpEnrollment, revokeAllSessions } from '../core/mfa-manager.js';
import { cacheCompanyAreaPreference, getSyncedCompanyAreaPreference } from '../shared/company-area-preference.js';
import { clearPerformanceSamples, getPerformanceDiagnosticReport, isPerformanceDiagnosticsEnabled, setPerformanceDiagnosticsEnabled } from '../../performance-metrics.js';
import { runAppDiagnostics } from '../../app-diagnostics.js';
import { getUserProfile, getUserSetting, listProfileWidgets } from '../data/vault-repository.js';
import { setupPushSettings } from './push-settings-controller.js?push=20261022a';
import { configurationText, firstConfigurationPatch, readFirstConfiguration, setLanguagePreference } from './first-configuration.js';
import {evaluatePortableArchivePassword} from './portable-archive-stream.js';
import {APP_VERSION} from '../../app-env.js';
import {COMPLETE_RECOVERY_ENABLED, COMPLETE_RECOVERY_PATH} from './complete-recovery-config.js';

const portableArchiveModulePromise = import('./portable-archive-service.js');

// [V8.0] FLAG AMBIENTE — automatico: true solo su localhost, false in produzione
const DEV_MODE = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

let currentUserData = null;

/**
 * IMPOSTAZIONI MODULE (V5.0 ADAPTER) - RESET NOTIFICHE
 * Gestione preferenze globali.
 */
export async function initImpostazioni(user) {
    
    if (!user) return;

    await loadUserData(user);
    setupSettingsProfileQr(user);
    initSettingsEvents(user);
    setupSecurityToggles(currentUserData);
    setupCompanyAreaToggle(user, currentUserData);
    setupAppInfo();
    setupPrivacyShort();
    setupTermsShort();
    setupPerformanceDiagnostics();
    void import('./frame-diagnostics-ui.js').then(module => module.setupFrameDiagnostics()).catch(() => {});
    setupEncryptedBackup(user);
    setupPortableArchive(user);
    setupEncryptedRestore(user);
    if (COMPLETE_RECOVERY_ENABLED && !document.getElementById('complete-recovery-entry-link')) {
        const link = createElement('a', {id: 'complete-recovery-entry-link', href: COMPLETE_RECOVERY_PATH,
            className: 'btn-modal btn-secondary', textContent: t('recovery_entry')});
        document.getElementById('btn-restore-encrypted-backup')?.insertAdjacentElement('afterend', link);
    }
    setupCredentialHealth(user);
    setupAccountFieldUsage(user);
    setupSharedCredentials(user);
    await setupPushSettings(user);
    showPendingSecurityNotice();

    
}

function setupSharedCredentials(user) {
    document.getElementById('btn-shared-credentials')?.addEventListener('click', async () => {
        try {
            const {openSharedCredentialsSettings} = await import('./shared-credentials-controller.js?v=1.2.270');
            await openSharedCredentialsSettings(user);
        } catch (error) {
            console.error('[SHARED CREDENTIALS] Apertura fallita.', error);
            showToast(error.message || 'Impossibile aprire le Credenziali comuni.', 'error');
        }
    });
}

function showCredentialHealthResults(report, action) {
    action.check();
    const flagLabels = {weak: 'Debole', duplicate: 'Duplicata', dated: 'Datata'};
    const strengthLabels = {weak: 'Debole', medium: 'Media', strong: 'Forte'};
    const modal = createElement('div', {
        className: 'modal-overlay', role: 'dialog', 'aria-modal': 'true',
        'aria-labelledby': 'credential-health-title'
    });
    const closeButton = createElement('button', {className: 'btn-modal btn-primary', textContent: t('close')});
    const previouslyFocused = document.activeElement;
    const close = () => {
        const restoreFocus = action.active();
        action.dispose();
        if (restoreFocus && previouslyFocused?.isConnected) previouslyFocused.focus?.();
    };
    const timer = setTimeout(() => {
        if (!action.active()) return;
        modal.classList.add('active'); closeButton.focus();
    }, 10);
    action.own(() => {
        clearTimeout(timer); modal.replaceChildren(); modal.remove(); report.results.length = 0;
    });
    closeButton.addEventListener('click', close);
    const list = createElement('div', {
        className: 'credential-health-list', tabIndex: 0,
        role: 'region', 'aria-label': t('dyn_health_results_aria')
    });
    const onKeydown = event => {
        if (!action.active()) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
        else if (event.key === 'Tab') {
            event.preventDefault();
            const controls = [list, closeButton], index = controls.indexOf(document.activeElement);
            controls[event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length].focus();
        }
    };
    modal.addEventListener('keydown', onKeydown);
    action.own(() => modal.removeEventListener('keydown', onKeydown));
    if (!report.results.length) {
        list.appendChild(createElement('p', {
            className: 'credential-health-empty',
            textContent: t('dyn_health_none')
        }));
    } else {
        report.results.forEach(item => {
            const context = item.area === 'azienda'
                ? `${t('dyn_health_company')}${item.companyName ? ` · ${item.companyName}` : ''}`
                : t('dyn_health_private');
            const extraFlags = item.flags.filter(flag => flag !== 'weak');
            const tags = createElement('div', {className: 'credential-health-tags'}, [
                createElement('span', {
                    className: `credential-health-tag credential-health-${item.strength}`,
                    textContent: strengthLabels[item.strength] || item.strength
                }),
                ...extraFlags.map(flag => createElement('span', {
                    className: `credential-health-tag credential-health-${flag}`,
                    textContent: flagLabels[flag] || flag
                }))
            ]);
            list.appendChild(createElement('div', {className: 'credential-health-result'}, [
                createElement('div', {className: 'credential-health-identity'}, [
                    createElement('strong', {textContent: item.title}),
                    createElement('span', {textContent: context})
                ]),
                tags
            ]));
        });
    }
    const unavailable = report.unavailable
        ? ` · ${tf('dyn_health_unreadable', {count: report.unavailable})}`
        : '';
    modal.appendChild(createElement('div', {className: 'modal-box credential-health-modal'}, [
        createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue notranslate', textContent: 'health_and_safety'}),
        createElement('h3', {id: 'credential-health-title', className: 'modal-title', textContent: t('settings_credential_health_title')}),
        createElement('p', {
            className: 'modal-text',
            textContent: tf('dyn_health_summary', {scanned: report.scanned, risk: report.atRisk, unavailable})
        }),
        list,
        createElement('p', {
            className: 'credential-health-privacy',
            textContent: t('dyn_health_online_note')
        }),
        createElement('div', {className: 'modal-actions'}, [closeButton])
    ]));
    document.body.appendChild(modal);
}

let disposeCredentialHealthSetup = () => {};
function setupCredentialHealth(user) {
    disposeCredentialHealthSetup();
    const button = document.getElementById('btn-credential-health');
    if (!button) return;
    let action = null, running = false;
    const click = async () => {
        if (running || auth.currentUser?.uid !== user.uid) return;
        action?.dispose();
        const current = action = createBackupRestoreAction(user.uid, button);
        running = true;
        button.disabled = true;
        const working = showBackupWorking(
            'Salute credenziali',
            'Analisi locale delle credenziali in corso…', current
        );
        try {
            const {inspectOwnerCredentialHealth} = await import('./credential-health-service.js?v=1.2.270');
            current.check();
            const report = await inspectOwnerCredentialHealth(user.uid, {signal: current.signal, isActive: current.active});
            current.check();
            working.close();
            showCredentialHealthResults(report, current);
        } catch (error) {
            working.close();
            if (current.active() && error?.message !== 'USER_CANCELLED') {
                showToast(t('dyn_settings_health_incomplete'), 'error');
            }
            current.dispose();
        } finally {
            if (action === current) { button.disabled = false; running = false; }
        }
    };
    button.addEventListener('click', click);
    disposeCredentialHealthSetup = () => {
        action?.dispose(); action = null; running = false; button.disabled = false;
        button.removeEventListener('click', click);
    };
}

function usageReportText(report) {
    const lines = [
        'Tipo\tCampo\tGruppo\tPrivati\tAziendali\tCompilati\tAccount leggibili\tUtilizzo\tStato\tIndicazione'
    ];
    const append = (type, row) => lines.push([
        type, row.label, row.group || 'Widget', row.privateUsed, row.companyUsed,
        row.used, row.eligible, `${row.percentage}%`, row.status, row.recommendation
    ].join('\t'));
    report.fields.forEach(row => append('Campo standard', row));
    report.widgets.forEach(row => append('Widget', row));
    return lines.join('\n');
}

function usageTable(title, rows) {
    const body = createElement('tbody');
    rows.forEach(row => body.appendChild(createElement('tr', {}, [
        createElement('th', {scope: 'row'}, [
            createElement('strong', {textContent: row.label}),
            createElement('span', {textContent: row.group || 'Widget'})
        ]),
        createElement('td', {textContent: String(row.privateUsed)}),
        createElement('td', {textContent: String(row.companyUsed)}),
        createElement('td', {textContent: `${row.used}/${row.eligible}`}),
        createElement('td', {textContent: `${row.percentage}%`}),
        createElement('td', {}, [
            createElement('strong', {textContent: row.status}),
            createElement('span', {textContent: row.recommendation}),
            row.unavailable
                ? createElement('small', {textContent: tf('dyn_field_unreadable', {count: row.unavailable})})
                : null
        ])
    ])));
    return createElement('section', {className: 'account-field-usage-section'}, [
        createElement('h4', {textContent: title}),
        createElement('div', {className: 'account-field-usage-scroll'}, [
            createElement('table', {className: 'account-field-usage-table'}, [
                createElement('thead', {}, [createElement('tr', {}, [
                    createElement('th', {scope: 'col', textContent: t('dyn_field_col_name')}),
                    createElement('th', {scope: 'col', textContent: t('dyn_field_col_private')}),
                    createElement('th', {scope: 'col', textContent: t('dyn_field_col_company')}),
                    createElement('th', {scope: 'col', textContent: t('dyn_field_col_used')}),
                    createElement('th', {scope: 'col', textContent: '%'}),
                    createElement('th', {scope: 'col', textContent: t('dyn_field_col_rating')})
                ])]),
                body
            ])
        ])
    ]);
}

function showAccountFieldUsage(report) {
    const modal = createElement('div', {
        className: 'modal-overlay', role: 'dialog', 'aria-modal': 'true',
        'aria-labelledby': 'account-field-usage-title'
    });
    const closeButton = createElement('button', {className: 'btn-modal btn-secondary', textContent: t('close')});
    const copyButton = createElement('button', {className: 'btn-modal btn-primary', textContent: t('settings_copy_report')});
    const previouslyFocused = document.activeElement;
    const close = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            previouslyFocused?.focus?.();
        }, 300);
    };
    closeButton.addEventListener('click', close);
    copyButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(usageReportText(report));
            showToast(t('dyn_field_report_copied'), 'success');
        } catch {
            showToast(t('dyn_copy_unavailable_device'), 'error');
        }
    });
    modal.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    const summary = report.totals;
    const content = [
        createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue notranslate', textContent: 'table_view'}),
        createElement('h3', {id: 'account-field-usage-title', className: 'modal-title', textContent: t('settings_field_usage_title')}),
        createElement('p', {
            className: 'modal-text',
            textContent: tf('dyn_field_summary', {accounts: summary.accounts, private: summary.privateAccounts, company: summary.companyAccounts, archived: summary.archivedExcluded})
        }),
        createElement('p', {
            className: 'account-field-usage-privacy',
            textContent: t('dyn_field_privacy')
        }),
        usageTable(t('dyn_field_standard'), report.fields)
    ];
    if (report.widgets.length) content.push(usageTable(t('dyn_field_widgets'), report.widgets));
    content.push(createElement('div', {className: 'modal-actions'}, [closeButton, copyButton]));
    modal.appendChild(createElement('div', {className: 'modal-box account-field-usage-modal'}, content));
    document.body.appendChild(modal);
    requestAnimationFrame(() => {
        modal.classList.add('active');
        closeButton.focus();
    });
}

function setupAccountFieldUsage(user) {
    const button = document.getElementById('btn-account-field-usage');
    if (!button) return;
    button.addEventListener('click', async () => {
        button.disabled = true;
        const working = showBackupWorking(
            'Analisi campi Account',
            'Controllo locale dei campi realmente compilati in corso…'
        );
        try {
            const {inspectAccountFieldUsage} = await import('./account-field-usage-service.js?v=1.2.270');
            const report = await inspectAccountFieldUsage(user.uid);
            working.close();
            showAccountFieldUsage(report);
        } catch (error) {
            working.close();
            if (error?.message !== 'USER_CANCELLED') {
                console.warn('[ACCOUNT FIELD USAGE] Analisi non disponibile.', error?.message);
                showToast(t('dyn_field_analysis_incomplete'), 'error');
            }
        } finally {
            button.disabled = false;
        }
    });
}

let disposeRestoreSetup = () => {};

function createBackupRestoreAction(uid, button) {
    const controller = new AbortController();
    const cleanups = new Set();
    let unsubscribe = () => {};
    const dispose = () => {
        if (controller.signal.aborted) return;
        controller.abort();
        unsubscribe();
        globalThis.removeEventListener('vault-session-locked', dispose);
        globalThis.removeEventListener('pagehide', dispose);
        for (const cleanup of [...cleanups]) cleanup();
        cleanups.clear();
    };
    const active = () => {
        if (!controller.signal.aborted && (auth.currentUser?.uid !== uid || button.isConnected === false)) dispose();
        return !controller.signal.aborted;
    };
    const check = () => { if (!active()) throw new Error('BACKUP_SESSION_INVALIDATED'); };
    const own = cleanup => {
        if (!active()) { cleanup(); return () => {}; }
        cleanups.add(cleanup);
        return () => cleanups.delete(cleanup);
    };
    globalThis.addEventListener('vault-session-locked', dispose);
    globalThis.addEventListener('pagehide', dispose);
    unsubscribe = onAuthStateChanged(auth, user => { if (user?.uid !== uid) dispose(); });
    if (controller.signal.aborted) unsubscribe();
    return {active, check, own, dispose, signal: controller.signal};
}

function showBackupRestoreInput(action, title, placeholder, description, secret = false) {
    return new Promise(resolve => {
        if (!action.active()) return resolve(null);
        let settled = false, unregister = () => {};
        const previousFocus = document.activeElement;
        const input = createElement('input', {
            type: 'text', value: '', placeholder, autocomplete: 'off', autocapitalize: 'off',
            spellcheck: false, 'data-form-type': 'other', 'data-1p-ignore': 'true', 'data-lpignore': 'true',
            className: `glass-field modal-input-glass${secret ? ' vault-secret-input' : ''}`,
            'aria-label': title
        });
        const close = value => {
            if (settled) return;
            settled = true;
            input.value = '';
            modal.remove();
            unregister();
            resolve(value);
            if (action.active() && previousFocus?.isConnected) previousFocus.focus();
        };
        const modal = createElement('div', {className: 'modal-overlay active'}, [
            createElement('form', {className: 'modal-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
                onsubmit: event => { event.preventDefault(); if (action.active()) close(input.value); }}, [
                createElement('h3', {className: 'modal-title', textContent: title}),
                createElement('p', {className: 'modal-text', textContent: description}), input,
                createElement('div', {className: 'modal-actions'}, [
                    createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: t('cancel'), onclick: () => close(null)}),
                    createElement('button', {type: 'submit', className: 'btn-modal btn-primary', textContent: t('confirm')})
                ])
            ])
        ]);
        modal.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(null); } });
        unregister = action.own(() => close(null));
        document.body.appendChild(modal);
        input.focus();
    });
}

function showBackupRestoreRetry(action) {
    return new Promise(resolve => {
        if (!action.active()) return resolve(false);
        let settled = false, unregister = () => {};
        const previousFocus = document.activeElement;
        const close = value => {
            if (settled) return;
            settled = true; modal.remove(); unregister(); resolve(value);
            if (action.active() && previousFocus?.isConnected) previousFocus.focus();
        };
        const retry = createElement('button', {type: 'button', className: 'btn-modal btn-primary',
            textContent: t('dyn_restore_verify_resume'), onclick: () => { if (action.active()) close(true); }});
        const modal = createElement('div', {className: 'modal-overlay active'}, [
            createElement('section', {className: 'modal-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('dyn_restore_no_response')}, [
                createElement('h3', {className: 'modal-title', textContent: t('dyn_restore_no_response')}),
                createElement('p', {className: 'modal-text', textContent: t('dyn_restore_server_partial')}),
                createElement('div', {className: 'modal-actions'}, [
                    createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: t('dyn_stop'), onclick: () => close(false)}), retry
                ])
            ])
        ]);
        modal.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(false); } });
        unregister = action.own(() => close(false));
        document.body.appendChild(modal); retry.focus();
    });
}

function setupEncryptedRestore(user) {
    disposeRestoreSetup();
    const button = document.getElementById('btn-restore-encrypted-backup');
    if (!button || auth.currentUser?.uid !== user.uid) return;
    button.disabled = false;
    const input = createElement('input', {
        type: 'file', accept: '.cpbackup,application/x-codici-password-backup', className: 'hidden'
    });
    document.body.appendChild(input);
    let action = null, running = false, setupDisposed = false;
    const selectFile = () => { if (!setupDisposed && !running && auth.currentUser?.uid === user.uid) input.click(); };
    button.addEventListener('click', selectFile);
    disposeRestoreSetup = () => { setupDisposed = true; action?.dispose(); input.remove(); button.removeEventListener('click', selectFile); };
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file || setupDisposed || running || auth.currentUser?.uid !== user.uid) return;
        running = true;
        action = createBackupRestoreAction(user.uid, button);
        const currentAction = action;
        button.disabled = true;
        let working = null, plan = null, release = () => {}, recoveryKey = '';
        try {
            recoveryKey = await showBackupRestoreInput(currentAction, 'Recovery Key del backup',
                'xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx',
                'La chiave viene usata soltanto in memoria per verificare e aprire questo file.', true);
            currentAction.check();
            if (!recoveryKey) return;
            working = showBackupWorking('Verifica completa del backup…', 'Il file viene aperto e controllato voce per voce.', currentAction);
            const {prepareBackupRestore, executeBackupRestore, releaseBackupRestore, resumeBackupRestore} =
                await import('./backup-import-service.js');
            const executeWithRetry = async (selectedIndexes = null) => {
                let retry = false;
                while (true) {
                    currentAction.check();
                    try { return await executeBackupRestore(plan, selectedIndexes, {retry}); }
                    catch (error) {
                        currentAction.check();
                        if (error?.retryable !== true || !['BACKUP_FIRESTORE_UNCERTAIN', 'BACKUP_STORAGE_UNCERTAIN', 'BACKUP_RETRY_REQUIRED'].includes(error.code)) throw error;
                        working?.close(); working = null;
                        const resume = await showBackupRestoreRetry(currentAction);
                        currentAction.check();
                        if (!resume) throw error;
                        retry = true;
                        working = showBackupWorking('Verifica e ripresa del ripristino…', 'Gli elementi già applicati vengono riconosciuti prima di proseguire.', currentAction);
                    }
                }
            };
            currentAction.check();
            release = () => { if (plan) releaseBackupRestore(plan); plan = null; recoveryKey = ''; };
            currentAction.own(release);
            plan = await prepareBackupRestore(file, user.uid, recoveryKey.trim().toLowerCase(), {
                signal: currentAction.signal, isActive: currentAction.active
            });
            recoveryKey = '';
            currentAction.check();
            working.close();
            working = null;
            if (plan.resumeAvailable) {
                const typed = await showBackupRestoreInput(currentAction, 'Riprendi ripristino interrotto', 'RIPRENDI',
                    'È stato trovato un piano verificato per questo backup. Scrivi RIPRENDI per riconoscere i chunk già applicati e completare solo quelli mancanti.');
                currentAction.check();
                if (typed === 'RIPRENDI') {
                    working = showBackupWorking('Ripresa del ripristino…',
                        'Le ricevute confermate vengono verificate prima di proseguire.', currentAction);
                    const result = await resumeBackupRestore(plan);
                    currentAction.check();
                    working.close(); working = null;
                    await reloadAfterBackupRestore(result, currentAction);
                    return;
                }
            }
            if (plan.collisionCount) {
                const selectedIndexes = await showBackupRestorePreview(plan, currentAction);
                currentAction.check();
                if (!selectedIndexes.length) return;
                const selectedEntries = plan.comparison.entries.filter(entry => selectedIndexes.includes(entry.index));
                const changedCount = selectedEntries.filter(entry => entry.status === 'changed').length;
                const typed = await showBackupRestoreInput(currentAction,
                    'Conferma ripristino selettivo', 'RIPRISTINA',
                    `${selectedIndexes.length} elementi selezionati${changedCount ? `, di cui ${changedCount} sostituiranno la versione attuale` : ''}. ${plan.excludedSecuritySettings ? 'Le impostazioni di sicurezza presenti nel backup sono state verificate ma escluse: restano valide quelle attuali. ' : ''}Il backup può ricreare elementi eliminati definitivamente. Le vecchie condivisioni del backup non vengono riattivate; gli accessi degli Account attivi esistenti restano invariati, quelli degli Account archiviati non vengono riattivati. Scrivi RIPRISTINA per continuare.`
                );
                currentAction.check();
                if (typed !== 'RIPRISTINA') return;
                working = showBackupWorking('Ripristino selettivo in corso…', 'Il blocco ferma i passaggi successivi; le richieste già inviate possono completarsi.', currentAction);
                const result = await executeWithRetry(selectedIndexes);
                currentAction.check();
                working.close();
                working = null;
                await reloadAfterBackupRestore(result, currentAction);
                return;
            }
            const typed = await showBackupRestoreInput(currentAction,
                'Conferma ripristino', 'RIPRISTINA',
                `File integro: ${plan.counts.records} record e ${plan.counts.attachments} allegati. ${plan.excludedSecuritySettings ? 'Le impostazioni di sicurezza presenti nel backup sono state verificate ma escluse: restano valide quelle attuali. ' : ''}Nessuna collisione rilevata. Il backup può ricreare elementi eliminati definitivamente, senza riattivare le vecchie condivisioni. Scrivi RIPRISTINA per applicare i dati.`
            );
            currentAction.check();
            if (typed !== 'RIPRISTINA') return;
            working = showBackupWorking('Ripristino in corso…', 'Il blocco ferma i passaggi successivi; le richieste già inviate possono completarsi.', currentAction);
            const result = await executeWithRetry();
            currentAction.check();
            working.close();
            working = null;
            await reloadAfterBackupRestore(result, currentAction);
        } catch (error) {
            if (!currentAction.active()) return;
            if (error?.progress?.mayHaveApplied) {
                showToast(t('dyn_restore_partial_warning'), 'warning');
                return;
            }
            if (error?.code === 'BACKUP_PREVIEW_STALE' || error?.message === 'BACKUP_PREVIEW_STALE') {
                showToast(t('dyn_restore_data_changed'), 'warning');
                return;
            }
            if (error?.code === 'BACKUP_TIMESTAMP_PRECISION_UNSUPPORTED' || error?.message === 'BACKUP_TIMESTAMP_PRECISION_UNSUPPORTED') {
                showToast(t('dyn_restore_precision_blocked'), 'warning');
                return;
            }
            const collision = error?.code === 'BACKUP_COLLISIONS' || String(error?.message || '').startsWith('BACKUP_COLLISIONS:');
            if (error?.message === 'BACKUP_PREVIEW_CAPACITY_EXCEEDED') {
                showToast(t('dyn_restore_preview_capacity'), 'warning');
                return;
            }
            showToast(collision
                ? 'Ripristino bloccato: nel Vault esistono già record con gli stessi identificativi.'
                : 'Backup non valido, incompleto o non applicabile.', 'error');
        } finally {
            working?.close();
            release();
            if (currentAction.active()) button.disabled = false;
            currentAction.dispose();
            running = false;
        }
    });
}

function reloadAfterBackupRestore(result, action) {
    action.check();
    showToast(
        tf('dyn_restore_completed', {records: result.recordCount, attachments: result.attachmentCount}),
        'success'
    );
    return new Promise(resolve => {
        let unregister = () => {};
        const timer = setTimeout(() => {
            unregister();
            if (action.active()) window.location.reload();
            resolve();
        }, 900);
        unregister = action.own(() => { clearTimeout(timer); resolve(); });
    });
}

function showBackupWorking(title, message, action) {
    const modal = createElement('div', {
        className: 'modal-overlay backup-working-overlay', role: 'alertdialog',
        'aria-modal': 'true', 'aria-live': 'polite', 'aria-busy': 'true'
    });
    const cancelButton = action ? createElement('button', {
        type: 'button', className: 'btn-modal btn-secondary', textContent: t('cancel'),
        onclick: () => action.dispose()
    }) : null;
    modal.appendChild(createElement('div', {className: 'modal-box backup-working-modal'}, [
        createElement('span', {
            className: 'material-symbols-outlined modal-icon animate-spin icon-accent-blue notranslate',
            textContent: 'progress_activity', 'aria-hidden': 'true'
        }),
        createElement('h3', {className: 'modal-title', textContent: title}),
        createElement('p', {className: 'modal-text', textContent: message}),
        ...(cancelButton ? [createElement('div', {className: 'modal-actions'}, [cancelButton])] : [])
    ]));
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
    let closed = false;
    let unregister = () => {};
    const working = {
        close() {
            if (closed) return;
            closed = true;
            modal.classList.remove('active');
            modal.remove();
            unregister();
        }
    };
    unregister = action?.own(() => working.close()) || unregister;
    return working;
}

function showBackupRestorePreview(plan, action) {
    return new Promise(resolve => {
        if (!action.active()) return resolve([]);
        let settled = false, unregister = () => {};
        const modal = createElement('div', {className: 'modal-overlay'});
        const closeButton = createElement('button', {
            className: 'btn-modal btn-secondary', textContent: t('dyn_restore_close_preview')
        });
        const restoreButton = createElement('button', {
            className: 'btn-modal btn-primary', textContent: t('dyn_restore_selected')
        });
        const summaryToggle = createElement('button', {
            type: 'button', className: 'backup-preview-toggle',
            'aria-expanded': 'true', 'aria-label': t('dyn_preview_collapse_aria')
        }, [
            createElement('span', {textContent: t('dyn_preview_collapse')}),
            createElement('span', {
                className: 'material-symbols-outlined notranslate', textContent: 'expand_less', 'aria-hidden': 'true'
            })
        ]);
        const labels = {missing: t('dyn_restore_missing'), unchanged: t('dyn_restore_unchanged'), changed: t('dyn_restore_changed')};
        const scopeLabels = {
            profile: t('dyn_scope_profile'), settings: t('dyn_scope_settings'), 'private-account': t('dyn_scope_private_account'),
            company: t('dyn_scope_company'), 'company-account': t('dyn_scope_company_account'), deadline: t('dyn_scope_deadline'),
            contact: t('dyn_scope_contact'), 'profile-widget': t('dyn_scope_profile_widget'),
            'private-account-attachment': t('dyn_scope_private_attachment'), 'company-account-attachment': t('dyn_scope_company_attachment')
        };
        const scopeCounts = new Map();
        plan.comparison.entries.forEach(entry => {
            scopeCounts.set(entry.scope, (scopeCounts.get(entry.scope) || 0) + 1);
        });
        const summary = createElement('div', {className: 'backup-preview-summary'}, [...scopeCounts].map(([scope, count]) =>
            createElement('span', {
                className: 'backup-preview-summary-item',
                textContent: tf('dyn_scope_count', {scope: scopeLabels[scope] || scope, count})
            })
        ));
        const selectable = [];
        const rows = plan.comparison.entries.map(entry => {
            const checkbox = createElement('input', {
                type: 'checkbox', checked: entry.status === 'missing', disabled: entry.status === 'unchanged',
                'aria-label': tf('dyn_restore_select', {description: entry.description})
            });
            if (entry.status !== 'unchanged') selectable.push({entry, checkbox});
            const details = createElement('span', {className: 'backup-preview-details'}, [
                createElement('strong', {className: 'backup-preview-name', textContent: entry.description}),
                createElement('small', {textContent: scopeLabels[entry.scope] || entry.scope})
            ]);
            return createElement('li', {className: `backup-preview-row backup-preview-${entry.status}`}, [
                checkbox,
                details,
                createElement('strong', {className: 'backup-preview-status', textContent: labels[entry.status]})
            ]);
        });
        const close = result => {
            if (settled) return;
            settled = true;
            modal.remove();
            unregister();
            resolve(result);
        };
        const updateRestoreButton = () => {
            const count = selectable.filter(item => item.checkbox.checked).length;
            restoreButton.disabled = count === 0;
            restoreButton.textContent = count ? tf('dyn_restore_selected_count', {count}) : t('dyn_restore_selected');
        };
        selectable.forEach(item => item.checkbox.addEventListener('change', updateRestoreButton));
        closeButton.addEventListener('click', () => close([]));
        restoreButton.addEventListener('click', () => { if (action.active()) close(selectable
            .filter(item => item.checkbox.checked)
            .map(item => item.entry.index)); });
        updateRestoreButton();
        const summaryContent = createElement('div', {className: 'backup-preview-summary-content'}, [
            createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue notranslate', textContent: 'preview'}),
            createElement('h3', {className: 'modal-title', textContent: t('dyn_restore_preview_title')}),
            createElement('p', {
                className: 'modal-text',
                textContent: tf('dyn_restore_comparison', plan.comparison.counts)
            }),
            summary
        ]);
        summaryToggle.addEventListener('click', () => {
            const expanded = summaryToggle.getAttribute('aria-expanded') === 'true';
            summaryToggle.setAttribute('aria-expanded', String(!expanded));
            summaryToggle.setAttribute('aria-label', expanded ? t('dyn_preview_expand_aria') : t('dyn_preview_collapse_aria'));
            summaryContent.hidden = expanded;
            summaryToggle.firstElementChild.textContent = expanded ? t('dyn_preview_expand') : t('dyn_preview_collapse');
            summaryToggle.lastElementChild.textContent = expanded ? 'expand_more' : 'expand_less';
        });
        modal.appendChild(createElement('div', {className: 'modal-box backup-preview-modal'}, [
            summaryToggle,
            summaryContent,
            createElement('ul', {className: 'backup-preview-list'}, rows),
            createElement('div', {className: 'modal-actions'}, [closeButton, restoreButton])
        ]));
        document.body.appendChild(modal);
        unregister = action.own(() => close([]));
        setTimeout(() => { if (!settled && action.active()) modal.classList.add('active'); }, 10);
    });
}

function showRecoveryKeyOnce(recoveryKey, summary, action) {
    return new Promise(resolve => {
        if (!action.active()) return resolve();
        let settled = false, unregister = () => {};
        const modal = createElement('div', {className: 'modal-overlay'});
        const keyField = createElement('input', {
            className: 'glass-field modal-input-glass backup-recovery-key-field', value: recoveryKey, readOnly: true,
            'aria-label': t('dyn_recovery_key_aria'), autocomplete: 'off', spellcheck: false
        });
        const acknowledged = createElement('input', {type: 'checkbox', id: 'backup-key-saved'});
        const closeButton = createElement('button', {
            className: 'btn-modal btn-primary', textContent: t('dyn_recovery_saved'), disabled: true
        });
        const copyButton = createElement('button', {className: 'btn-modal btn-secondary', textContent: t('dyn_recovery_copy')});
        const close = () => {
            if (settled) return;
            settled = true; recoveryKey = ''; keyField.value = ''; copyButton.disabled = closeButton.disabled = true;
            modal.remove(); unregister(); resolve();
        };
        acknowledged.addEventListener('change', () => { if (!settled && action.active()) closeButton.disabled = !acknowledged.checked; });
        copyButton.addEventListener('click', async () => {
            if (settled || !action.active()) return;
            try {
                await navigator.clipboard.writeText(recoveryKey);
                if (!settled && action.active()) showToast(t('dyn_recovery_key_copied'), 'success');
            } catch {
                if (settled || !action.active()) return;
                keyField.focus(); keyField.select();
                showToast(t('dyn_recovery_key_copy_manual'), 'info');
            }
        });
        closeButton.addEventListener('click', () => {
            if (!acknowledged.checked || !action.active()) return;
            close();
        });
        const confirmation = createElement('label', {className: 'backup-key-confirmation'}, [
            acknowledged,
            createElement('span', {textContent: t('dyn_recovery_confirm')})
        ]);
        modal.appendChild(createElement('div', {className: 'modal-box'}, [
            createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue notranslate', textContent: 'key'}),
            createElement('h3', {className: 'modal-title', textContent: t('dyn_recovery_title')}),
            createElement('p', {
                className: 'modal-text',
                textContent: tf('dyn_backup_completed', {records: summary.recordCount, attachments: summary.attachmentCount})
            }),
            keyField,
            confirmation,
            createElement('div', {className: 'modal-actions'}, [copyButton, closeButton])
        ]));
        document.body.appendChild(modal);
        unregister = action.own(close);
        setTimeout(() => { if (!settled && action.active()) modal.classList.add('active'); }, 10);
    });
}

let disposeExportSetup = () => {};
function setupEncryptedBackup(user) {
    disposeExportSetup();
    const button = document.getElementById('btn-export-encrypted-backup');
    if (!button) return;
    let currentAction;
    const click = () => {
        if (button.disabled || auth.currentUser?.uid !== user.uid) return;
        const action = createBackupRestoreAction(user.uid, button); currentAction = action;
        button.disabled = true;
        const modal = createElement('div', {className: 'modal-overlay'});
        const cancelButton = createElement('button', {className: 'btn-modal btn-secondary', textContent: t('cancel')});
        const startButton = createElement('button', {className: 'btn-modal btn-primary', textContent: t('dyn_backup_preparing'), disabled: true});
        const modulePromise = import('./backup-export-service.js');
        const completePromise = COMPLETE_RECOVERY_ENABLED ? import('./complete-recovery-entry.js') : null;
        const readyPromise = COMPLETE_RECOVERY_ENABLED ? Promise.all([modulePromise, completePromise]) : modulePromise;
        readyPromise.then(() => {
            if (!action.active()) return;
            startButton.disabled = false;
            startButton.textContent = t('dyn_backup_choose');
        }).catch(() => {
            if (action.active()) startButton.textContent = t('dyn_backup_unavailable');
        });
        const close = () => modal.remove();
        action.own(() => { close(); if (currentAction === action) button.disabled = false; });
        cancelButton.addEventListener('click', () => { if (action.active()) action.dispose(); });
        startButton.addEventListener('click', async () => {
            if (!action.active() || startButton.disabled) return;
            startButton.disabled = true;
            let result, completeOptions;
            try {
                const {exportOwnerBackup} = await modulePromise;
                action.check();
                const options = {signal: action.signal, isActive: action.active};
                if (COMPLETE_RECOVERY_ENABLED) {
                    const {createCompleteRecoveryExportOptions} = await completePromise;
                    action.check();
                    completeOptions = createCompleteRecoveryExportOptions({uid: user.uid, ...options});
                    if (completeOptions?.profile !== 'complete-recovery') throw new Error('RECOVERY_UI_NOT_CONFIGURED');
                    Object.assign(options, completeOptions);
                }
                const exportPromise = exportOwnerBackup(user.uid, options);
                close();
                button.disabled = true;
                showToast(t('dyn_backup_preparing'), 'info');
                result = await exportPromise;
                action.check();
                await showRecoveryKeyOnce(result.recoveryKey, result, action);
            } catch (error) {
                if (COMPLETE_RECOVERY_ENABLED && (error?.code || error?.message) === 'RECOVERY_ASSET_RECENT_AUTH_REQUIRED' && action.active()) {
                    const accepted = await showCompleteExportReauthentication(action);
                    if (accepted && action.active()) navigateDocument('/login.html?reauth=security-settings', true);
                } else if (action.active() && error?.name !== 'AbortError' && error?.message !== 'RECOVERY_EXPORT_CANCELLED') {
                    showToast(error?.code === 'BACKUP_EXPORT_CAPACITY_EXCEEDED'
                        ? t('dyn_backup_too_large')
                        : error?.code === 'BACKUP_EXPORT_RECORD_CAPACITY_EXCEEDED'
                            ? t('dyn_backup_capacity')
                        : t('dyn_backup_incomplete'), 'error');
                }
            } finally {
                if (result) result.recoveryKey = '';
                completeOptions?.dispose();
                action.dispose();
            }
        });
        modal.appendChild(createElement('div', {className: 'modal-box'}, [
            createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue notranslate', textContent: 'encrypted'}),
            createElement('h3', {className: 'modal-title', textContent: t('dyn_backup_create')}),
            createElement('p', {
                className: 'modal-text',
                textContent: t(COMPLETE_RECOVERY_ENABLED ? 'recovery_export_description' : 'dyn_backup_contents')
            }),
            createElement('div', {className: 'modal-actions'}, [cancelButton, startButton])
        ]));
        document.body.appendChild(modal);
        setTimeout(() => { if (action.active()) modal.classList.add('active'); }, 10);
    };
    button.addEventListener('click', click);
    disposeExportSetup = () => { currentAction?.dispose(); button.removeEventListener('click', click); button.disabled = false; };
}

function showCompleteExportReauthentication(action) {
    return new Promise(resolve => {
        if (!action.active()) return resolve(false);
        let settled = false, unregister = () => {};
        const previous = document.activeElement;
        const close = accepted => {
            if (settled) return; settled = true; modal.remove(); unregister();
            if (action.active() && previous?.isConnected) previous.focus();
            resolve(accepted === true);
        };
        const cancel = createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: t('cancel'), onclick: () => close(false)});
        const accept = createElement('button', {type: 'button', className: 'btn-modal btn-primary', textContent: t('recovery_export_sign_in'),
            onclick: () => close(action.active())});
        const modal = createElement('div', {className: 'modal-overlay active'}, [createElement('section', {
            className: 'modal-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'complete-export-reauth-title'
        }, [createElement('h3', {id: 'complete-export-reauth-title', className: 'modal-title', textContent: t('dyn_backup_create')}),
            createElement('p', {className: 'modal-text', textContent: t('recovery_export_reauth')}),
            createElement('div', {className: 'modal-actions'}, [cancel, accept])])]);
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(false); }
            if (event.key === 'Tab' && ((event.shiftKey && document.activeElement === cancel) || (!event.shiftKey && document.activeElement === accept))) {
                event.preventDefault(); (event.shiftKey ? accept : cancel).focus();
            }
        });
        unregister = action.own(() => close(false));
        document.body.appendChild(modal); cancel.focus();
    });
}

let disposePortableArchiveSetup = () => {};
function portablePasswordMessage(assessment) {
    const keys = {
        PORTABLE_PASSWORD_REQUIRED: 'portable_password_required', PORTABLE_PASSWORD_TOO_SHORT: 'portable_password_short',
        PORTABLE_PASSWORD_TOO_LONG: 'portable_password_long', PORTABLE_PASSWORD_COMMON: 'portable_password_common',
        PORTABLE_PASSWORD_REPETITIVE: 'portable_password_repetitive', PORTABLE_PASSWORD_WEAK: 'portable_password_weak'
    };
    return assessment.valid ? t('portable_password_strong') : t(keys[assessment.code] || 'portable_password_required');
}
function setupPortableArchive(user) {
    disposePortableArchiveSetup();
    const button = document.getElementById('btn-export-portable-archive');
    if (!button || auth.currentUser?.uid !== user.uid) return;
    let currentAction = null;
    const click = () => {
        if (button.disabled || auth.currentUser?.uid !== user.uid) return;
        const action = createBackupRestoreAction(user.uid, button);
        currentAction = action;
        button.disabled = true;
        const modal = createElement('div', {className: 'modal-overlay'});
        const password = createElement('input', {
            type: 'password', className: 'glass-field modal-input-glass', autocomplete: 'new-password',
            placeholder: t('portable_password_placeholder'), 'aria-label': t('portable_password_aria')
        });
        const confirmation = createElement('input', {
            type: 'password', className: 'glass-field modal-input-glass', autocomplete: 'new-password',
            placeholder: t('portable_confirm_placeholder'), 'aria-label': t('portable_confirm_aria')
        });
        const includeAttachments = createElement('input', {type: 'checkbox', checked: true, id: 'portable-include-attachments'});
        const acknowledged = createElement('input', {type: 'checkbox', id: 'portable-risk-ack'});
        const cancelButton = createElement('button', {className: 'btn-modal btn-secondary', textContent: t('cancel')});
        const closeButton = createElement('button', {
            type: 'button', className: 'portable-archive-close', 'aria-label': t('cancel'), title: t('cancel')
        }, [createElement('span', {
            className: 'material-symbols-outlined notranslate', translate: 'no', 'aria-hidden': 'true', textContent: 'close'
        })]);
        const startButton = createElement('button', {className: 'btn-modal btn-primary', textContent: t('portable_create'), disabled: true});
        const status = createElement('p', {className: 'portable-archive-status', role: 'alert'});
        const validate = () => {
            const assessment = evaluatePortableArchivePassword(password.value);
            const same = password.value === confirmation.value;
            startButton.disabled = !(assessment.valid && same && acknowledged.checked);
            status.textContent = password.value && !assessment.valid
                ? portablePasswordMessage(assessment)
                : confirmation.value && !same ? t('error_password_mismatch')
                    : assessment.valid ? portablePasswordMessage(assessment) : '';
        };
        password.addEventListener('input', validate);
        confirmation.addEventListener('input', validate);
        acknowledged.addEventListener('change', validate);
        const close = () => { password.value = ''; confirmation.value = ''; modal.remove(); };
        action.own(() => { close(); if (currentAction === action) button.disabled = false; });
        cancelButton.addEventListener('click', () => action.dispose());
        closeButton.addEventListener('click', () => action.dispose());
        const dismissOnEscape = event => {
            if (event.key === 'Escape' && action.active()) action.dispose();
        };
        const dismissOnBackdrop = event => {
            if (event.target === modal && action.active()) action.dispose();
        };
        document.addEventListener('keydown', dismissOnEscape);
        modal.addEventListener('click', dismissOnBackdrop);
        action.own(() => {
            document.removeEventListener('keydown', dismissOnEscape);
            modal.removeEventListener('click', dismissOnBackdrop);
        });
        startButton.addEventListener('click', async () => {
            if (!action.active() || startButton.disabled) return;
            startButton.disabled = true;
            const archivePassword = password.value;
            const createdAt = new Date().toISOString();
            let preparedOutput = null;
            let working = null;
            try {
                const archiveModule = await portableArchiveModulePromise;
                preparedOutput = await archiveModule.preparePortableArchiveOutput(createdAt);
                action.check();
                password.value = ''; confirmation.value = '';
                close();
                working = showBackupWorking(
                    t('portable_working_title'), t('portable_working_desc'), action
                );
                const vaultKeyMaterial = await ensureVaultKeyMaterial({forceReload: !vaultFrameClient.isChild(), promptImmediately: true});
                action.check();
                const result = await archiveModule.exportPortableArchive(user.uid, {
                    password: archivePassword, vaultKeyMaterial, includeAttachments: includeAttachments.checked,
                    signal: action.signal, isActive: action.active, preparedOutput, createdAt
                });
                preparedOutput = null;
                action.check();
                const destination = result.streamed
                    ? tf('dyn_archive_streamed', {package: result.packageName})
                    : t('dyn_archive_downloaded');
                showToast(tf('dyn_archive_created', {records: result.recordCount, attachments: result.attachmentCount, destination}), 'success');
            } catch (error) {
                try { await preparedOutput?.cleanup(); } catch {}
                if (action.active() && error?.name !== 'AbortError') {
                    const capacityCodes = new Set([
                        'PORTABLE_CAPACITY_EXCEEDED', 'PORTABLE_ATTACHMENT_CAPACITY_EXCEEDED'
                    ]);
                    const inventoryCodes = new Set([
                        'PORTABLE_ATTACHMENT_INVENTORY_DUPLICATE', 'PORTABLE_ATTACHMENT_INVENTORY_MISMATCH',
                        'PORTABLE_ATTACHMENT_OWNER_MISSING', 'PORTABLE_ATTACHMENT_METADATA_CONFLICT',
                        'PORTABLE_CHUNK_MANIFEST_INVALID'
                    ]);
                    let message = t('portable_generic_error');
                    if (capacityCodes.has(error?.code)) message = t('portable_capacity_error');
                    else if (inventoryCodes.has(error?.code)) message = t('portable_inventory_error');
                    else if (error?.code === 'PORTABLE_DECRYPT_FAILED') message = t('portable_decrypt_error');
                    else if (error?.code === 'PORTABLE_ATTACHMENT_DECRYPT_FAILED') {
                        message = t('portable_attachment_decrypt_error');
                    } else if (error?.code === 'PORTABLE_STREAMING_REQUIRED') message = t('portable_streaming_error');
                    showToast(message, 'error');
                }
            } finally {
                working?.close();
                action.dispose();
            }
        });
        modal.appendChild(createElement('div', {className: 'modal-box portable-archive-modal'}, [
            closeButton,
            createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue notranslate', textContent: 'folder_zip'}),
            createElement('h3', {className: 'modal-title', textContent: t('portable_title')}),
            createElement('p', {className: 'modal-text', textContent: t('portable_intro')}),
            createElement('p', {className: 'portable-archive-warning', textContent: t('portable_warning')}),
            createElement('p', {className: 'modal-text', textContent: t('portable_large_note')}),
            password, confirmation,
            createElement('label', {className: 'portable-archive-choice'}, [includeAttachments, createElement('span', {textContent: t('portable_include_attachments')})]),
            createElement('label', {className: 'portable-archive-choice'}, [acknowledged, createElement('span', {textContent: t('portable_acknowledge')})]),
            status,
            createElement('div', {className: 'modal-actions'}, [cancelButton, startButton])
        ]));
        document.body.appendChild(modal);
        requestAnimationFrame(() => { if (action.active()) { modal.classList.add('active'); password.focus(); } });
    };
    button.addEventListener('click', click);
    disposePortableArchiveSetup = () => {
        currentAction?.dispose();
        button.removeEventListener('click', click);
        button.disabled = false;
    };
}

async function setupSettingsProfileQr(user) {
    const container = document.getElementById('settings-profile-qrcode');
    if (!container || !currentUserData) return;
    try {
        const [qrModule, qrSettings, widgets] = await Promise.all([
            import('../shared/qr_code_utils-v2.js'),
            getUserSetting(user.uid, 'qrCodeInclusions'),
            listProfileWidgets(user.uid)
        ]);
        const { buildVCard, ensureQRCodeLib, renderQRCode } = qrModule;
        const inclusions = qrSettings || { nome: true, cf: false, nascita: false, phones: [], emails: [], addresses: [] };
        const customFields = widgets.flatMap(widget => Array.isArray(widget.fields) ? widget.fields : []);
        const vcard = buildVCard(currentUserData, inclusions, {
            contactPhones: currentUserData.contactPhones || [],
            contactEmails: currentUserData.contactEmails || [],
            userAddresses: currentUserData.userAddresses || [],
            customFields
        });
        await ensureQRCodeLib();
        renderQRCode(container, vcard, { width: 104, height: 104, colorDark: '#000000', colorLight: '#E3F2FD', correctLevel: 2 });
    } catch (error) {
        console.warn('[IMPOSTAZIONI] Anteprima QR non disponibile.', error);
        setChildren(container, createElement('span', { className: 'material-symbols-outlined settings-qr-fallback notranslate', textContent: 'qr_code_2' }));
    }
}

function setupPerformanceDiagnostics() {
    const toggle = document.getElementById('performance-diagnostics-toggle');
    const panel = document.getElementById('performance-diagnostics-panel');
    const summary = document.getElementById('performance-diagnostics-summary');
    const appSummary = document.getElementById('app-diagnostics-summary');
    if (!toggle || !panel || !summary) return;

    const render = () => {
        const report = getPerformanceDiagnosticReport();
        toggle.checked = report.enabled;
        panel.classList.toggle('hidden', !report.enabled);
        clearElement(summary);
        if (!report.enabled) return;

        const latest = report.samples.slice(-12).reverse();
        const context = createElement('p', {
            className: 'diagnostics-context',
            textContent: tf('dyn_diagnostics_context', {status: report.context.online ? t('dyn_online') : t('dyn_offline'), device: report.context.deviceClass, viewport: report.context.viewport, connection: report.context.connection})
        });
        const list = createElement('div', { className: 'diagnostics-sample-list' });
        if (!latest.length) {
            list.appendChild(createElement('p', { className: 'settings-desc', textContent: t('dyn_diagnostics_none') }));
        } else {
            latest.forEach(sample => {
                const details = [sample.page, `${sample.durationMs} ms`];
                if (Number.isFinite(sample.records)) details.push(`${sample.records} record`);
                if (Number.isFinite(sample.resources)) details.push(`${sample.resources} risorse`);
                if (Number.isFinite(sample.transferKb)) details.push(`${sample.transferKb} KB rete`);
                list.appendChild(createElement('div', { className: 'diagnostics-sample' }, [
                    createElement('strong', { textContent: sample.name }),
                    createElement('span', { textContent: details.filter(Boolean).join(' · ') })
                ]));
            });
        }
        setChildren(summary, context, list);
    };

    toggle.addEventListener('change', () => {
        setPerformanceDiagnosticsEnabled(toggle.checked);
        render();
        showToast(toggle.checked ? t('dyn_diagnostics_local_on') : t('dyn_diagnostics_local_off'), 'success');
    });
    document.getElementById('btn-refresh-performance-diagnostics')?.addEventListener('click', render);
    document.getElementById('btn-run-app-diagnostics')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        if (!appSummary || button.disabled) return;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        setChildren(appSummary, createElement('p', { className: 'settings-desc', textContent: t('dyn_diagnostics_checking') }));
        try {
            const report = await runAppDiagnostics({ authenticated: Boolean(auth.currentUser) });
            const heading = createElement('div', { className: `diagnostics-overall diagnostics-status-${report.overall}` }, [
                createElement('strong', { textContent: report.overall === 'pass' ? t('dyn_diagnostics_pass') : report.overall === 'warn' ? t('dyn_diagnostics_warn') : t('dyn_diagnostics_verify') }),
                createElement('span', { textContent: tf('dyn_version_value', {version: report.appVersion}) })
            ]);
            const checks = createElement('div', { className: 'diagnostics-check-list' });
            report.checks.forEach(check => checks.appendChild(createElement('div', { className: `diagnostics-check diagnostics-status-${check.status}` }, [
                createElement('span', { className: 'material-symbols-outlined notranslate', textContent: check.status === 'pass' ? 'check_circle' : check.status === 'warn' ? 'warning' : 'error' }),
                createElement('div', {}, [createElement('strong', { textContent: check.label }), createElement('small', { textContent: check.detail })])
            ])));
            const enginesTitle = createElement('h4', { className: 'diagnostics-section-title', textContent: t('dyn_diagnostics_engines') });
            const engines = createElement('div', { className: 'diagnostics-engine-list' });
            const labels = { active: t('dyn_state_active'), limited: t('dyn_state_limited'), off: t('dyn_state_off') };
            report.engines.forEach(engine => engines.appendChild(createElement('div', { className: `diagnostics-engine diagnostics-engine-${engine.state}` }, [
                createElement('div', {}, [createElement('strong', { textContent: engine.label }), createElement('small', { textContent: engine.detail })]),
                createElement('span', { className: 'diagnostics-badge', textContent: labels[engine.state] })
            ])));
            const limit = createElement('p', { className: 'diagnostics-limit', textContent: report.limits.join(' ') });
            setChildren(appSummary, heading, checks, enginesTitle, engines, limit);
            appSummary.dataset.report = JSON.stringify(report);
        } catch {
            setChildren(appSummary, createElement('p', { className: 'diagnostics-status-fail', textContent: t('dyn_diagnostics_failed') }));
        } finally {
            button.disabled = false;
            button.removeAttribute('aria-busy');
        }
    });
    document.getElementById('btn-clear-performance-diagnostics')?.addEventListener('click', () => {
        clearPerformanceSamples();
        render();
        showToast(t('dyn_diagnostics_cleared'), 'success');
    });
    document.getElementById('btn-copy-performance-diagnostics')?.addEventListener('click', async () => {
        try {
            const report = { performance: getPerformanceDiagnosticReport() };
            if (appSummary?.dataset.report) report.application = JSON.parse(appSummary.dataset.report);
            await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
            showToast(t('dyn_technical_report_copied'), 'success');
        } catch {
            showToast(t('dyn_copy_unavailable'), 'error');
        }
    });
    window.addEventListener('codex:performance', render);
    render();
}

function setupCompanyAreaToggle(user, data) {
    const toggle = document.getElementById('company-area-toggle');
    if (!toggle) return;
    toggle.checked = getSyncedCompanyAreaPreference(data, user.uid);
    toggle.addEventListener('change', async () => {
        const enabled = toggle.checked;
        toggle.disabled = true;
        cacheCompanyAreaPreference(enabled, user.uid);
        try {
            await updateDoc(doc(db, 'users', user.uid), { settings_show_company_area: enabled });
            if (currentUserData) currentUserData.settings_show_company_area = enabled;
            showToast(enabled ? 'Area Azienda attivata' : 'Area Azienda nascosta. I dati restano salvati.', 'success');
        } catch (error) {
            console.error('[COMPANY AREA] Salvataggio preferenza fallito.', error);
            toggle.checked = !enabled;
            cacheCompanyAreaPreference(!enabled, user.uid);
            showToast(t('dyn_company_preference_failed'), 'error');
        } finally {
            toggle.disabled = false;
        }
    });
}

function showPendingSecurityNotice() {
    const message = sessionStorage.getItem('codex_security_notice');
    if (!message) return;
    sessionStorage.removeItem('codex_security_notice');
    showToast(message, 'info');
}

async function requireSecurityReauthentication(message) {
    beginFrameLogout();
    sessionStorage.setItem('codex_security_notice', message);
    clearSession();
    try {
        window.privateAuthGate?.block();
        await (await import('../../logout-session.js')).logoutWithCleanup(async () => await signOut(auth), null);
    } finally {
        navigateDocument('login.html?reauth=security-settings', true);
    }
}

function setupSecurityToggles(data) {
    const t2fa = document.getElementById('2fa-toggle');
    const tFace = document.getElementById('face-id-toggle');

    if (t2fa) {
        t2fa.checked = !!getTotpEnrollment();
        t2fa.addEventListener('change', async () => {
            const enable = t2fa.checked;
            t2fa.disabled = true;
            try {
                const completed = enable ? await enrollTotp() : await unenrollTotp();
                t2fa.checked = completed ? enable : !enable;
                if (completed) {
                    showToast(enable ? "2FA Authenticator attivata" : "2FA disattivata", "success");
                }
            } catch (error) {
                console.error("TOTP configuration failed", error);
                t2fa.checked = !enable;
                if (error.code === 'auth/requires-recent-login') {
                    await requireSecurityReauthentication('Accesso confermato. Ripeti ora la modifica della 2FA.');
                    return;
                }
                if (error.code === 'auth/user-token-expired') {
                    await requireSecurityReauthentication('La configurazione 2FA è cambiata. Accedi nuovamente per continuare.');
                    return;
                }
                const message = error.code === 'auth/invalid-verification-code'
                    ? 'Codice Authenticator errato o scaduto.'
                    : (error.message || "Configurazione 2FA non riuscita.");
                showToast(message, "error");
            } finally {
                t2fa.disabled = false;
            }
        });
    }

    if (tFace) {
        // La biometria è legata a questo dispositivo: la fonte di verità è la
        // credenziale locale, non una preferenza Firestore potenzialmente obsoleta.
        tFace.checked = isBiometricUnlockConfigured();
        
        // Verifica supporto WebAuthn PRF asincrono
        const prfStatusEl = document.getElementById('prf-support-status');
        import('../core/webauthn-manager.js').then(manager => {
            manager.isWebAuthnSupported().then(supported => {
                if (prfStatusEl) {
                    if (supported) {
                        prfStatusEl.textContent = t('dyn_prf_compatible');
                        prfStatusEl.style.color = "var(--success-color, green)";
                    } else {
                        prfStatusEl.textContent = t('dyn_prf_incompatible');
                        prfStatusEl.style.color = "var(--error-color, red)";
                        tFace.disabled = true;
                    }
                }
            });
        });
        
        tFace.addEventListener('change', async () => {
            const val = tFace.checked;
            try {
                if (val) {
                    const key = await ensureVaultKeyMaterial();
                    // WebAuthn richiede interazione diretta dell'utente. enableBiometricUnlock lancia la registrazione.
                    const { enableBiometricUnlock } = await import('../core/security-manager.js');
                    const success = await enableBiometricUnlock(key);
                    if (!success) {
                        tFace.checked = false; // rollback UI se non supportato o fallito
                    }
                } else {
                    await resetVault();
                }
            } catch (e) {
                tFace.checked = !val;
                const message = e.name === 'NotAllowedError'
                    ? t('dyn_biometric_cancelled')
                    : (e.message === 'PRF_NOT_SUPPORTED'
                        ? t('dyn_biometric_prf_unsupported')
                        : t('dyn_biometric_failed'));
                showToast(message, "error");
            }
        });
    }
}

async function loadUserData(user) {
    try {
        currentUserData = await getUserProfile(user.uid) || {};

        const nameEl = document.getElementById('user-name-settings');
        const avatarEl = document.getElementById('user-avatar-settings');

        // 🔐 PROTOCOLLO BLINDA (V7.0): Decifrazione Profilo Utente
        try {
            const mk = await ensureVaultKeyMaterial();
            const isEnc = v => typeof v === 'string' && (v.startsWith('CPFE2.') ||
                (v.length > 30 && /^[A-Za-z0-9+/]+={0,2}$/.test(v)));

            // 1. Dati Anagrafici
            if (isEnc(currentUserData.nome)) currentUserData.nome = await decrypt(currentUserData.nome, mk);
            if (isEnc(currentUserData.cognome)) currentUserData.cognome = await decrypt(currentUserData.cognome, mk);
            if (isEnc(currentUserData.birth_place)) currentUserData.birth_place = await decrypt(currentUserData.birth_place, mk);
            if (isEnc(currentUserData.cf)) currentUserData.cf = await decrypt(currentUserData.cf, mk);

        } catch (e) {
            console.warn("[IMPOSTAZIONI] Vault Locked o Errore Decriptazione:", e);
        }

        const displayName = (currentUserData.nome || currentUserData.cognome)
            ? `${currentUserData.nome || ''} ${currentUserData.cognome || ''}`.trim()
            : (user.displayName || t('user_default'));

        safeSetText(nameEl, displayName);

        if (avatarEl) {
            const photo = currentUserData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";
            avatarEl.style.backgroundImage = `url('${photo}')`;
        }

        setupThemeSelector();
        setupTimeoutSelector(currentUserData);

        const langLabel = document.getElementById('current-lang-label');
        if (langLabel) {
            const cur = getCurrentLanguage();
            const langMap = {
                'it': 'Italiano', 'en': 'English', 'es': 'Español', 'fr': 'Français',
                'de': 'Deutsch', 'zh': '中文', 'hi': 'हिन्दी', 'pt': 'Português', 'ro': 'Română'
            };
            safeSetText(langLabel, langMap[cur] || 'Italiano');

            document.querySelectorAll('.lang-option').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.code === cur);
            });
        }
        const firstConfigurationStatus = document.getElementById('first-configuration-status');
        if (firstConfigurationStatus) {
            const firstConfiguration = readFirstConfiguration(currentUserData);
            safeSetText(firstConfigurationStatus,
                await configurationText(firstConfiguration.complete
                    ? 'first_config_status_complete'
                    : 'first_config_status_pending'));
            const firstConfigurationSummary = document.getElementById('first-configuration-summary');
            if (firstConfigurationSummary) {
                firstConfigurationSummary.open = !firstConfiguration.complete;
            }
            for (const element of document.querySelectorAll('[data-onboarding-key]')) {
                element.textContent = await configurationText(element.dataset.onboardingKey);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

function initSettingsEvents(user) {
    const navMap = {
        'btn-manage-account': 'profilo_privato.html',
        'btn-change-password': 'imposta_nuova_password.html',
        'btn-expiry-rules': 'regole_scadenze.html'
    };

    for (const [id, url] of Object.entries(navMap)) {
        document.getElementById(id)?.addEventListener('click', () => navigateDocument(url));
    }

    document.getElementById('btn-account-archive')?.addEventListener('click', () => window.location.href = 'archivio_account.html');

    document.getElementById('btn-toggle-lang')?.addEventListener('click', () => {
        const drop = document.getElementById('lang-dropdown');
        const chev = document.getElementById('lang-chevron');
        const isHidden = drop.classList.toggle('hidden');
        if (chev) chev.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    document.getElementById('btn-toggle-app-info')?.addEventListener('click', () => {
        const content = document.getElementById('info-app-content');
        const chev = document.getElementById('info-chevron');
        const isHidden = content.classList.toggle('hidden');
        if (chev) chev.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    document.getElementById('btn-toggle-privacy')?.addEventListener('click', () => {
        const content = document.getElementById('privacy-dropdown-content');
        const chev = document.getElementById('privacy-chevron');
        const isHidden = content.classList.toggle('hidden');
        if (chev) chev.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        if (!isHidden) setupPrivacyShort();
    });

    document.getElementById('btn-toggle-terms')?.addEventListener('click', () => {
        const content = document.getElementById('terms-dropdown-content');
        const chev = document.getElementById('terms-chevron');
        const isHidden = content.classList.toggle('hidden');
        if (chev) chev.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        if (!isHidden) setupTermsShort();
    });

    document.querySelectorAll('.lang-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const code = btn.dataset.code;
            if (code) {
                btn.disabled = true;
                try {
                    await updateDoc(doc(db, 'users', user.uid), firstConfigurationPatch(code));
                    setLanguagePreference(code, { explicit: true, uid: user.uid });
                    window.location.reload();
                } catch (error) {
                    btn.disabled = false;
                    console.error('[SETTINGS] Salvataggio lingua non riuscito.', error);
                    showToast(t('dyn_language_save_failed'), 'error');
                }
            }
        });
    });


    document.getElementById('logout-btn-settings')?.addEventListener('click', async () => {
        const ok = await showConfirmModal(t('section_security') || 'Sicurezza', "Vuoi davvero uscire dall'account?", "Esci", "Annulla");
        if (ok) {
            beginFrameLogout();
            clearSession(); // 🔐 Pulisce vaultKeyMaterial e sessionStorage
            window.privateAuthGate?.block();
        await (await import('../../logout-session.js')).logoutWithCleanup(async () => await signOut(auth), null);
            navigateDocument('login.html');
        }
    });

    document.getElementById('btn-reset-vault')?.addEventListener('click', async () => {
        const ok = await showConfirmModal(
            'Rimuovi accesso biometrico',
            'Questa operazione non cancella i dati. Dovrai inserire la Master Password al prossimo accesso. Continuare?',
            'Rimuovi', 'Annulla'
        );
        if (ok) await resetVault();
    });

    document.getElementById('btn-change-master-password')?.addEventListener('click', async () => {
        try {
            await changeMasterPassword();
            const faceToggle = document.getElementById('face-id-toggle');
            if (faceToggle) faceToggle.checked = false;
        } catch (error) {
            showToast(error.message || 'Cambio Master Password non riuscito.', 'error');
        }
    });

    document.getElementById('btn-revoke-all-sessions')?.addEventListener('click', async () => {
        const ok = await showConfirmModal('Disconnetti tutte le postazioni', 'Dovrai eseguire nuovamente login e 2FA su ogni dispositivo. Continuare?', 'Disconnetti', 'Annulla');
        if (!ok) return;
        try {
            beginFrameLogout();
            await revokeAllSessions();
            clearSession();
            window.privateAuthGate?.block();
        await (await import('../../logout-session.js')).logoutWithCleanup(async () => await signOut(auth), null);
            navigateDocument('login.html?reauth=sessions-revoked', true);
        } catch (error) {
            showToast(error.message || 'Revoca delle sessioni non riuscita.', 'error');
        }
    });
}


function setupThemeSelector() {
    const cur = localStorage.getItem('theme') || 'auto';
    document.querySelectorAll('.theme-btn').forEach(btn => {
        if (btn.dataset.theme === cur) btn.classList.add('active');
        btn.addEventListener('click', () => {
            localStorage.setItem('theme', btn.dataset.theme);
            window.location.reload();
        });
    });
    const savedColorTheme = localStorage.getItem('color_theme');
    const colorTheme = ['blue', 'green', 'red', 'sand', 'petrol', 'lavender', 'dusty-rose'].includes(savedColorTheme) ? savedColorTheme : 'blue';
    document.querySelectorAll('.color-theme-btn').forEach(btn => {
        const isCurrent = btn.dataset.colorTheme === colorTheme;
        btn.classList.toggle('active', isCurrent);
        btn.setAttribute('aria-pressed', String(isCurrent));
        btn.addEventListener('click', () => {
            const selected = btn.dataset.colorTheme;
            if (!['blue', 'green', 'red', 'sand', 'petrol', 'lavender', 'dusty-rose'].includes(selected)) return;
            localStorage.setItem('color_theme', selected);
            document.documentElement.dataset.colorTheme = selected;
            document.querySelectorAll('.color-theme-btn').forEach(item => {
                const isActive = item === btn;
                item.classList.toggle('active', isActive);
                item.setAttribute('aria-pressed', String(isActive));
            });
        });
    });
}

function setupTimeoutSelector(data) {
    const cur = data.lock_timeout ?? 3;
    const selector = document.getElementById('lock-timer-selector');
    if (!selector) return;

    // Tutte le opzioni visibili tranne 'Subito' (0) rimosso definitivamente
    const btns = selector.querySelectorAll('.timer-btn');
    btns.forEach(btn => {
        const val = parseInt(btn.dataset.val);
        // 'Subito' (0) rimosso: troppo aggressivo, deprecato da V8.0
        if (val === 0) {
            btn.style.display = 'none';
        }

        if (val === cur) btn.classList.add('active');

        btn.addEventListener('click', async () => {
            document.querySelectorAll('#lock-timer-selector .timer-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            try {
                await updateDoc(doc(db, "users", auth.currentUser.uid), { lock_timeout: val });
                await syncTimeoutWithFirestore(auth.currentUser.uid);
                showToast(t('dyn_inactivity_updated'), "success");
            } catch (e) {
                console.error(e);
            }
        });
    });
}

function setupAppInfo() {
    const p = document.getElementById('info-app-text-placeholder');
    if (!p) return;
    setChildren(p, createElement('div', { className: 'info-stack' }, [
        createElement('p', {}, [createElement('strong', {textContent: 'Codex Security System'})]),
        createElement('p', { textContent: t('app_info_security_desc') }),
        createElement('div', {
            className: 'app-version-info',
            textContent: `${t('settings_app_version_label')} ${APP_VERSION}`
        })
    ]));
}

function setupPrivacyShort() {
    const p = document.getElementById('privacy-short-text-placeholder');
    if (!p) return;
    setChildren(p, createElement('div', {
        className: 'info-stack',
        textContent: t('settings_privacy_summary')
    }));
}

function setupTermsShort() {
    const p = document.getElementById('terms-short-text-placeholder');
    if (!p) return;
    setChildren(p, createElement('div', {
        className: 'info-stack',
        textContent: t('settings_terms_summary')
    }));
}
