// TEST ONLY. This is an explicit identity fixture, NOT Firebase policy evidence.
// Never import from an application entry point or from firebase-session.
import {createLocalPresentation} from '../local-presentation.mjs';

export function createSyntheticTestAdmission({getUser}) {
    const presentation = createLocalPresentation({origin: 'http://127.0.0.1:4188', getUser});
    return Object.freeze({
        getTicket: presentation.getTicket,
        isTicketActive: presentation.active,
        presentation,
        admission: Object.freeze({
            async check({ticket}) {
                if (!presentation.active(ticket)) return {ok: false, code: 'synthetic-ticket'};
                const uid = getUser()?.uid;
                if (!presentation.active(ticket)) return {ok: false, code: 'synthetic-ticket'};
                return {ok: true, uid, online: false};
            },
            invalidate: presentation.invalidate,
            dispose: presentation.dispose
        })
    });
}
