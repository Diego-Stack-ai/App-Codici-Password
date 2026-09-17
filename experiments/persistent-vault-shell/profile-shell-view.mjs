import {PROFILE_SECTIONS} from './profile-section-reader.mjs';
import {readErrorMessage} from '../../Frontend/public/assets/js/modules/shared/read-error-message.js';

// Optional editors are supplied by bootstrap; there is no fallback writer.
export async function mountProfileShell(root, context, {readSection, readOverview, mountWidgets, mountDigitalCard, mountCompanySummary, mountAnagraphicEditor, mountContactsEditor, mountAddressesEditor, mountLinkEditor, mountDocumentAttachments, linkedAccounts, onOpenAccount, profileTitle = 'Profilo utente'}) {
    if (!context.unlocked || context.signal.aborted) return () => {};
    let disposed = false, revision = 0, sectionControls, widgetCleanup;
    const host = document.createElement('div'); host.dataset.profileShell = 'true';
    const title = document.createElement('h2'); title.textContent = profileTitle;
    const notice = document.createElement('p');
    const noticeEditable = [mountAnagraphicEditor ? 'l’anagrafica, comprese le note' : null,
        mountContactsEditor ? 'i contatti, comprese email e telefoni' : null,
        mountAddressesEditor ? 'gli indirizzi' : null].filter(Boolean);
    notice.textContent = 'Consultazione del profilo e degli Account collegati, incluse le utenze degli indirizzi personali. ' + (noticeEditable.length ? `Puoi modificare ${noticeEditable.join(' e ')}.` : 'Modifiche ai dati e ai collegamenti non sono ancora integrate in questa vista di prova.') + (mountDigitalCard ? '' : ' Tessera digitale non ancora integrata.');
    const navigation = document.createElement('nav'); navigation.setAttribute('aria-label', 'Sezioni del profilo');
    const panel = document.createElement('div'); panel.setAttribute('aria-live', 'polite');
    const controls = new AbortController(), buttons = [];
    const current = ticket => !disposed && !context.signal.aborted && ticket === revision;
    const clear = () => { sectionControls?.abort(); widgetCleanup?.(); widgetCleanup = null; for (const tag of ['dd', 'dt', 'h3']) for (const node of panel.querySelectorAll(tag)) node.textContent = ''; panel.replaceChildren(); };
    const dispose = () => {
        if (disposed) return;
        disposed = true; revision++; controls.abort(); context.signal.removeEventListener('abort', dispose);
        clear(); host.remove();
    };
    function addLinkedAccount(list, link, ticket) {
        if (!linkedAccounts || typeof onOpenAccount !== 'function') return;
        const caption = document.createElement('dt'), value = document.createElement('dd'), actions = document.createElement('dd');
        caption.textContent = 'Password Account collegato'; value.textContent = '••••••••';
        const result = document.createElement('span'); result.setAttribute('role', 'status');
        let revealed = false;
        const active = () => { if (!current(ticket)) return false; context.assertUnlocked(); return true; };
        function button(label, action) {
            const node = document.createElement('button'); node.type = 'button'; node.textContent = label;
            node.addEventListener('click', async () => {
                try {
                    if (!active() || node.disabled) return;
                    node.disabled = true; result.textContent = '';
                    await action();
                } catch (error) {
                    if (current(ticket)) {
                        value.textContent = '••••••••'; revealed = false; toggle.textContent = 'Mostra password';
                        result.textContent = readErrorMessage(error, 'Account o password non disponibili. Aggiorna il profilo e verifica il collegamento.');
                    }
                } finally { if (current(ticket)) node.disabled = false; }
            }, {signal: sectionControls.signal});
            actions.append(node); return node;
        }
        button('Apri Account collegato', async () => {
            const selection = await linkedAccounts.open(link);
            if (active()) onOpenAccount(selection);
        });
        const toggle = button('Mostra password', async () => {
            if (revealed) { value.textContent = '••••••••'; revealed = false; toggle.textContent = 'Mostra password'; return; }
            const password = await linkedAccounts.readPassword(link);
            if (!active()) return;
            value.textContent = password || 'Nessuna password'; revealed = true; toggle.textContent = 'Nascondi password';
        });
        button('Copia password', async () => {
            const password = await linkedAccounts.readPassword(link);
            if (!active()) return;
            await navigator.clipboard.writeText(password);
            if (active()) result.textContent = 'Copiata.';
        });
        actions.append(result); list.append(caption, value, actions); return actions;
    }
    async function select(section, confirmed = false, editing = false) {
        if (disposed || context.signal.aborted) return;
        const ticket = ++revision; clear();
        for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.profileSection === section));
        panel.textContent = 'Caricamento…';
        try {
            if (editing?.linkOrigin && mountLinkEditor) {
                context.assertUnlocked(); clear(); sectionControls = new AbortController();
                const mounted = await mountLinkEditor(panel, {signal: sectionControls.signal, source: editing.linkOrigin, mode: editing.mode,
                    onSaved: () => current(ticket) ? select(section, true) : undefined,
                    onCancel: () => current(ticket) ? select(section) : undefined});
                if (!current(ticket)) mounted?.(); else widgetCleanup = mounted;
                return;
            }
            if (editing && section === 'personal' && mountAnagraphicEditor) {
                context.assertUnlocked(); clear(); sectionControls = new AbortController();
                const mounted = await mountAnagraphicEditor(panel, {signal: sectionControls.signal,
                    onSaved: () => current(ticket) ? select('personal', true) : undefined,
                    onCancel: () => current(ticket) ? select('personal') : undefined});
                if (!current(ticket)) mounted?.(); else widgetCleanup = mounted;
                return;
            }
            if (editing === true && section === 'contacts' && mountContactsEditor) {
                context.assertUnlocked(); clear(); sectionControls = new AbortController();
                const mounted = await mountContactsEditor(panel, {signal: sectionControls.signal,
                    onSaved: () => current(ticket) ? select('contacts', true) : undefined,
                    onCancel: () => current(ticket) ? select('contacts') : undefined});
                if (!current(ticket)) mounted?.(); else widgetCleanup = mounted;
                return;
            }
            if (editing === true && section === 'addresses' && mountAddressesEditor) {
                context.assertUnlocked(); clear(); sectionControls = new AbortController();
                const mounted = await mountAddressesEditor(panel, {signal: sectionControls.signal,
                    onSaved: () => current(ticket) ? select('addresses', true) : undefined,
                    onCancel: () => current(ticket) ? select('addresses') : undefined});
                if (!current(ticket)) mounted?.(); else widgetCleanup = mounted;
                return;
            }
            if ((section === 'digital-card' && mountDigitalCard) || (section === 'pdf-summary' && mountCompanySummary)) {
                context.assertUnlocked(); clear(); sectionControls = new AbortController();
                const mounted = await (section === 'digital-card' ? mountDigitalCard : mountCompanySummary)(panel, {signal: sectionControls.signal});
                if (!current(ticket)) mounted?.(); else widgetCleanup = mounted;
                return;
            }
            const rows = await (section === 'overview' && readOverview ? readOverview() : readSection(section, {confirmed}));
            if (!current(ticket)) return;
            context.assertUnlocked(); clear();
            if (!rows.length) panel.textContent = 'Nessun dato presente.';
            sectionControls = new AbortController();
            let group, list;
            for (const row of rows) {
                if (row.group !== group) {
                    group = row.group;
                    const heading = document.createElement('h3'); heading.textContent = group;
                    list = document.createElement('dl'); panel.append(heading, list);
                }
                const label = document.createElement('dt'), value = document.createElement('dd');
                label.textContent = row.label; value.textContent = row.value; list.append(label, value);
                if (section === 'overview' && Object.hasOwn(PROFILE_SECTIONS, row.target)) {
                    const action = document.createElement('button'); action.type = 'button'; action.textContent = `Apri ${PROFILE_SECTIONS[row.target]}`;
                    action.addEventListener('click', () => { if (current(ticket)) void select(row.target); }, {signal: sectionControls.signal});
                    const actions = document.createElement('dd'); actions.append(action); list.append(actions);
                }
                const linkedActions = row.link ? addLinkedAccount(list, row.link, ticket) : null;
                if (row.linkOrigin && mountLinkEditor) {
                    const actions = linkedActions || document.createElement('dd');
                    for (const [label, mode] of row.link ? [['Cambia Account', 'change'], ['Scollega Account', 'unlink']] : [['Collega Account', 'change']]) {
                        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
                        button.dataset.profileLinkAction = mode; button.dataset.profileLinkSource = row.linkOrigin.id;
                        button.addEventListener('click', () => {if (current(ticket)) void select(section, false, {linkOrigin: row.linkOrigin, mode});}, {signal: sectionControls.signal});
                        actions.append(button);
                    }
                    if (!linkedActions) list.append(actions);
                }
            }
            if (section === 'personal' && mountAnagraphicEditor) {
                const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Modifica anagrafica';
                edit.addEventListener('click', () => {if (current(ticket)) void select('personal', false, true);}, {signal: sectionControls.signal});
                panel.append(edit);
            }
            if (section === 'contacts' && mountContactsEditor) {
                const editContacts = document.createElement('button'); editContacts.type = 'button'; editContacts.textContent = 'Modifica contatti';
                editContacts.addEventListener('click', () => {if (current(ticket)) void select('contacts', false, true);}, {signal: sectionControls.signal});
                panel.append(editContacts);
            }
            if (section === 'addresses' && mountAddressesEditor) {
                const editAddresses = document.createElement('button'); editAddresses.type = 'button'; editAddresses.textContent = 'Modifica indirizzi';
                editAddresses.addEventListener('click', () => {if (current(ticket)) void select('addresses', false, true);}, {signal: sectionControls.signal});
                panel.append(editAddresses);
            }
            if (mountWidgets && Object.hasOwn(PROFILE_SECTIONS, section)) {
                const mounted = await mountWidgets(panel, {section, signal: sectionControls.signal});
                if (!current(ticket)) mounted?.(); else widgetCleanup = mounted;
            }
            // DS-002C: the Allegato surface lives inside the documents section, next
            // to the rows it belongs to, and is disposed with everything else.
            if (section === 'documents' && mountDocumentAttachments) {
                const mounted = await mountDocumentAttachments(panel, {signal: sectionControls.signal});
                if (!current(ticket)) mounted?.();
                else {
                    const widgets = widgetCleanup;
                    widgetCleanup = widgets ? () => {try {mounted?.();} finally {widgets();}} : mounted;
                }
            }
        } catch (error) {
            if (current(ticket)) {
                clear();
                panel.textContent = readErrorMessage(error, 'Profilo non disponibile o non leggibile. Verifica lo sblocco e riprova.');
            }
        }
    }
    for (const [section, label] of Object.entries({...readOverview ? {overview: 'Panoramica'} : {}, ...PROFILE_SECTIONS,
        ...mountDigitalCard ? {'digital-card': 'Tessera digitale'} : {}, ...mountCompanySummary ? {'pdf-summary': 'Scheda PDF'} : {}})) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.dataset.profileSection = section;
        button.addEventListener('click', () => { void select(section); }, {signal: controls.signal});
        buttons.push(button); navigation.append(button);
    }
    host.append(title, notice, navigation, panel); root.append(host);
    context.signal.addEventListener('abort', dispose, {once: true});
    if (context.signal.aborted) dispose(); else await select(readOverview ? 'overview' : 'personal');
    return dispose;
}
