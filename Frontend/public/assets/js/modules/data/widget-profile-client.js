import {auth, functions} from '../../firebase-config.js?v=1.2.157';
import {httpsCallable} from '/assets/js/vendor/firebase-runtime.js';

const manageWidgetProfile = httpsCallable(functions, 'manageWidgetProfile');
const id = () => crypto.randomUUID();

async function send(command) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('WIDGET_SESSION_CHANGED');
    if (!navigator.onLine) throw new Error('I profili Widget si modificano soltanto online.');
    const response = await manageWidgetProfile({...command, expectedOwnerUid: uid});
    if (response.data?.status !== 'applied') {
        throw new Error(response.data?.status === 'conflict'
            ? 'Il profilo Widget è stato modificato altrove. Aggiorna e riprova.'
            : 'Operazione sul profilo Widget non completata.');
    }
    return response.data;
}

export const createWidgetProfile = (data, profileId = id()) => send({
    action: 'create', profileId, operationId: id(), data
}).then(result => ({...result, profileId}));

export const updateWidgetProfile = (profileId, expectedRevision, data) => send({
    action: 'update', profileId, expectedRevision, operationId: id(), data
});

export const deleteWidgetProfile = profile => send({
    action: 'delete', profileId: profile.id, expectedRevision: Number(profile.revision || 0), operationId: id()
});
