/**
 * IMPOSTAZIONI MODULE (V4.6)
 * Gestisce le impostazioni dell'utente, lingua, tema e vincoli di sicurezza.
 */

import { auth, db } from '../../firebase-config.js?v=1.2.107';
import { signOut } from "/assets/js/vendor/firebase-runtime.js";
import { doc, updateDoc } from "/assets/js/vendor/firebase-runtime.js";
import { t, getCurrentLanguage } from '../../translations.js';
import { syncTimeoutWithFirestore } from '../../inactivity-timer.js';
import { showToast, showConfirmModal, showInputModal } from '../../ui-core-v129.js';
import { safeSetText, setChildren, createElement, clearElement } from '../../dom-utils.js';
import { decrypt, ensureVaultKeyMaterial, clearSession, resetVault, isBiometricUnlockConfigured, changeMasterPassword } from '../core/security-manager.js';
import { enrollTotp, unenrollTotp, getTotpEnrollment, createRecoveryCodes, revokeAllSessions } from '../core/mfa-manager.js';
import { cacheCompanyAreaPreference, getSyncedCompanyAreaPreference } from '../shared/company-area-preference.js';
import { clearPerformanceSamples, getPerformanceDiagnosticReport, isPerformanceDiagnosticsEnabled, setPerformanceDiagnosticsEnabled } from '../../performance-metrics.js';
import { getUserProfile, getUserSetting, listProfileWidgets } from '../data/vault-repository.js';
import { setupPushSettings } from './push-settings-controller.js?push=20260908b';

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
    initSettingsEvents();
    setupSecurityToggles(currentUserData);
    setupAIAssistantToggle(user, currentUserData);
    setupCompanyAreaToggle(user, currentUserData);
    setupAppInfo();
    setupPrivacyShort();
    setupTermsShort();
    setupPerformanceDiagnostics();
    setupEncryptedBackup(user);
    setupEncryptedRestore(user);
    setupCredentialHealth(user);
    setupAccountFieldUsage(user);
    setupSharedCredentials(user);
    await setupPushSettings(user);
    showPendingSecurityNotice();

    
}

function setupSharedCredentials(user) {
    document.getElementById('btn-shared-credentials')?.addEventListener('click', async () => {
        try {
            const {openSharedCredentialsSettings} = await import('./shared-credentials-controller.js?v=1.2.107');
            await openSharedCredentialsSettings(user);
        } catch (error) {
            console.error('[SHARED CREDENTIALS] Apertura fallita.', error);
            showToast(error.message || 'Impossibile aprire le Credenziali comuni.', 'error');
        }
    });
}

function showCredentialHealthResults(report) {
    const flagLabels = {weak: 'Debole', duplicate: 'Duplicata', dated: 'Datata'};
    const strengthLabels = {weak: 'Debole', medium: 'Media', strong: 'Forte'};
    const modal = createElement('div', {
        className: 'modal-overlay', role: 'dialog', 'aria-modal': 'true',
        'aria-labelledby': 'credential-health-title'
    });
    const closeButton = createElement('button', {className: 'btn-modal btn-primary', textContent: 'Chiudi'});
    const previouslyFocused = document.activeElement;
    const close = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            previouslyFocused?.focus?.();
        }, 300);
    };
    closeButton.addEventListener('click', close);
    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
    });
    const list = createElement('div', {className: 'credential-health-list'});
    if (!report.results.length) {
        list.appendChild(createElement('p', {
            className: 'credential-health-empty',
            textContent: 'Nessuna password debole, duplicata o datata rilevata.'
        }));
    } else {
        report.results.forEach(item => {
            const context = item.area === 'azienda'
                ? `Azienda${item.companyName ? ` · ${item.companyName}` : ''}`
                : 'Privato';
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
        ? ` · ${report.unavailable} non leggibili`
        : '';
    modal.appendChild(createElement('div', {className: 'modal-box credential-health-modal'}, [
        createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue', textContent: 'health_and_safety'}),
        createElement('h3', {id: 'credential-health-title', className: 'modal-title', textContent: 'Salute credenziali'}),
        createElement('p', {
            className: 'modal-text',
            textContent: `${report.scanned} password controllate · ${report.atRisk} Account da verificare${unavailable}. Analisi eseguita soltanto in memoria.`
        }),
        list,
        createElement('p', {
            className: 'credential-health-privacy',
            textContent: 'Il controllo delle violazioni online non è attivo. Nessuna password o impronta viene salvata.'
        }),
        createElement('div', {className: 'modal-actions'}, [closeButton])
    ]));
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.classList.add('active');
        closeButton.focus();
    }, 10);
}

