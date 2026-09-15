import {PROFILE_SECTIONS} from './profile-section-reader.mjs';
import {readErrorMessage} from '../../Frontend/public/assets/js/modules/shared/read-error-message.js';

// Read-only migration slice: editors, links, utilities and QR remain outside this view.
export async function mountProfileShell(root, context, {readSection}) {
    if (!context.unlocked || context.signal.aborted) return () => {};
    let disposed = false, revision = 0;
    const host = document.createElement('div'); host.dataset.profileShell = 'true';
    const title = document.createElement('h2'); title.textContent = 'Profilo utente';
    const notice = document.createElement('p'); notice.textContent = 'Consultazione del profilo. Modifiche, collegamenti, utenze e tessera digitale non sono ancora integrati in questa vista di prova.';
    const navigation = document.createElement('nav'); navigation.setAttribute('aria-label', 'Sezioni del profilo');
    const panel = document.createElement('div'); panel.setAttribute('aria-live', 'polite');
    const controls = new AbortController(), buttons = [];
    const current = ticket => !disposed && !context.signal.aborted && ticket === revision;
    const clear = () => { for (const node of panel.querySelectorAll('dd')) node.textContent = ''; panel.replaceChildren(); };
    const dispose = () => {
        if (disposed) return;
        disposed = true; revision++; controls.abort(); context.signal.removeEventListener('abort', dispose);
        clear(); host.remove();
    };
    async function select(section) {
        if (disposed || context.signal.aborted) return;
        const ticket = ++revision; clear();
        for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.profileSection === section));
        panel.textContent = 'Caricamento…';
        try {
            const rows = await readSection(section);
            if (!current(ticket)) return;
            context.assertUnlocked(); clear();
            if (!rows.length) { panel.textContent = 'Nessun dato presente.'; return; }
            let group, list;
            for (const row of rows) {
                if (row.group !== group) {
                    group = row.group;
                    const heading = document.createElement('h3'); heading.textContent = group;
                    list = document.createElement('dl'); panel.append(heading, list);
                }
                const label = document.createElement('dt'), value = document.createElement('dd');
                label.textContent = row.label; value.textContent = row.value; list.append(label, value);
            }
        } catch (error) {
            if (current(ticket)) {
                clear();
                panel.textContent = readErrorMessage(error, 'Profilo non disponibile o non leggibile. Verifica lo sblocco e riprova.');
            }
        }
    }
    for (const [section, label] of Object.entries(PROFILE_SECTIONS)) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.dataset.profileSection = section;
        button.addEventListener('click', () => { void select(section); }, {signal: controls.signal});
        buttons.push(button); navigation.append(button);
    }
    host.append(title, notice, navigation, panel); root.append(host);
    context.signal.addEventListener('abort', dispose, {once: true});
    if (context.signal.aborted) dispose(); else await select('personal');
    return dispose;
}
