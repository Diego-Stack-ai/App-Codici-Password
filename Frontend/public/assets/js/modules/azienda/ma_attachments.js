/**
 * MA ATTACHMENTS (V1.0)
 * Render e rimozione allegati nel form modifica azienda.
 * Estratto da modifica_azienda.js (righe 366–422).
 *
 * Import graph: ma_state → dom-utils → translations (nessuna dep circolare)
 */

import { state } from './ma_state.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { t } from '../../translations.js';

export function renderAttachments() {
    const list = document.getElementById('attachments-list');
    if (!list) return;
    clearElement(list);

    const all = [
        ...state.existingAttachments.map((f, i) => ({ ...f, existing: true, idx: i })),
        ...state.selectedFiles.map((f, i) => ({ name: f.name, existing: false, idx: i }))
    ];

    const cards = all.map(f => {
        const type = (f.name || "").toLowerCase();
        let icon = 'description';
        let color = 'text-white/20';

        if (type.endsWith('.pdf')) { icon = 'picture_as_pdf'; color = 'text-icon-red'; }
        else if (type.match(/\.(jpg|jpeg|png|gif|webp)$/)) { icon = 'image'; color = 'text-icon-purple'; }

        return createElement('div', {
            className: 'attachment-item-edit'
        }, [
            createElement('div', { className: 'flex items-center gap-3' }, [
                createElement('span', {
                    className: `material-symbols-outlined ${color}`,
                    textContent: icon
                }),
                createElement('div', { className: 'flex-col' }, [
                    createElement('span', {
                        className: 'text-[10px] font-black text-white/80 uppercase truncate max-w-[150px]',
                        textContent: f.name
                    }),
                    createElement('span', {
                        className: 'text-[8px] font-bold text-white/20 uppercase tracking-widest',
                        textContent: f.existing ? (t('uploaded')) : (t('new'))
                    })
                ])
            ]),
            createElement('button', {
                type: 'button',
                className: 'btn-remove-item',
                onclick: () => removeAttachment(f.idx, f.existing)
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'close' })
            ])
        ]);
    });

    setChildren(list, cards.length ? cards : [
        createElement('p', { className: 'no-attachments-text', 'data-t': 'no_attachments', textContent: t('no_attachments') })
    ]);
}

export function removeAttachment(idx, existing) {
    if (existing) state.existingAttachments.splice(idx, 1);
    else state.selectedFiles.splice(idx, 1);
    renderAttachments();
}
