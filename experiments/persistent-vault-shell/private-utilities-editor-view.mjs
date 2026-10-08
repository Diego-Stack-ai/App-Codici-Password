const MESSAGE = {UTILITY_ID_MISSING: 'Utenza senza ID persistito: sola consultazione.',
    UTILITY_ID_DERIVED: 'Identità derivata: sola consultazione.', PROFILE_UTILITY_LINKED: 'Collegata a un Account: scollega prima di eliminarla.'};
export async function mountPrivateUtilitiesEditor(root, context, {load, createId, createController, onSaved, onLink}) {
    const host = document.createElement('section'), list = document.createElement('div'), actions = document.createElement('div');
    const status = document.createElement('p'), controls = new AbortController(), rows = [], retained = [host, status];
    host.dataset.utilitiesEditor = 'true'; status.dataset.utilityStatus = 'true'; let disposed = false, controller, canSave = false, templates;
    const check = () => {if (disposed || context.signal.aborted) throw Error('VIEW_DISPOSED'); context.assertUnlocked();};
    const dispose = () => {if (disposed) return; disposed = true; controls.abort(); controller?.dispose();
        for (const node of retained) {if (typeof node.value === 'string') node.value = ''; if (node !== host) node.textContent = '';} host.remove();};
    context.signal.addEventListener('abort', dispose, {once: true});
    const add = ({id, fields, editable = true, blocked = null, linked = false, linkOrigin = null, created = false}) => {
        const set = document.createElement('fieldset'), row = {id, entries: [], created, removed: false};
        set.dataset.utilityRow = 'true'; set.dataset.utilityId = id ?? ''; if (created) set.dataset.utilityNew = 'true';
        for (const field of fields) {const label = document.createElement('label'), span = document.createElement('span'), input = document.createElement('input');
            span.textContent = field.label; input.type = field.secret ? 'password' : 'text'; input.value = field.value ?? ''; input.defaultValue = input.value;
            input.maxLength = field.maxLength; input.disabled = !canSave || !editable; input.readOnly = !canSave || !editable; input.dataset.utilityField = field.key;
            input.setAttribute('autocomplete','off'); label.append(span,input); set.append(label); row.entries.push({key: field.key,input,original: input.value}); retained.push(input,span,label);}
        const message = document.createElement('p'); message.dataset.utilityMessage = 'true';
        const refusal = !editable ? MESSAGE[blocked] : linked ? MESSAGE.PROFILE_UTILITY_LINKED : null; if (refusal) message.textContent = refusal;
        const remove = document.createElement('button'); remove.type='button'; remove.dataset.utilityAction='delete'; remove.textContent='Elimina'; remove.disabled=!canSave||Boolean(refusal);
        remove.addEventListener('click',()=>{try{check(); if(remove.disabled)return; if(created){set.remove(); rows.splice(rows.indexOf(row),1); return;}
            if(remove.dataset.confirm!=='true'){remove.dataset.confirm='true';remove.textContent='Conferma eliminazione';return;} row.removed=true;set.hidden=true;}catch{}},{signal:controls.signal});
        if (linkOrigin && typeof onLink === 'function') for (const [label,mode] of linked?[['Cambia Account','change'],['Scollega Account','unlink']]:[['Collega Account','change']]) {
            const button=document.createElement('button');button.type='button';button.dataset.utilityLink=mode;button.textContent=label;
            button.addEventListener('click',()=>{try{check();onLink({source:linkOrigin,mode});}catch{}},{signal:controls.signal});set.append(button);retained.push(button);}
        set.append(message,remove);list.append(set);rows.push(row);retained.push(set,message,remove);return row;
    };
    const model=await load();check();canSave=model.canSave;templates=model.templates;for(const row of model.rows)add(row);
    const button=(name,label)=>{const node=document.createElement('button');node.type='button';node.dataset.utilityAction=name;node.textContent=label;actions.append(node);retained.push(node);return node;};
    const addButton=button('add','Aggiungi utenza'),save=button('save','Salva utenze'),retry=button('retry','Riprova salvataggio');retry.hidden=true;addButton.disabled=save.disabled=!canSave;
    addButton.addEventListener('click',()=>{try{check();add({id:createId(),fields:templates,created:true});}catch{}},{signal:controls.signal});
    controller=createController({onState:({status:state})=>{if(disposed)return;save.disabled=!canSave||state!=='idle';retry.hidden=state!=='unknown';status.textContent={saving:'Salvataggio in corso…',saved:'Utenze salvate.',unknown:'Esito non confermato: riprova.',invalid:'Dati cambiati: riapri la sezione.'}[state]||'';}});
    const draft=()=>{const creates=[],updates=[],deletes=[];for(const row of rows){if(row.removed){if(!row.created)deletes.push({id:row.id});continue;}const fields={};for(const entry of row.entries)if((row.created&&entry.input.value!=='')||(!row.created&&entry.input.value!==entry.original))fields[entry.key]=entry.input.value;if(Object.keys(fields).length)(row.created?creates:updates).push({id:row.id,fields});}return{creates,updates,deletes};};
    const act=async fn=>{try{check();const result=await fn();check();if(result?.status==='saved')await onSaved();}catch{if(!disposed)status.textContent='Operazione non disponibile. Riapri la sezione.';}};
    save.addEventListener('click',()=>void act(()=>controller.save(draft())),{signal:controls.signal});retry.addEventListener('click',()=>void act(()=>controller.retry()),{signal:controls.signal});
    if(!canSave)status.textContent='Utenze disponibili offline in sola consultazione.';host.append(list,actions,status);root.append(host);return dispose;
}
