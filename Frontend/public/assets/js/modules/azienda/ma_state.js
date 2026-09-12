/**
 * MA STATE — STATO CONDIVISO (V1.0)
 * Oggetto stato mutabile condiviso tra i moduli ma_*.
 * Ogni modulo importa { state } e accede a state.selectedFiles, ecc.
 * Nessuna dipendenza circolare: questo file non importa nulla.
 */

export const state = {
    originalCompany: null,
    formLoaded: false,
    currentUid: null,
    currentAziendaId: null,
    selectedFiles: [],
    existingAttachments: [],
    eventsInitialized: false
};