function setupCredentialHealth(user) {
    const button = document.getElementById('btn-credential-health');
    if (!button) return;
    button.addEventListener('click', async () => {
        button.disabled = true;
        const working = showBackupWorking(
            'Salute credenziali',
            'Analisi locale delle credenziali in corso…'
        );
        try {
            const {inspectOwnerCredentialHealth} = await import('./credential-health-service.js?v=1.2.107');
            const report = await inspectOwnerCredentialHealth(user.uid);
            working.close();
            showCredentialHealthResults(report);
        } catch (error) {
            working.close();
            if (error?.message !== 'USER_CANCELLED') {
                console.warn('[CREDENTIAL HEALTH] Analisi non disponibile.', error?.message);
                showToast('Controllo non completato. Nessun dato è stato salvato.', 'error');
            }
        } finally {
            button.disabled = false;
        }
    });
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
                ? createElement('small', {textContent: `${row.unavailable} valori non leggibili`})
                : null
        ])
    ])));
    return createElement('section', {className: 'account-field-usage-section'}, [
        createElement('h4', {textContent: title}),
        createElement('div', {className: 'account-field-usage-scroll'}, [
            createElement('table', {className: 'account-field-usage-table'}, [
                createElement('thead', {}, [createElement('tr', {}, [
                    createElement('th', {scope: 'col', textContent: 'Campo'}),
                    createElement('th', {scope: 'col', textContent: 'Priv.'}),
                    createElement('th', {scope: 'col', textContent: 'Az.'}),
                    createElement('th', {scope: 'col', textContent: 'Usati'}),
                    createElement('th', {scope: 'col', textContent: '%'}),
                    createElement('th', {scope: 'col', textContent: 'Valutazione'})
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
    const closeButton = createElement('button', {className: 'btn-modal btn-secondary', textContent: 'Chiudi'});
    const copyButton = createElement('button', {className: 'btn-modal btn-primary', textContent: 'Copia report'});
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
            showToast('Report aggregato copiato. Non contiene valori degli Account.', 'success');
        } catch {
            showToast('Copia non disponibile su questo dispositivo.', 'error');
        }
    });
    modal.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    const summary = report.totals;
    const content = [
        createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue', textContent: 'table_view'}),
        createElement('h3', {id: 'account-field-usage-title', className: 'modal-title', textContent: 'Utilizzo campi Account'}),
        createElement('p', {
            className: 'modal-text',
            textContent: `${summary.accounts} Account analizzati: ${summary.privateAccounts} privati e ${summary.companyAccounts} aziendali. ${summary.archivedExcluded} archiviati esclusi.`
        }),
        createElement('p', {
            className: 'account-field-usage-privacy',
            textContent: 'I valori sono stati decifrati soltanto in memoria. Il report contiene esclusivamente conteggi.'
        }),
        usageTable('Campi standard', report.fields)
    ];
    if (report.widgets.length) content.push(usageTable('Campi dei widget', report.widgets));
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
            const {inspectAccountFieldUsage} = await import('./account-field-usage-service.js?v=1.2.107');
            const report = await inspectAccountFieldUsage(user.uid);
            working.close();
            showAccountFieldUsage(report);
        } catch (error) {
            working.close();
            if (error?.message !== 'USER_CANCELLED') {
                console.warn('[ACCOUNT FIELD USAGE] Analisi non disponibile.', error?.message);
                showToast('Analisi non completata. Nessun dato è stato salvato.', 'error');
            }
        } finally {
            button.disabled = false;
        }
    });
}

function setupEncryptedRestore(user) {
    const button = document.getElementById('btn-restore-encrypted-backup');
    if (!button) return;
    const input = createElement('input', {
        type: 'file', accept: '.cpbackup,application/x-codici-password-backup', className: 'hidden'
    });
    document.body.appendChild(input);
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        const recoveryKey = await showInputModal(
            'Recovery Key del backup', '', 'xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx',
            'La chiave viene usata soltanto in memoria per verificare e aprire questo file.',
            {vaultSecret: true}
        );
        if (!recoveryKey) return;
        button.disabled = true;
        let working = showBackupWorking('Verifica completa del backup…', 'Il file viene aperto e controllato voce per voce. Non chiudere la pagina.');
        try {
            const {prepareBackupRestore, executeBackupRestore} = await import('./backup-import-service.js');
            const plan = await prepareBackupRestore(file, user.uid, recoveryKey.trim().toLowerCase());
            working.close();
            working = null;
            if (plan.collisionCount) {
                const selectedIndexes = await showBackupRestorePreview(plan);
                if (!selectedIndexes.length) return;
                const selectedEntries = plan.comparison.entries.filter(entry => selectedIndexes.includes(entry.index));
                const changedCount = selectedEntries.filter(entry => entry.status === 'changed').length;
                const typed = await showInputModal(
                    'Conferma ripristino selettivo', '', 'RIPRISTINA',
                    `${selectedIndexes.length} elementi selezionati${changedCount ? `, di cui ${changedCount} sostituiranno la versione attuale` : ''}. Scrivi RIPRISTINA per continuare.`
                );
                if (typed !== 'RIPRISTINA') return;
                working = showBackupWorking('Ripristino selettivo in corso…', 'Sto recuperando gli elementi scelti. Non chiudere la pagina.');
                const result = await executeBackupRestore(plan, selectedIndexes);
                working.close();
                working = null;
                reloadAfterBackupRestore(result);
                return;
            }
            const typed = await showInputModal(
                'Conferma ripristino', '', 'RIPRISTINA',
                `File integro: ${plan.counts.records} record e ${plan.counts.attachments} allegati. Nessuna collisione rilevata. Scrivi RIPRISTINA per applicare i dati.`
            );
            if (typed !== 'RIPRISTINA') return;
            working = showBackupWorking('Ripristino in corso…', 'Sto recuperando record e allegati. Non chiudere la pagina.');
            const result = await executeBackupRestore(plan);
            working.close();
            working = null;
            reloadAfterBackupRestore(result);
        } catch (error) {
            console.error('[BACKUP] Ripristino non riuscito.', error?.message);
            const collision = String(error?.message || '').startsWith('BACKUP_COLLISIONS:');
            showToast(collision
                ? 'Ripristino bloccato: nel Vault esistono già record con gli stessi identificativi.'
                : 'Backup non valido, incompleto o non applicabile.', 'error');
        } finally {
            working?.close();
            button.disabled = false;
        }
    });
}

function reloadAfterBackupRestore(result) {
    showToast(
        `Ripristino completato: ${result.recordCount} elementi e ${result.attachmentCount} allegati. Aggiornamento dati…`,
        'success'
    );
    setTimeout(() => window.location.reload(), 900);
}

function showBackupWorking(title, message) {
    const modal = createElement('div', {
        className: 'modal-overlay backup-working-overlay', role: 'alertdialog',
        'aria-modal': 'true', 'aria-live': 'polite', 'aria-busy': 'true'
    });
    modal.appendChild(createElement('div', {className: 'modal-box backup-working-modal'}, [
        createElement('span', {
            className: 'material-symbols-outlined modal-icon animate-spin icon-accent-blue',
            textContent: 'progress_activity', 'aria-hidden': 'true'
        }),
        createElement('h3', {className: 'modal-title', textContent: title}),
        createElement('p', {className: 'modal-text', textContent: message})
    ]));
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
    let closed = false;
    return {
        close() {
            if (closed) return;
            closed = true;
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    };
}

function showBackupRestorePreview(plan) {
    return new Promise(resolve => {
        const modal = createElement('div', {className: 'modal-overlay'});
        const closeButton = createElement('button', {
            className: 'btn-modal btn-secondary', textContent: 'Chiudi anteprima'
        });
        const restoreButton = createElement('button', {
            className: 'btn-modal btn-primary', textContent: 'Ripristina selezionati'
        });
        const summaryToggle = createElement('button', {
            type: 'button', className: 'backup-preview-toggle',
            'aria-expanded': 'true', 'aria-label': 'Riduci riepilogo anteprima'
        }, [
            createElement('span', {textContent: 'Riduci riepilogo'}),
            createElement('span', {
                className: 'material-symbols-outlined', textContent: 'expand_less', 'aria-hidden': 'true'
            })
        ]);
        const labels = {missing: 'Mancante', unchanged: 'Invariato', changed: 'Modificato'};
        const scopeLabels = {
            profile: 'Profilo', settings: 'Impostazione', 'private-account': 'Account privato',
            company: 'Azienda', 'company-account': 'Account aziendale', deadline: 'Scadenza',
            contact: 'Contatto', 'profile-widget': 'Widget',
            'private-account-attachment': 'Allegato privato', 'company-account-attachment': 'Allegato aziendale'
        };
        const scopeCounts = new Map();
        plan.comparison.entries.forEach(entry => {
            scopeCounts.set(entry.scope, (scopeCounts.get(entry.scope) || 0) + 1);
        });
        const summary = createElement('div', {className: 'backup-preview-summary'}, [...scopeCounts].map(([scope, count]) =>
            createElement('span', {
                className: 'backup-preview-summary-item',
                textContent: `${scopeLabels[scope] || scope}: ${count}`
            })
        ));
        const selectable = [];
        const rows = plan.comparison.entries.map(entry => {
            const checkbox = createElement('input', {
                type: 'checkbox', checked: entry.status === 'missing', disabled: entry.status === 'unchanged',
                'aria-label': `Seleziona ${entry.description}`
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
            modal.classList.remove('active');
            setTimeout(() => { modal.remove(); resolve(result); }, 300);
        };
        const updateRestoreButton = () => {
            const count = selectable.filter(item => item.checkbox.checked).length;
            restoreButton.disabled = count === 0;
            restoreButton.textContent = count ? `Ripristina selezionati (${count})` : 'Ripristina selezionati';
        };
        selectable.forEach(item => item.checkbox.addEventListener('change', updateRestoreButton));
        closeButton.addEventListener('click', () => close([]));
        restoreButton.addEventListener('click', () => close(selectable
            .filter(item => item.checkbox.checked)
            .map(item => item.entry.index)));
        updateRestoreButton();
        const summaryContent = createElement('div', {className: 'backup-preview-summary-content'}, [
            createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue', textContent: 'preview'}),
            createElement('h3', {className: 'modal-title', textContent: 'Anteprima Vault di ripristino'}),
            createElement('p', {
                className: 'modal-text',
                textContent: `Il backup è integro. Mancanti: ${plan.comparison.counts.missing}; modificati: ${plan.comparison.counts.changed}; invariati: ${plan.comparison.counts.unchanged}. Seleziona cosa recuperare: i mancanti sono già selezionati, i modificati no.`
            }),
            summary
        ]);
        summaryToggle.addEventListener('click', () => {
            const expanded = summaryToggle.getAttribute('aria-expanded') === 'true';
            summaryToggle.setAttribute('aria-expanded', String(!expanded));
            summaryToggle.setAttribute('aria-label', expanded ? 'Mostra riepilogo anteprima' : 'Riduci riepilogo anteprima');
            summaryContent.hidden = expanded;
            summaryToggle.firstElementChild.textContent = expanded ? 'Mostra riepilogo' : 'Riduci riepilogo';
            summaryToggle.lastElementChild.textContent = expanded ? 'expand_more' : 'expand_less';
        });
        modal.appendChild(createElement('div', {className: 'modal-box backup-preview-modal'}, [
            summaryToggle,
            summaryContent,
            createElement('ul', {className: 'backup-preview-list'}, rows),
            createElement('div', {className: 'modal-actions'}, [closeButton, restoreButton])
        ]));
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
    });
}

function showRecoveryKeyOnce(recoveryKey, summary) {
    return new Promise(resolve => {
        const modal = createElement('div', {className: 'modal-overlay'});
        const keyField = createElement('input', {
            className: 'glass-field modal-input-glass backup-recovery-key-field', value: recoveryKey, readOnly: true,
            'aria-label': 'Recovery Key del backup', autocomplete: 'off', spellcheck: false
        });
        const acknowledged = createElement('input', {type: 'checkbox', id: 'backup-key-saved'});
        const closeButton = createElement('button', {
            className: 'btn-modal btn-primary', textContent: 'Ho salvato la chiave', disabled: true
        });
        const copyButton = createElement('button', {className: 'btn-modal btn-secondary', textContent: 'Copia chiave'});
        acknowledged.addEventListener('change', () => { closeButton.disabled = !acknowledged.checked; });
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(recoveryKey);
                showToast('Recovery Key copiata', 'success');
            } catch {
                keyField.focus(); keyField.select();
                showToast('Seleziona e copia manualmente la Recovery Key', 'info');
            }
        });
        closeButton.addEventListener('click', () => {
            if (!acknowledged.checked) return;
            modal.classList.remove('active');
            setTimeout(() => { modal.remove(); resolve(); }, 300);
        });
        const confirmation = createElement('label', {className: 'backup-key-confirmation'}, [
            acknowledged,
            createElement('span', {textContent: 'Confermo di aver salvato la Recovery Key in un luogo sicuro.'})
        ]);
        modal.appendChild(createElement('div', {className: 'modal-box'}, [
            createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue', textContent: 'key'}),
            createElement('h3', {className: 'modal-title', textContent: 'Recovery Key — unica visualizzazione'}),
            createElement('p', {
                className: 'modal-text',
                textContent: `Backup completato: ${summary.recordCount} record e ${summary.attachmentCount} allegati. Senza questa chiave il file non è recuperabile.`
            }),
            keyField,
            confirmation,
            createElement('div', {className: 'modal-actions'}, [copyButton, closeButton])
        ]));
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
    });
}

function setupEncryptedBackup(user) {
    const button = document.getElementById('btn-export-encrypted-backup');
    if (!button) return;
    button.addEventListener('click', () => {
        const modal = createElement('div', {className: 'modal-overlay'});
        const cancelButton = createElement('button', {className: 'btn-modal btn-secondary', textContent: 'Annulla'});
        const startButton = createElement('button', {className: 'btn-modal btn-primary', textContent: 'Preparazione…', disabled: true});
        const modulePromise = import('./backup-export-service.js');
        modulePromise.then(() => {
            startButton.disabled = false;
            startButton.textContent = 'Scegli file e crea backup';
        }).catch(() => {
            startButton.textContent = 'Backup non disponibile';
        });
        const close = () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); };
        cancelButton.addEventListener('click', close);
        startButton.addEventListener('click', async () => {
            startButton.disabled = true;
            try {
                const {exportOwnerBackup} = await modulePromise;
                const exportPromise = exportOwnerBackup(user.uid);
                close();
                button.disabled = true;
                showToast('Preparazione backup in corso…', 'info');
                const result = await exportPromise;
                await showRecoveryKeyOnce(result.recoveryKey, result);
            } catch (error) {
                if (error?.name !== 'AbortError') {
                    console.error('[BACKUP] Esportazione non riuscita.', error?.message);
                    showToast('Backup non completato. Nessun dato è stato modificato.', 'error');
                }
            } finally {
                button.disabled = false;
            }
        });
        modal.appendChild(createElement('div', {className: 'modal-box'}, [
            createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue', textContent: 'encrypted'}),
            createElement('h3', {className: 'modal-title', textContent: 'Crea backup cifrato'}),
            createElement('p', {
                className: 'modal-text',
                textContent: 'Verranno esportati Profilo, impostazioni, Account, Aziende, Scadenze, contatti, widget e allegati. La Recovery Key sarà mostrata una sola volta.'
            }),
            createElement('div', {className: 'modal-actions'}, [cancelButton, startButton])
        ]));
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
    });
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
        setChildren(container, createElement('span', { className: 'material-symbols-outlined settings-qr-fallback', textContent: 'qr_code_2' }));
    }
}

