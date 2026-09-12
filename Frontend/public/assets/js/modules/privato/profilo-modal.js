/**
 * PROFILO MODAL ENGINE (V1.0 — Extracted from profilo_privato.js)
 * Motore UI per i form di modifica del profilo.
 * Zero dipendenze dallo stato del profilo: riceve titolo, campi e callback.
 */

import { createElement, setChildren } from '../../dom-utils.js';
import { showConfirmModal, showInputModal, showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { filterProfileAccounts } from './profile-model.js';

export function showProfileAccountPicker({ title, accounts, companies, onSelect, initialScope = 'all' }) {
    document.getElementById('profile-account-picker')?.remove();
    const previousFocus = document.activeElement;
    let selected = null;
    let busy = false;
    const modal = createElement('div', { id: 'profile-account-picker', className: 'modal-overlay active' });
    const box = createElement('div', {
        className: 'modal-box profile-account-picker', role: 'dialog',
        'aria-modal': 'true', 'aria-labelledby': 'profile-account-picker-title'
    });
    const search = createElement('input', {
        type: 'search', className: 'glass-field-input profile-account-search',
        placeholder: 'Cerca nome, azienda o nome utente…', 'aria-label': 'Cerca Account', autocomplete: 'off'
    });
    const scope = createElement('select', { className: 'glass-field-input profile-account-scope', 'aria-label': 'Filtra per ambito' }, [
        createElement('option', { value: 'all', textContent: 'Tutti gli Account' }),
        createElement('option', { value: 'personal', textContent: 'Personali' }),
        ...companies.map(company => createElement('option', { value: `company:${company.id}`, textContent: company.name }))
    ]);
    scope.value = initialScope;
    if (!scope.value) scope.value = 'all';
    const count = createElement('p', { className: 'profile-account-count', role: 'status', 'aria-live': 'polite' });
    const list = createElement('div', { className: 'profile-account-results', 'aria-label': 'Account trovati' });
    const close = () => {
        if (busy) return;
        modal.remove();
        previousFocus?.focus();
    };
    const submit = async selection => {
        if (busy) return;
        busy = true;
        confirm.disabled = true;
        create.disabled = true;
        try {
            await onSelect(selection);
            busy = false;
            close();
        } catch {
            busy = false;
            confirm.disabled = !selected;
            create.disabled = false;
            showToast('Impossibile aprire l’Account. Riprova: nessun collegamento è stato salvato.', 'error');
        }
    };
    const confirm = createElement('button', {
        className: 'btn-modal btn-primary', textContent: 'Continua', disabled: true,
        onclick: () => selected && submit(selected)
    });
    const create = createElement('button', {
        className: 'btn-upload-trigger profile-account-create', textContent: '+ Nuovo Account personale',
        onclick: () => submit({ companyId: scope.value.startsWith('company:') ? scope.value.slice(8) : '' })
    });
    const render = () => {
        selected = null;
        confirm.disabled = true;
        const results = filterProfileAccounts(accounts, search.value, scope.value);
        count.textContent = `${results.length} Account trovati`;
        create.textContent = scope.value.startsWith('company:') ? '+ Nuovo Account in questa azienda' : '+ Nuovo Account personale';
        setChildren(list, results.length ? results.map(account => {
            const button = createElement('button', {
                className: 'profile-account-result', type: 'button', 'aria-pressed': 'false',
                onclick: () => {
                    if (busy) return;
                    selected = account;
                    list.querySelectorAll('button').forEach(row => row.setAttribute('aria-pressed', String(row === button)));
                    confirm.disabled = false;
                }
            }, [
                createElement('span', { className: 'profile-account-result-name', textContent: account.name }),
                createElement('span', { className: 'profile-account-result-context', textContent: account.companyId ? `Azienda · ${account.companyName}` : 'Personale' }),
                account.username ? createElement('span', { className: 'profile-account-result-user', textContent: account.username }) : null
            ]);
            return button;
        }) : [createElement('p', { className: 'profile-account-empty', textContent: 'Nessun Account trovato. Prova un altro nome o cambia il filtro.' })]);
        list.scrollTop = 0;
    };
    search.oninput = render;
    scope.onchange = render;
    modal.onkeydown = event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key !== 'Tab') return;
        const controls = [...box.querySelectorAll('input, select, button:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    setChildren(box, [
        createElement('div', { className: 'modal-header' }, [
            createElement('h3', { id: 'profile-account-picker-title', className: 'modal-title', textContent: title }),
            createElement('div', { className: 'modal-accent-bar' })
        ]),
        createElement('div', { className: 'profile-account-filters' }, [search, scope]), count, list, create,
        createElement('div', { className: 'modal-actions' }, [
            createElement('button', { className: 'btn-modal btn-secondary', textContent: 'Annulla', onclick: close }), confirm
        ])
    ]);
    modal.appendChild(box);
    document.body.appendChild(modal);
    render();
    search.focus();
}

/**
 * Mostra un modal di modifica generico per il profilo.
 * @param {string} title - Titolo del modal
 * @param {Array} fields - Array di { key, label, icon, type?, options?, configKey? }
 * @param {Object} currentValues - Valori correnti da pre-popolare
 * @param {Function} onSave - Callback async(newData) chiamata al salvataggio
 */
