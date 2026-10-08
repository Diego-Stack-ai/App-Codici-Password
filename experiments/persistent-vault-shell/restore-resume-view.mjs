export function mountRestoreResume(root, context, {source}) {
  const host = document.createElement('section'), events = new AbortController();
  let closed = false, busy = false, ready = false, newReady = false, creationAttempted = false, stagingNeeded = false, selectionNeeded = false;
  const make = (tag, text) => {const node = document.createElement(tag); node.textContent = text; return node;};
  const field = (name, type) => {
    const label = make('label', name), input = document.createElement('input');
    input.type = type; input.autocomplete = 'off'; label.append(input); host.append(label); return input;
  };
  host.append(make('h2', 'Riprendi un piano del laboratorio'), make('p',
    'Recupero nel laboratorio isolato, non dati dell’app finale. Seleziona il backup originale (massimo 16 MiB, fino a 100 allegati) e la sua chiave. Il caricamento allegati richiede Storage locale e una conferma separata. Dopo 30 giorni serve una nuova anteprima.'));
  host.append(make('p', 'Le scadenze esistenti mantengono destinatari, permessi e impostazioni di invio attuali; quelle assenti vengono recuperate private, senza vecchi destinatari. Profilo e scadenze collegate devono essere recuperati insieme nello stesso blocco.'));
  const plan = field('ID piano esistente', 'text'), file = field('Backup originale', 'file'), key = field('Chiave del backup', 'password');
  const inspect = make('button', 'Verifica backup e piano'), resume = make('button', 'Conferma ripresa'), cancel = make('button', 'Annulla');
  const status = make('p', ''); status.setAttribute('role', 'status');
  for (const button of [inspect, resume, cancel]) button.type = 'button';
  resume.disabled = true; host.append(inspect, resume, cancel, status);
  const previewNew = make('button', 'Anteprima nuovo piano isolato'), create = make('button', 'Conferma creazione piano');
  previewNew.type = create.type = 'button'; create.disabled = true;
  if (typeof source.previewNew === 'function') host.append(previewNew, create);
  const recover = make('button', 'Verifica esito creazione'); recover.type = 'button'; recover.disabled = true;
  if (typeof source.recoverCreation === 'function') host.append(recover);
  const stage = make('button', 'Conferma caricamento allegati nel laboratorio'); stage.type = 'button'; stage.disabled = true;
  if (typeof source.stageAttachments === 'function') host.append(stage);
  const cleanup = make('button', 'Rimuovi solo i piani scaduti del laboratorio'); cleanup.type = 'button';
  let cleanupAfter = null;
  if (typeof source.cleanupExpired === 'function') host.append(cleanup);
  const selectMissing = make('button', 'Conserva esistenti e seleziona solo mancanti'); selectMissing.type = 'button'; selectMissing.disabled = true;
  if (typeof source.selectMissingOnly === 'function') host.append(selectMissing);
  const choices = make('div',''), selectedInputs = new Map(), selectExplicit = make('button','Conferma selezione e sostituzione degli esistenti');
  selectExplicit.type = 'button'; selectExplicit.disabled = true;
  if (typeof source.selectRecords === 'function') host.append(choices, selectExplicit);
  const clearChoices = () => {selectedInputs.clear(); for (const child of [...choices.children]) child.remove();};
  const wipe = () => {file.value = ''; key.value = '';};
  const dispose = () => {if (closed) return; closed = true; events.abort(); wipe(); plan.value = '';
    clearChoices(); source.dispose(); host.remove(); context.signal.removeEventListener('abort', dispose);};
  const explain = error => error.code === 'GENERATION_UNSUPPORTED' || /GENERATION_UNSUPPORTED/.test(error.message)
    ? 'Ripristino bloccato: la versione esatta dell’allegato non è supportata dal componente Storage. Nessuna versione alternativa verrà usata. Eventuali allegati già caricati o blocchi completati restano; conserva il backup originale.'
    : /PROFILE_DEADLINE_PAIR_INVALID/.test(error.message)
    ? 'Ripristino bloccato: seleziona insieme il profilo e tutte le scadenze collegate, con riferimenti reciproci validi nello stesso blocco. Eventuali blocchi precedenti restano applicati.'
    : /RESUME_SCOPE_(?:FENCE_)?NOT_CONNECTED/.test(error.message)
    ? 'Questo backup contiene ambiti non ancora supportati dal percorso di ripristino candidato. Il contenuto non viene ignorato: conserva il backup originale; occorre completare il supporto prima di procedere.'
    : /TIMESTAMP_PRECISION_UNSUPPORTED/.test(error.message)
    ? 'Ripristino bloccato: il backup contiene timestamp con precisione non rappresentabile dal percorso attuale. Nessun arrotondamento. Eventuali blocchi già completati restano applicati; conserva il backup originale e verifica il piano prima di riprendere.'
    : /WIDGET_BANK_MISSING/.test(error.message)
    ? 'Ripristino bloccato: il conto collegato al widget manca o non è univoco nell’Account scelto. Rivedi la selezione di Account e widget. Eventuali blocchi già completati e allegati già caricati restano; questo rifiuto non li annulla.'
    : /PROFILE_PARENT_MISSING/.test(error.message)
    ? 'Ripristino bloccato: manca un Account collegato al profilo. Recupera prima l’Account oppure includilo nel piano. Eventuali blocchi già completati restano applicati.'
    : /(?:WIDGET|ATTACHMENT)_PARENT_MISSING/.test(error.message)
    ? 'Ripristino bloccato: manca l’Account padre di un allegato o widget. Includi prima l’Account nel piano oppure recuperalo prima dei figli. Eventuali blocchi già completati restano applicati; gli allegati già caricati non sono cancellati da questo rifiuto.'
    : /DEPENDENCY_CROSS_CHUNK/.test(error.message)
    ? 'Piano non creato: un widget dipende da Account selezionati in blocchi diversi. Nessun dato ripristinato da questa creazione; conserva il backup originale. Occorre un piano che mantenga insieme le dipendenze.'
    : /DEPENDENCY_GROUP_TOO_LARGE/.test(error.message)
    ? 'Ripristino bloccato prima della creazione del piano: un Account con i widget collegati supera il limite di un blocco atomico. Conserva il backup originale; questo insieme richiede un percorso di ripristino più ampio.'
    : /EXPIRED|MISSING_NEW_PREVIEW/.test(error.message)
    ? 'Piano scaduto o assente: occorre una nuova anteprima. Nessuna ripresa autorizzata.'
    : /MISMATCH|FORMAT|CHAIN|FOOTER/.test(error.message)
      ? 'Il backup non corrisponde al piano o non è integro. Ripresa bloccata.'
      : 'Operazione non confermata. Non creare un nuovo piano per aggirare l’errore; puoi riprovare la stessa richiesta.';
  const update = () => {inspect.disabled = busy || ready || newReady || creationAttempted; resume.disabled = busy || !ready;
    previewNew.disabled = busy || ready || newReady || creationAttempted; create.disabled = busy || !newReady || creationAttempted || stagingNeeded || selectionNeeded;
    stage.disabled = busy || !newReady || !stagingNeeded || creationAttempted || selectionNeeded;
    selectMissing.disabled = busy || !selectionNeeded || creationAttempted;
    selectExplicit.disabled = busy || !selectionNeeded || creationAttempted || !selectedInputs.size;
    cleanup.disabled = busy || ready || newReady || creationAttempted;
    recover.disabled = busy || !creationAttempted || ready;
    for (const input of [plan, file, key]) input.disabled = busy || ready || newReady || creationAttempted;};
  inspect.addEventListener('click', async () => {
    if (closed || busy || ready || newReady || creationAttempted) return;
    busy = true; update();
    try {
      const pending = source.prepare({file: file.files?.[0], recoveryKey: key.value, planId: plan.value.trim()});
      wipe(); const report = await pending; if (closed) return;
      ready = true; status.textContent = `${report.applied}/${report.total} blocchi già confermati. La ripresa ricontrolla le versioni sul server; i blocchi non confermati non sono automaticamente autorizzati.`;
    } catch (error) {if (!closed) status.textContent = explain(error);}
    finally {busy = false; if (!closed) update();}
  }, {signal: events.signal});
  resume.addEventListener('click', async () => {
    if (closed || busy || !ready) return;
    busy = true; update();
    try {
      const result = await source.resume(); if (closed) return;
      if (result?.status === 'completed') {status.textContent = 'Ripresa completata nel laboratorio isolato.'; ready = false; source.dispose(); inspect.disabled = true; resume.disabled = true; return;}
      status.textContent = 'Ripresa interrotta: almeno un blocco non è stato applicato. Nessuna chiusura dichiarata.';
    } catch (error) {if (!closed) status.textContent = explain(error);}
    finally {busy = false; if (!closed && ready) update();}
  }, {signal: events.signal});
  cancel.addEventListener('click', dispose, {signal: events.signal});
  previewNew.addEventListener('click', async () => {
    if (closed || busy || ready || newReady || creationAttempted) return;
    busy = true; update();
    try {
      const pending = source.previewNew({file: file.files?.[0], recoveryKey: key.value}); wipe();
      const report = await pending; if (closed) return;
      newReady = true; stagingNeeded = report.attachments > 0;
      selectionNeeded = report.existing > 0;
      clearChoices();
      if (report.excludedSecuritySettings > 0) choices.append(make('p',
        'Le impostazioni di sicurezza del backup sono escluse. Le impostazioni di sicurezza attuali vengono mantenute.'));
      if (selectionNeeded && typeof source.selectRecords === 'function') {
        choices.append(make('p','Seleziona soltanto le voci da recuperare. Le voci esistenti selezionate saranno sostituite con quelle del backup; modifiche successive all’anteprima bloccano il ripristino.'));
        for (const item of report.choices || []) {
          const label = make('label',`${item.scope} / ${item.id} — ${item.status}`), input = document.createElement('input');
          input.type = 'checkbox'; input.checked = false; selectedInputs.set(item.key,input); label.append(input); choices.append(label);
        }
      }
      status.textContent = selectionNeeded
        ? `${report.existing} record esistono già. Conserva gli esistenti oppure seleziona esplicitamente le voci da recuperare. Nessun piano creato e nessuna sovrascrittura eseguita.`
        : stagingNeeded
        ? `${report.records} record e ${report.attachments} allegati. Conferma prima il caricamento degli allegati nel laboratorio; nessun record sarà ripristinato.`
        : `${report.records} record assenti, ${report.chunks} blocchi nel laboratorio. Conferma la creazione del piano; questa azione non ripristina ancora i record.`;
    } catch (error) {if (!closed) status.textContent = /EXISTING_RECORDS/.test(error.message)
      ? 'Esistono record nel laboratorio: serve una selezione esplicita, non ancora disponibile in questa vista. Nessuna sovrascrittura.' : explain(error);}
    finally {busy = false; if (!closed) update();}
  }, {signal: events.signal});
  create.addEventListener('click', async () => {
    if (closed || busy || !newReady || creationAttempted || stagingNeeded || selectionNeeded) return;
    busy = true; creationAttempted = true; update();
    try {
      const result = await source.create(); if (closed) return;
      plan.value = result.planId; newReady = false; ready = true;
      status.textContent = `Piano ${result.planId} creato. Conserva questo ID per la ripresa. Premi Conferma ripresa per eseguire soltanto nel laboratorio isolato.`;
    } catch (error) {if (!closed) status.textContent = /DEPENDENCY_CROSS_CHUNK|TIMESTAMP_PRECISION_UNSUPPORTED|(?:WIDGET|ATTACHMENT)_PARENT_MISSING|WIDGET_BANK_MISSING/.test(error.message)
      ? explain(error)
      : 'Creazione non confermata: il piano potrebbe esistere. Nessun retry o secondo piano automatico; conserva il backup. Non è stato richiesto il ripristino.';}
    finally {busy = false; if (!closed) update();}
  }, {signal: events.signal});
  recover.addEventListener('click', async () => {
    if (closed || busy || !creationAttempted || ready) return;
    busy = true; update();
    try {
      const result = await source.recoverCreation(); if (closed) return;
      if (result.status === 'found') {
        plan.value = result.planId; newReady = false; ready = true;
        status.textContent = `Piano ${result.planId} ritrovato senza modificarlo. Puoi confermare la ripresa.`;
      } else status.textContent = 'Esito ancora non confermato. Nessun nuovo piano creato e nessun ripristino avviato.';
    } catch (error) {if (!closed) status.textContent = explain(error);}
    finally {busy = false; if (!closed) update();}
  }, {signal: events.signal});
  stage.addEventListener('click', async () => {
    if (closed || busy || !newReady || !stagingNeeded || creationAttempted || selectionNeeded) return;
    busy = true; update();
    try {
      const result = await source.stageAttachments(); if (closed) return;
      stagingNeeded = false; status.textContent = `${result.staged} allegati verificati. Puoi confermare la creazione del piano; nessun record ripristinato.`;
    } catch (error) {if (!closed) status.textContent = error.code === 'GENERATION_UNSUPPORTED' || /GENERATION_UNSUPPORTED/.test(error.message)
      ? explain(error) : 'Caricamento non confermato. Puoi riprovare la stessa operazione: gli allegati già verificati non vengono ricaricati. Il piano non è stato creato.';}
    finally {busy = false; if (!closed) update();}
  }, {signal: events.signal});
  cleanup.addEventListener('click', async () => {
    if (closed || busy || ready || newReady || creationAttempted) return;
    busy = true; update();
    try {
      const result = await source.cleanupExpired(cleanupAfter); if (closed) return;
      cleanupAfter = result.next;
      status.textContent = `${result.removed} piani scaduti rimossi, ${result.retained} conservati, ${result.rejected} non verificabili lasciati intatti. Dati ripristinati, allegati e ricevute non eliminati.${cleanupAfter ? ' Premi ancora per la pagina successiva.' : ' Scansione terminata.'}`;
    } catch {if (!closed) status.textContent = 'Pulizia non confermata. Puoi riprovare la stessa pagina; non vengono eliminati piani attivi o dati ripristinati.';}
    finally {busy = false; if (!closed) update();}
  }, {signal: events.signal});
  selectMissing.addEventListener('click', () => {
    if (closed || busy || !selectionNeeded || creationAttempted) return;
    try {
      const report = source.selectMissingOnly(); selectionNeeded = false; stagingNeeded = report.attachments > 0;
      clearChoices();
      status.textContent = `${report.records} record mancanti selezionati; gli esistenti saranno conservati. ${stagingNeeded ? 'Conferma ora il caricamento degli allegati selezionati.' : 'Puoi confermare la creazione del piano.'}`;
    } catch (error) {status.textContent = explain(error);}
    update();
  }, {signal: events.signal});
  selectExplicit.addEventListener('click', () => {
    if (closed || busy || !selectionNeeded || creationAttempted) return;
    try {
      const keys = [...selectedInputs].filter(([,input]) => input.checked).map(([key]) => key);
      const report = source.selectRecords(keys,'RESTORE_SELECTED_OVERWRITE');
      selectionNeeded = false; stagingNeeded = report.attachments > 0; clearChoices();
      status.textContent = `${report.records} record selezionati. Gli altri restano invariati. ${stagingNeeded?'Conferma il caricamento degli allegati selezionati.':'Puoi creare il piano; il ripristino richiede ancora conferma separata.'}`;
    } catch(error) {status.textContent = /SELECTION_INVALID/.test(error.message)?'Seleziona almeno una voce da recuperare.':explain(error);}
    update();
  }, {signal: events.signal});
  context.signal.addEventListener('abort', dispose, {once: true});
  try {context.assertUnlocked(); if (context.signal.aborted) throw Error('VIEW_DISPOSED'); root.append(host);}
  catch (error) {dispose(); throw error;}
  return dispose;
}
