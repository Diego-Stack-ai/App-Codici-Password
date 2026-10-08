// TEST ONLY: crypto/session integration uses explicit synthetic admission.
// Real Firebase policy admission has separate tests; this does not certify it.
import {createFirebaseSession as createSession} from '../firebase-session.mjs';
import {createSyntheticTestAdmission} from './synthetic-admission.mjs';
export function createFirebaseSession(options) {
    return createSession({...createSyntheticTestAdmission({getUser: () => options.auth.currentUser}), ...options});
}
