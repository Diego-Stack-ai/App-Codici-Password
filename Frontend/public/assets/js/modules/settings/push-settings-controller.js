import { showToast } from '../../ui-core-v129.js';
import {
    disableDeadlinePush,
    disableSharingPush,
    enableDeadlinePush,
    enableSharingPush,
    getCurrentPushState,
    listenForDeadlinePushInForeground,
    sendDeadlinePushTest
} from '../shared/push-manager.js?push=20260908d';

const PUSH_SETTINGS = {
    deadlines: {
        toggleId: 'deadline-push-toggle',
        statusId: 'deadline-push-status',
        enabledLabel: 'Attive su questo dispositivo · Solo scadenze',
        enabledToast: 'Notifiche scadenze attivate',
        disabledToast: 'Notifiche scadenze disattivate',
        enable: enableDeadlinePush,
        disable: disableDeadlinePush
    },
    sharing: {
        toggleId: 'sharing-push-toggle',
        statusId: 'sharing-push-status',
        enabledLabel: 'Attive su questo dispositivo',
        enabledToast: 'Notifiche inviti attivate',
        disabledToast: 'Notifiche inviti disattivate',
        enable: enableSharingPush,
        disable: disableSharingPush
    }
};

async function setupPushToggle(user, scope) {
    const config = PUSH_SETTINGS[scope];
    const toggle = document.getElementById(config.toggleId);
    const status = document.getElementById(config.statusId);
    const testButton = scope === 'deadlines'
        ? document.getElementById('btn-test-deadline-push')
        : null;
    if (!toggle || !status || (scope === 'deadlines' && !testButton)) return;

    const render = async () => {
        const state = await getCurrentPushState(user, scope);
        toggle.checked = state.enabled;
        toggle.disabled = !state.compatible;
        testButton?.classList.toggle('hidden', !state.enabled);
        status.textContent = state.compatible
            ? (state.enabled ? config.enabledLabel : 'Disattivate su questo dispositivo')
            : state.reason;
    };

    await render();
    toggle.addEventListener('change', async () => {
        const enabling = toggle.checked;
        toggle.disabled = true;
        try {
            if (enabling) await config.enable(user);
            else await config.disable(user);
            showToast(enabling ? config.enabledToast : config.disabledToast, 'success');
            if (enabling) await listenForDeadlinePushInForeground();
        } catch (error) {
            console.error(`[${scope.toUpperCase()} PUSH] Configurazione fallita`, error);
            toggle.checked = !enabling;
            showToast(error.message || 'Configurazione notifiche non riuscita', 'error');
        } finally {
            await render();
        }
    });

    if (testButton) {
        testButton.addEventListener('click', async () => {
            testButton.disabled = true;
            try {
                await sendDeadlinePushTest();
                showToast('Notifica di prova inviata', 'success');
            } catch (error) {
                if (error.code !== 'functions/resource-exhausted') console.error('[PUSH TEST] Invio fallito', error);
                showToast(error.message || 'Invio di prova non riuscito', 'error');
            } finally {
                testButton.disabled = false;
            }
        });
    }
}

export async function setupPushSettings(user) {
    await Promise.all([
        setupPushToggle(user, 'deadlines'),
        setupPushToggle(user, 'sharing')
    ]);
    await listenForDeadlinePushInForeground();
}
