import { SwipeList } from '../../swipe-list-v6.js';
import { clearElement, createElement, setChildren } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { accountModeFromRecord } from './account-mode-model.js';
import { createCardSecretResolver } from './card-secret.js';

function createDataRow(label, displayValue, copyValue = null, isPassword = false, encrypted = false, signal, resolveSecret) {
    const rowId = crypto.randomUUID();
    const resolve = resolveSecret || createCardSecretResolver(copyValue, encrypted && isPassword);
    const resolveCopyValue = async () => {
        if (signal.aborted) throw new Error('VIEW_DISPOSED');
        const value = await resolve();
        if (signal.aborted) throw new Error('VIEW_DISPOSED');
        return value;
    };
    return createElement('div', { className: 'account-data-row' }, [
        createElement('span', { className: 'account-data-label', textContent: `${label}:` }),
        createElement('span', {
            className: 'account-data-value',
            id: isPassword ? `pass-val-${rowId}` : undefined,
            textContent: displayValue
        }),
        createElement('div', { className: 'account-card-right' }, [
            isPassword ? createElement('button', {
                className: 'btn-mini-action',
                onclick: async event => {
                    event.stopPropagation();
                    try {
                        const value = document.getElementById(`pass-val-${rowId}`);
                        const icon = event.currentTarget.querySelector('span');
                        if (!value || !icon) return;
                        if (value.textContent === '••••••••') {
                            const revealed = await resolveCopyValue();
                            if (signal.aborted) return;
                            value.textContent = revealed;
                            icon.textContent = 'visibility_off';
                        } else {
                            value.textContent = '••••••••';
                            icon.textContent = 'visibility';
                        }
                    } catch (error) {
                        if (signal.aborted) return;
                        logError('RevealCardPassword', error);
                        showToast(t('error_generic'), 'error');
                    }
                }
            }, [createElement('span', {
                className: 'material-symbols-outlined account-action-icon',
                textContent: 'visibility'
            })]) : null,
            createElement('button', {
                className: 'btn-mini-action',
                onclick: async event => {
                    event.stopPropagation();
                    try {
                        if (signal.aborted) throw new Error('VIEW_DISPOSED');
                        const value = isPassword
                            ? await resolveCopyValue()
                            : (copyValue || displayValue);
                        if (signal.aborted) return;
                        await navigator.clipboard.writeText(value);
                        if (signal.aborted) return;
                        showToast(t('copied') || 'Copiato!');
                    } catch (error) {
                        if (signal.aborted) return;
                        logError('CopyCardValue', error);
                        showToast(t('error_generic'), 'error');
                    }
                }
            }, [createElement('span', {
                className: 'material-symbols-outlined account-action-icon',
                textContent: 'content_copy'
            })])
        ].filter(Boolean))
    ]);
}

function createAccountCard(account, options) {
    const mode = accountModeFromRecord(account);
    const isMemo = mode.startsWith('memo-');
    const isShared = mode.endsWith('-shared');
    const isPinned = Boolean(account.isPinned);
    const themeKey = isShared && isMemo ? 'shared_memo' : isShared ? 'shared' : isMemo ? 'memo' : 'standard';
    const theme = options.themes[themeKey];

    return createElement('div', {
        className: 'account-card swipe-row',
        dataset: { id: account.id, owner: String(account.isOwner), action: 'navigate' },
        onclick: event => {
            if (event.target.closest('button')) return;
            options.onNavigate(account);
        }
    }, [
        createElement('div', { className: 'swipe-action-bg bg-archive' }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'archive' })
        ]),
        createElement('div', { className: 'swipe-action-bg bg-delete' }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
        ]),
        createElement('div', { className: 'swipe-content' }, [
            createElement('div', { className: 'account-card-layout' }, [
                createElement('div', { className: 'account-card-left' }, [
                    createElement('div', { className: 'account-icon-box' }, [
                        createElement('img', {
                            className: 'account-avatar',
                            src: account.logo || account.avatar || 'assets/images/google-avatar.png'
                        }),
                        createElement('div', { className: `account-badge-dot ${theme.accent}` })
                    ]),
                    createElement('div', { className: 'account-card-info-group' }, [
                        createElement('h3', {
                            className: 'account-card-title',
                            textContent: account.nomeAccount || t('without_name')
                        }),
                        createElement('p', {
                            className: 'account-card-subtitle',
                            textContent: options.getSubtitle(account)
                        })
                    ])
                ]),
                options.readOnly ? null : createElement('div', { className: 'account-card-right' }, [
                    createElement('button', {
                        className: `btn-mini-action ${isPinned ? 'active' : ''}`,
                        onclick: event => {
                            event.stopPropagation();
                            options.onPin(account);
                        }
                    }, [createElement('span', {
                        className: `material-symbols-outlined account-pin-icon ${isPinned ? 'filled' : ''}`,
                        textContent: 'push_pin'
                    })])
                ])
            ]),
            createElement('div', { className: 'account-data-display' }, [
                account.username ? createDataRow(t('label_user'), account.username, null, false, false, options.signal) : null,
                account.account ? createDataRow(t('label_account'), account.account, null, false, false, options.signal) : null,
                account.password ? createDataRow(t('label_password'), '••••••••', account.password, true, account._encrypted, options.signal,
                    options.resolveSecret ? () => options.resolveSecret(account, 'password') : undefined) : null
            ].filter(Boolean))
        ])
    ]);
}

export function createAccountListView(options) {
    let swipeList = null;
    let lifecycle = new AbortController();

    return Object.freeze({
        destroy() {
            lifecycle.abort();
            swipeList?.destroy();
            swipeList = null;
        },
        render(accounts) {
            lifecycle.abort();
            lifecycle = new AbortController();
            swipeList?.destroy();
            swipeList = null;
            const container = document.getElementById(options.containerId || 'accounts-container');
            if (!container) return;
            clearElement(container);

            if (accounts.length === 0) {
                setChildren(container, createElement('div', { className: options.emptyStateClass }, [
                    createElement('p', {
                        className: options.emptyTextClass,
                        textContent: t('no_accounts_found') || 'Nessun account trovato'
                    })
                ]));
                return;
            }

            setChildren(container, accounts.map(account => createAccountCard(account, {...options, signal: lifecycle.signal})));
            if (options.readOnly) return;
            swipeList = new SwipeList('.swipe-row', {
                threshold: 0.15,
                onSwipeLeft: options.onDelete,
                onSwipeRight: options.onArchive
            });
        }
    });
}
