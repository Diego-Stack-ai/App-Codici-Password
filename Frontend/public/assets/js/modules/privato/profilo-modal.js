/**
 * PROFILO MODAL ENGINE (V1.0 — Extracted from profilo_privato.js)
 * Motore UI per i form di modifica del profilo.
 * Zero dipendenze dallo stato del profilo: riceve titolo, campi e callback.
 */

import { createElement, setChildren } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';

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
                const hiddenSelect = createElement('select', { className: 'hidden-select' },
                    (f.options || []).map(opt => createElement('option', { value: opt, textContent: opt, selected: opt === val }))
                );
                valueInput = hiddenSelect;

                finalInputEl = createElement('div', { className: 'custom-select-wrapper' }, [
                    hiddenSelect,
                    createElement('div', {
                        className: 'glass-field-input custom-select-trigger',
                        onclick: (e) => {
                            e.stopPropagation();
                            const currentMenu = e.currentTarget.nextElementSibling;
                            document.querySelectorAll('.custom-select-menu.show').forEach(m => {
                                if (m !== currentMenu) m.classList.remove('show');
                            });
                            currentMenu.classList.toggle('show');
                        }
                    }, [
                        createElement('span', { className: 'selected-text', textContent: val || 'Seleziona...' }),
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'expand_more' })
                    ]),
                    createElement('div', { className: 'custom-select-menu vertical-scroll' },
                        (f.options || []).map(opt => createElement('div', {
                            className: 'custom-option',
                            textContent: opt,
                            onclick: (e) => {
                                e.stopPropagation();
                                const wrapper = e.currentTarget.closest('.custom-select-wrapper');
                                const sel = wrapper.querySelector('select');
                                const txt = wrapper.querySelector('.selected-text');
                                const menu = wrapper.querySelector('.custom-select-menu');
                                sel.value = opt;
                                txt.textContent = opt;
                                sel.dispatchEvent(new Event('change'));
                                menu.classList.remove('show');
                            }
                        }))
                    )
                ]);
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