function setupPerformanceDiagnostics() {
    const toggle = document.getElementById('performance-diagnostics-toggle');
    const panel = document.getElementById('performance-diagnostics-panel');
    const summary = document.getElementById('performance-diagnostics-summary');
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
            textContent: `${report.context.online ? 'Online' : 'Offline'} · ${report.context.deviceClass} · schermo ${report.context.viewport} · rete ${report.context.connection}`
        });
        const list = createElement('div', { className: 'diagnostics-sample-list' });
        if (!latest.length) {
            list.appendChild(createElement('p', { className: 'settings-desc', textContent: 'Nessuna misura registrata. Naviga nell’app e torna qui.' }));
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
        showToast(toggle.checked ? 'Diagnostica locale attivata' : 'Diagnostica disattivata e misure cancellate', 'success');
    });
    document.getElementById('btn-refresh-performance-diagnostics')?.addEventListener('click', render);
    document.getElementById('btn-clear-performance-diagnostics')?.addEventListener('click', () => {
        clearPerformanceSamples();
        render();
        showToast('Misure diagnostiche cancellate', 'success');
    });
    document.getElementById('btn-copy-performance-diagnostics')?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(getPerformanceDiagnosticReport(), null, 2));
            showToast('Report tecnico copiato', 'success');
        } catch {
            showToast('Copia non disponibile su questo dispositivo', 'error');
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
            showToast('Impossibile salvare la preferenza Azienda', 'error');
        } finally {
            toggle.disabled = false;
        }
    });
}

