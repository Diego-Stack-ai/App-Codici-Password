const SELECTOR = Object.freeze({
    tab: '[data-deadline-domain]',
    panel: '[data-deadline-panel]'
});

let disposeMount = () => {};

export function initDeadlineRulesHub() {
    disposeMount();
    const controller = new AbortController();
    disposeMount = () => controller.abort();
    const root = document.querySelector('.deadline-hub');
    if (!root) return disposeMount;
    const tabs = [...root.querySelectorAll(SELECTOR.tab)];
    const panels = [...root.querySelectorAll(SELECTOR.panel)];

    const activate = (domain, { focus = false } = {}) => {
        const next = tabs.find(tab => tab.dataset.deadlineDomain === domain) || tabs[0];
        if (!next || !root.isConnected || controller.signal.aborted) return;
        for (const tab of tabs) {
            const selected = tab === next;
            tab.classList.toggle('is-active', selected);
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        }
        for (const panel of panels) panel.hidden = panel.dataset.deadlinePanel !== next.dataset.deadlineDomain;
        if (focus) next.focus();
    };

    for (const tab of tabs) {
        tab.addEventListener('click', () => activate(tab.dataset.deadlineDomain), { signal: controller.signal });
        tab.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const index = tabs.indexOf(tab);
            const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                : event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
            activate(tabs[nextIndex]?.dataset.deadlineDomain, { focus: true });
        }, { signal: controller.signal });
    }

    activate(tabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.dataset.deadlineDomain);
    return disposeMount;
}
