import { clearElement, createElement } from '../../dom-utils.js';
import { showConfirmModal } from '../../ui-core-v129.js';

export function createDeadlineAttachmentController() {
    let selectedFiles = [];
    let existingAttachments = [];

    function render() {
        const container = document.getElementById('attachments-list');
        if (!container) return;
        clearElement(container);

        const attachments = [
            ...existingAttachments.map((file, index) => ({ ...file, existing: true, index })),
            ...selectedFiles.map((file, index) => ({ name: file.name, existing: false, index }))
        ];
        if (!attachments.length) {
            container.appendChild(createElement('p', { className: 'placeholder-text-standard', textContent: 'Nessun allegato' }));
            return;
        }

        attachments.forEach(file => {
            const extension = file.name.split('.').pop().toLowerCase();
            const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(extension);
            const icon = isImage ? 'image' : extension === 'pdf' ? 'picture_as_pdf' : 'description';
            const color = isImage ? 'text-purple-400/40' : extension === 'pdf' ? 'text-red-400/40' : 'text-white/20';
            container.appendChild(createElement('div', { className: 'attachment-item animate-in slide-in-from-left-2' }, [
                createElement('div', { className: 'attachment-info' }, [
                    createElement('span', { className: `material-symbols-outlined attachment-icon ${color}`, textContent: icon }),
                    createElement('div', { className: 'attachment-meta' }, [
                        createElement('span', { className: 'attachment-name', textContent: file.name }),
                        createElement('span', { className: 'attachment-status', textContent: file.existing ? 'Caricato' : 'Nuovo' })
                    ])
                ]),
                createElement('button', {
                    type: 'button', className: 'btn-delete-attachment',
                    onclick: async event => {
                        event.stopPropagation();
                        const confirmed = await showConfirmModal('ELIMINA ALLEGATO', `Vuoi rimuovere l'allegato ${file.name}?`, 'Elimina', 'Annulla');
                        if (!confirmed) return;
                        if (file.existing) existingAttachments.splice(file.index, 1);
                        else selectedFiles.splice(file.index, 1);
                        render();
                    }
                }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })])
            ]));
        });
    }

    function init() {
        const trigger = document.getElementById('btn-trigger-upload');
        const modal = document.getElementById('source-selector-modal');
        if (!trigger || !modal) return;
        const close = () => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        };
        trigger.onclick = () => {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        };
        const cancel = document.getElementById('btn-cancel-source');
        if (cancel) cancel.onclick = close;
        modal.querySelectorAll('[data-source]').forEach(button => {
            button.onclick = () => {
                document.getElementById(`input-${button.dataset.source}`)?.click();
                close();
            };
        });
        ['input-camera', 'input-gallery', 'input-file'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', event => {
                selectedFiles.push(...Array.from(event.target.files || []));
                event.target.value = '';
                render();
            });
        });
        render();
    }

    return {
        init,
        getSelectedFiles: () => [...selectedFiles],
        getExistingAttachments: () => [...existingAttachments],
        setExistingAttachments(value) {
            existingAttachments = Array.isArray(value) ? [...value] : [];
            render();
        }
    };
}
