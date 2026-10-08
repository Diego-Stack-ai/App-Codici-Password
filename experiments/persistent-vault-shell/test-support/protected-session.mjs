// Explicit test-only identity admission. These tests do not certify Firebase policy.
import {createProtectedSession as createSession} from '../protected-session.mjs';
import {createSyntheticTestAdmission} from './synthetic-admission.mjs';
export function createProtectedSession(options) {
    return createSession({...createSyntheticTestAdmission({getUser: options.getUser}), ...options});
}