export function showProfileModal(title, fields, currentValues, onSave) {
    try {
        const modalId = 'profile-edit-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = createElement('div', { id: modalId, className: 'modal-overlay' });
        const modalBox = createElement('div', { className: 'modal-box modal-profile-box' });

        const header = createElement('div', { className: 'modal-header' }, [
            createElement('h3', { className: 'modal-title', textContent: title }),
            createElement('div', { className: 'modal-accent-bar' })
        ]);

        // 🛡️ Trappola Anti-autofill V7.0
        const trap = createElement('div', { className: 'anti-autofill-trap', ariaHidden: 'true' }, [
            createElement('input', { type: 'text', name: 'user_login_trap', autocomplete: 'username', tabindex: '-1' }),
            createElement('input', { type: 'password', name: 'password_trap', autocomplete: 'current-password', tabindex: '-1' })
        ]);

        const form = createElement('div', { className: 'flex-col-gap profile-modal-form' });
        form.appendChild(trap);
        const formScroll = createElement('div', {
            className: 'modal-form-scroll vertical-scroll profile-modal-scroll'
        }, [form]);
        const inputs = {};

        fields.forEach(f => {
            const val = currentValues[f.key] || '';
            let finalInputEl;
            let valueInput;

            if (f.type === 'select') {
                let optionValues = [...(f.options || [])];
                let selectedValue = optionValues.includes(val) ? val : (optionValues[0] || '');
                const hiddenSelect = createElement('select', { className: 'hidden-select' });
                const selectedText = createElement('span', { className: 'selected-text' });
                const menu = createElement('div', { className: 'custom-select-menu vertical-scroll' });
                const canManageOptions = Boolean(f.configKey && typeof f.onOptionsChanged === 'function');
                valueInput = hiddenSelect;

                const persistOptions = async nextOptions => {
                    if (!canManageOptions) return optionValues;
                    return f.onOptionsChanged(f.configKey, nextOptions);
                };

                const rebuildOptions = () => {
                    if (!optionValues.includes(selectedValue)) selectedValue = optionValues[0] || '';
                    setChildren(hiddenSelect, optionValues.map(opt => createElement('option', {
                        value: opt,
                        textContent: opt,
                        selected: opt === selectedValue
                    })));
                    hiddenSelect.value = selectedValue;
                    selectedText.textContent = selectedValue || 'Seleziona...';

                    const rows = optionValues.map(opt => createElement('div', {
                        className: 'custom-option',
                        onclick: (event) => {
                            if (event.target.closest('button')) return;
                            event.stopPropagation();
                            selectedValue = opt;
                            hiddenSelect.value = opt;
                            selectedText.textContent = opt;
                            hiddenSelect.dispatchEvent(new Event('change'));
                            menu.classList.remove('show');
                        }
                    }, [
                        createElement('span', { textContent: opt }),
                        canManageOptions ? createElement('div', { className: 'flex-center-row profile-label-actions' }, [
                            createElement('button', {
                                className: 'btn-action-mini profile-label-action profile-label-edit',
                                title: `Rinomina ${opt}`,
                                'aria-label': `Rinomina ${opt}`,
                                onclick: async event => {
                                    event.stopPropagation();
                                    const renamed = await showInputModal('Rinomina etichetta', opt, 'Nuovo nome etichetta...');
                                    const cleanName = String(renamed || '').trim();
                                    if (!cleanName || cleanName === opt || optionValues.includes(cleanName)) return;
                                    optionValues = await persistOptions(optionValues.map(value => value === opt ? cleanName : value));
                                    if (selectedValue === opt) selectedValue = cleanName;
                                    rebuildOptions();
                                    showToast('Etichetta aggiornata!', 'success');
                                }
                            }, [createElement('span', { className: 'material-symbols-outlined profile-label-action-icon', textContent: 'edit' })]),
                            createElement('button', {
                                className: 'btn-action-mini profile-label-action profile-label-delete',
                                title: `Elimina ${opt}`,
                                'aria-label': `Elimina ${opt}`,
                                onclick: async event => {
                                    event.stopPropagation();
                                    if (optionValues.length <= 1) {
                                        showToast('Deve rimanere almeno un’etichetta.', 'warning');
                                        return;
                                    }
                                    const confirmed = await showConfirmModal(
                                        'Elimina etichetta',
                                        `Vuoi eliminare l’etichetta “${opt}”? I dati già salvati con questo nome non vengono modificati.`,
                                        'Elimina',
                                        'Annulla'
                                    );
                                    if (!confirmed) return;
                                    optionValues = await persistOptions(optionValues.filter(value => value !== opt));
                                    rebuildOptions();
                                    showToast('Etichetta eliminata!', 'success');
                                }
                            }, [createElement('span', { className: 'material-symbols-outlined profile-label-action-icon', textContent: 'delete' })])
                        ]) : null
                    ]));

                    if (canManageOptions) rows.push(createElement('div', {
                        className: 'custom-option profile-label-add',
                        onclick: async event => {
                            event.stopPropagation();
                            const added = await showInputModal('Aggiungi etichetta', '', 'Nome nuova etichetta...');
                            const cleanName = String(added || '').trim();
                            if (!cleanName) return;
                            if (optionValues.includes(cleanName)) {
                                showToast('Etichetta già esistente', 'info');
                                return;
                            }
                            optionValues = await persistOptions([...optionValues, cleanName]);
                            selectedValue = cleanName;
                            rebuildOptions();
                            showToast('Etichetta aggiunta!', 'success');
                        }
                    }, [
                        createElement('span', { className: 'material-symbols-outlined profile-label-add-icon', textContent: 'add_circle' }),
                        createElement('span', { textContent: 'Aggiungi etichetta...' })
                    ]));
                    setChildren(menu, rows);
                };

                const trigger = createElement('div', {
                    className: 'glass-field-input custom-select-trigger',
                    onclick: (event) => {
                        event.stopPropagation();
                        document.querySelectorAll('.custom-select-menu.show').forEach(openMenu => {
                            if (openMenu !== menu) openMenu.classList.remove('show');
                        });
                        menu.classList.toggle('show');
                    }
                }, [
                    selectedText,
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'expand_more' })
                ]);

                finalInputEl = createElement('div', { className: 'custom-select-wrapper' }, [hiddenSelect, trigger, menu]);
                rebuildOptions();
            } else if (f.type === 'textarea' || f.key === 'note') {
                valueInput = createElement('textarea', {
                    className: 'glass-field-input vertical-scroll profile-modal-textarea',
                    value: val,
                    placeholder: f.label,
                    oninput: (e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = (e.target.scrollHeight) + 'px';
                    }
                });
                finalInputEl = valueInput;
                setTimeout(() => {
                    valueInput.style.height = 'auto';
                    valueInput.style.height = (valueInput.scrollHeight) + 'px';
                }, 100);
            } else {
                const k = (f.key || '').toLowerCase();
                const isSensitive = k.includes('pin') || k.includes('puk') || k.includes('password') ||
                    k.includes('num_serie') || k.includes('cf') || k.includes('username') ||
                    k.includes('id_number') || k.includes('license') || k.includes('app_code');

                const inputEl = createElement('input', {
                    type: 'text',
                    className: `glass-field-input profile-modal-input ${isSensitive ? 'base-shield' : ''}`,
                    value: val,
                    placeholder: f.label,
                    autocomplete: 'off',
                    autocorrect: 'off',
                    spellcheck: 'false'
                });
                valueInput = inputEl;

                if (isSensitive) {
                    const toggleBtn = createElement('button', {
                        className: 'btn-view-toggle profile-modal-visibility',
                        onclick: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const icon = toggleBtn.querySelector('span');
                            if (inputEl.classList.contains('base-shield')) {
                                inputEl.classList.remove('base-shield');
                                icon.textContent = 'visibility';
                                toggleBtn.style.opacity = '1';
                            } else {
                                inputEl.classList.add('base-shield');
                                icon.textContent = 'visibility_off';
                                toggleBtn.style.opacity = '0.8';
                            }
                        }
                    }, [
                        createElement('span', { className: 'material-symbols-outlined profile-modal-visibility-icon', textContent: 'visibility_off' })
                    ]);
                    finalInputEl = createElement('div', {
                        className: 'flex-center-row profile-modal-sensitive-row'
                    }, [inputEl, toggleBtn]);
                } else {
                    finalInputEl = inputEl;
                }
            }

            const isLong = f.type === 'textarea' || f.key === 'note';
            const fieldContainer = createElement('div', { className: 'glass-field-container' }, [
                createElement('label', { className: 'view-label', textContent: f.label }),
                createElement('div', {
                    className: `glass-field-box ${isLong ? 'profile-modal-long-field' : 'profile-modal-short-field'}`
                }, [finalInputEl])
            ]);

            inputs[f.key] = valueInput;
            form.appendChild(fieldContainer);
        });

        const actions = createElement('div', { className: 'modal-actions' }, [
            createElement('button', {
                className: 'btn-modal btn-secondary',
                textContent: t('cancel') || 'Annulla',
                onclick: () => closeModal()
            }),
            createElement('button', {
                className: 'btn-modal btn-primary',
                textContent: t('save') || 'Salva',
                onclick: async () => {
                    try {
                        const newData = {};
                        fields.forEach(f => {
                            if (inputs[f.key]) newData[f.key] = inputs[f.key].value.trim();
                        });
                        await onSave(newData);
                        closeModal();
                    } catch (e) {
                        console.error('Save Error:', e);
                        showToast(t('error_generic'), 'error');
                    }
                }
            })
        ]);

        function closeModal() {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }

        setChildren(modalBox, [header, formScroll, actions]);
        modal.appendChild(modalBox);
        document.body.appendChild(modal);
        void modal.offsetWidth;
        setTimeout(() => modal.classList.add('active'), 10);
    } catch (e) {
        console.error('ShowProfileModal Error:', e);
        showToast('Errore interfaccia: ' + e.message, 'error');
    }
}
