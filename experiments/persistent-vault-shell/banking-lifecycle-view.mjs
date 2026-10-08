import {BANK_EDIT_FIELDS,CARD_EDIT_FIELDS,BANK_EDIT_SECRETS} from './banking-edit-contract.mjs';

export function mountBankingLifecycle(root,context,{source,action,bankId,cardIndex=null,onSaved=()=>{}}) {
  const create=action.startsWith('create'),bank=action.endsWith('bank'),host=document.createElement('section');
  const events=new AbortController(),inputs=new Map();let closed=false,busy=false,plan;
  const make=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
  const wipe=()=>{for(const input of inputs.values())input.value='';};
  const dispose=()=>{if(closed)return;closed=true;events.abort();wipe();plan=null;source.dispose();host.remove();
    context.signal.removeEventListener('abort',dispose);};
  context.signal.addEventListener('abort',dispose,{once:true});
  try {
    context.assertUnlocked();if(context.signal.aborted)throw Error('VIEW_DISPOSED');
    host.append(make('h3',`${create?'Aggiungi':'Elimina'} ${bank?'conto bancario':'carta'}`));
    if(create)for(const field of bank?BANK_EDIT_FIELDS:CARD_EDIT_FIELDS) {
      const label=make('label',field),input=document.createElement('input');
      input.type=BANK_EDIT_SECRETS.includes(field)?'password':'text';input.autocomplete='off';input.value=field==='type'?'Credit':'';
      inputs.set(field,input);label.append(input);host.append(label);
    }
    else host.append(make('p',bank?'Conferma la rimozione del conto e delle sue carte. I widget collegati impediscono la rimozione.':'Conferma la rimozione della carta selezionata.'));
    const confirm=make('button',create?'Conferma creazione':'Conferma eliminazione'),cancel=make('button','Annulla'),status=make('p','');
    confirm.type=cancel.type='button';status.setAttribute('role','status');host.append(confirm,cancel,status);root.append(host);
    cancel.addEventListener('click',dispose,{signal:events.signal});
    confirm.addEventListener('click',async()=>{
      if(closed||busy)return;busy=true;confirm.disabled=true;
      try {
        if(!plan) {
          plan=await source.prepare(action,{bankId,cardIndex,values:create?Object.fromEntries([...inputs].map(([key,input])=>[key,input.value])):null});
          if(closed)return;wipe();for(const input of inputs.values())input.disabled=true;
        }
        const result=await source.send(plan);if(closed)return;
        if(result?.status!=='confirmed')throw Error('BANK_LIFECYCLE_UNCONFIRMED');
        dispose();await onSaved();
      } catch(error) {
        if(!closed)status.textContent=String(error?.message).includes('WIDGETS_PRESENT')?'Sposta o elimina prima i widget collegati.':
          plan?'Esito non confermato. Riprova la stessa operazione.':'Operazione non preparata: verifica i dati o riapri il conto.';
      } finally {busy=false;if(!closed)confirm.disabled=false;}
    },{signal:events.signal});
    return dispose;
  } catch(error){dispose();throw error;}
}