function setupAIAssistantToggle(user, data) {
    const toggle = document.getElementById('ai-assistant-toggle');
    if (!toggle) return;
    toggle.checked = data?.settings_ai_assistant === true;
    toggle.addEventListener('change', async () => {
        const enabled = toggle.checked;
        toggle.disabled = true;
        try {
            await updateDoc(doc(db, 'users', user.uid), { settings_ai_assistant: enabled });
            if (currentUserData) currentUserData.settings_ai_assistant = enabled;
            const trigger = document.getElementById('ai-assistant-status');
            if (enabled) {
                const { initVaultAssistant } = await import('../assistant/assistant-controller.js?v=1.2.107');
                await initVaultAssistant(user, {
                    includeCompanies: getSyncedCompanyAreaPreference(currentUserData || {}, user.uid)
                });
                trigger?.classList.remove('hidden');
            } else {
                trigger?.classList.add('hidden');
            }
            showToast(enabled ? 'Agente AI attivato' : 'Agente AI disattivato', 'success');
        } catch (error) {
            console.error('[ASSISTANT] Salvataggio preferenza fallito.', error);
            toggle.checked = !enabled;
            showToast('Impossibile salvare la preferenza Agente AI', 'error');
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
    sessionStorage.setItem('codex_security_notice', message);
    clearSession();
    try {
        await signOut(auth);
    } finally {
        window.location.replace('login-v115.html?reauth=security-settings');
    }
}

function setupSecurityToggles(data) {
    const t2fa = document.getElementById('2fa-toggle');
    const tFace = document.getElementById('face-id-toggle');

    if (t2fa) {
        t2fa.checked = !!getTotpEnrollment();
        document.getElementById('btn-regenerate-recovery-codes')?.classList.toggle('hidden', !t2fa.checked);
        t2fa.addEventListener('change', async () => {
            const enable = t2fa.checked;
            t2fa.disabled = true;
            try {
                const completed = enable ? await enrollTotp() : await unenrollTotp();
                t2fa.checked = completed ? enable : !enable;
                if (completed) {
                    document.getElementById('btn-regenerate-recovery-codes')?.classList.toggle('hidden', !enable);
                    if (enable) await generateAndShowRecoveryCodes();
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
                        prfStatusEl.textContent = "Dispositivo compatibile (WebAuthn PRF)";
                        prfStatusEl.style.color = "var(--success-color, green)";
                    } else {
                        prfStatusEl.textContent = "Non compatibile (WebAuthn non supportato)";
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
                    ? 'Verifica biometrica annullata o non autorizzata.'
                    : (e.message === 'PRF_NOT_SUPPORTED'
                        ? 'Questo dispositivo non supporta lo sblocco Vault tramite WebAuthn PRF.'
                        : "Operazione biometrica non riuscita. Puoi usare la Master Password.");
                showToast(message, "error");
            }
        });
    }
}

async function generateAndShowRecoveryCodes() {
    const codes = await createRecoveryCodes();
    const modal = createElement('div', { className: 'modal-overlay active' });
    const list = createElement('div', { className: 'recovery-code-grid' },
        codes.map(code => createElement('code', { textContent: code }))
    );
    const close = () => modal.remove();
    setChildren(modal, createElement('div', { className: 'modal-box' }, [
        createElement('h3', { className: 'modal-title', textContent: 'Codici di recupero 2FA' }),
        createElement('p', { className: 'modal-text', textContent: 'Salvali ora in un luogo sicuro. Ogni codice funziona una sola volta e non sarà più mostrato.' }),
        list,
        createElement('div', { className: 'modal-actions' }, [
            createElement('button', { className: 'btn-modal btn-primary', textContent: 'Li ho salvati', onclick: close })
        ])
    ]));
    document.body.appendChild(modal);
}



async function loadUserData(user) {
    try {
        currentUserData = await getUserProfile(user.uid) || {};

        const nameEl = document.getElementById('user-name-settings');
        const avatarEl = document.getElementById('user-avatar-settings');

        // 🔐 PROTOCOLLO BLINDA (V7.0): Decifrazione Profilo Utente
        try {
            const mk = await ensureVaultKeyMaterial();
            const isEnc = (v) => v && typeof v === 'string' && v.length > 30 && /^[A-Za-z0-9+/]+={0,2}$/.test(v);

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
    } catch (e) {
        console.error(e);
    }
}

function initSettingsEvents() {
    const navMap = {
        'btn-manage-account': 'profilo_privato.html',
        'btn-change-password': 'imposta_nuova_password.html',
        'btn-expiry-rules': 'regole_scadenze.html'
    };

    for (const [id, url] of Object.entries(navMap)) {
        document.getElementById(id)?.addEventListener('click', () => window.location.href = url);
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
        btn.addEventListener('click', () => {
            const code = btn.dataset.code;
            if (code) {
                localStorage.setItem('app_language', code);
                window.location.reload();
            }
        });
    });


    document.getElementById('logout-btn-settings')?.addEventListener('click', async () => {
        const ok = await showConfirmModal(t('section_security') || 'Sicurezza', "Vuoi davvero uscire dall'account?", "Esci", "Annulla");
        if (ok) {
            clearSession(); // 🔐 Pulisce vaultKeyMaterial e sessionStorage
            await signOut(auth);
            window.location.href = 'login-v115.html';
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

    document.getElementById('btn-regenerate-recovery-codes')?.addEventListener('click', async () => {
        const ok = await showConfirmModal('Nuovi codici di recupero', 'I codici precedenti smetteranno subito di funzionare. Continuare?', 'Genera', 'Annulla');
        if (!ok) return;
        try { await generateAndShowRecoveryCodes(); }
        catch (error) { showToast(error.message || 'Generazione codici non riuscita.', 'error'); }
    });

    document.getElementById('btn-revoke-all-sessions')?.addEventListener('click', async () => {
        const ok = await showConfirmModal('Disconnetti tutte le postazioni', 'Dovrai eseguire nuovamente login e 2FA su ogni dispositivo. Continuare?', 'Disconnetti', 'Annulla');
        if (!ok) return;
        try {
            await revokeAllSessions();
            clearSession();
            await signOut(auth);
            window.location.replace('login-v115.html?reauth=sessions-revoked');
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
                showToast("Sicurezza inattività aggiornata", "success");
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
        createElement('p', {}, [createElement('strong', {}, ["Codex"]), " Security System"]),
        createElement('p', { textContent: t('app_info_security_desc') }),
        createElement('div', { className: 'app-version-info', textContent: "RESET NOTIFICHE COMPLETATO" })
    ]));
}

function setupPrivacyShort() {
    const p = document.getElementById('privacy-short-text-placeholder');
    if (!p) return;
    setChildren(p, createElement('div', { className: 'info-stack', textContent: "Privacy Policy invariata. Notifiche Push e Email sospese." }));
}

function setupTermsShort() {
    const p = document.getElementById('terms-short-text-placeholder');
    if (!p) return;
    setChildren(p, createElement('div', { className: 'info-stack', textContent: "Termini e Condizioni invariati." }));
}
