import {createAccountListView} from '../../Frontend/public/assets/js/modules/shared/account-list-view.js';

// Reuses the actual renderer of private/company lists, with fixture data only.
export function mountRealList(root, records, {signal, company = false}) {
    const title = document.createElement('h2');
    title.textContent = company ? 'Account aziendali · dati fittizi' : 'Account privati · dati fittizi';
    const search = document.createElement('input');
    search.type = 'search'; search.placeholder = 'Cerca account';
    search.setAttribute('aria-label', 'Cerca account');
    search.autocomplete = 'off';
    const container = document.createElement('div');
    container.id = 'accounts-container';
    root.append(title, search, container);
    const view = createAccountListView({
        themes: Object.fromEntries(['standard', 'shared', 'memo', 'shared_memo'].map(name => [name, {}])),
        getSubtitle: account => account.username,
        onNavigate: () => {}, onPin: () => {}, onDelete: () => {}, onArchive: () => {},
        emptyStateClass: '', emptyTextClass: ''
    });
    const render = () => {
        if (signal.aborted) return;
        view.render(records.filter(record => record.company === company && record.nomeAccount.toLowerCase().includes(search.value.toLowerCase())));
    };
    signal.addEventListener('abort', () => { view.destroy(); root.replaceChildren(); }, {once: true});
    search.addEventListener('input', render, {signal});
    render();
    // Fixture is read-only: do not expose actions that would pretend to save data.
    const disableWrites = () => {
        for (const button of container.querySelectorAll('.account-pin-icon')) button.parentElement.remove();
    };
    search.addEventListener('input', disableWrites, {signal});
    disableWrites();
    return () => { view.destroy(); root.replaceChildren(); records = []; };
}
