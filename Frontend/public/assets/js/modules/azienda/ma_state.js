/**
 * MA STATE — STATO CONDIVISO (V1.0)
 * Oggetto stato mutabile condiviso tra i moduli ma_*.
 * Ogni modulo importa { state } e accede a state.selectedFiles, ecc.
 * Nessuna dipendenza circolare: questo file non importa nulla.
 */

export const state = {
    currentUid: null,
    currentAziendaId: null,
    selectedFiles: [],
    existingAttachments: [],
    eventsInitialized: false
};
