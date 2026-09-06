import { createElement } from '../../dom-utils.js';

const DEFAULT_ICONS = {
    loading: 'progress_activity',
    empty: 'inbox',
    error: 'error',
    warning: 'warning'
};

export function createUiState({
    kind = 'empty',
    message,
    icon = DEFAULT_ICONS[kind],
    actionLabel,
    onAction
} = {}) {
    const isAlert = kind === 'error' || kind === 'warning';
    const children = [];
    if (icon) {
        children.push(createElement('span', {
            className: `material-symbols-outlined ui-state-icon${kind === 'loading' ? ' is-spinning' : ''}`,
            ariaHidden: 'true',
            textContent: icon
        }));
    }
    children.push(createElement('p', {
        className: 'ui-state-message',
        textContent: message || ''
    }));
    if (actionLabel && typeof onAction === 'function') {
        children.push(createElement('button', {
            type: 'button',
            className: 'ui-state-action',
            textContent: actionLabel,
            onclick: onAction
        }));
    }
    return createElement('div', {
        className: `ui-state ui-state-${kind}`,
        role: isAlert ? 'alert' : 'status',
        ariaLive: isAlert ? 'assertive' : 'polite',
        ariaBusy: kind === 'loading' ? 'true' : 'false'
    }, children);
}
