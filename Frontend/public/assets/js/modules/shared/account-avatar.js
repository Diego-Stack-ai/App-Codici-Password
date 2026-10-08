import { createElement } from '../../dom-utils.js';

export function createAccountAvatar(account = {}) {
    const source = account.logo || account.avatar;
    if (source) {
        return createElement('img', {
            className: 'account-avatar',
            src: source,
            alt: ''
        });
    }

    return createElement('span', {
        className: 'account-default-logo material-symbols-outlined',
        textContent: 'shield_lock',
        'aria-hidden': 'true'
    });
}
