import {createPrivateUtilitiesEditorSource} from './private-utilities-editor-source.mjs';
import {mountPrivateUtilitiesEditor} from './private-utilities-editor-view.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';
export async function mountPrivateUtilitiesEditorProvider(root, context, options) {
    const source=createPrivateUtilitiesEditorSource({context,...options});
    try {const cleanup=await mountPrivateUtilitiesEditor(root,context,{load:()=>source.load(),createId:()=>source.createId(),onSaved:options.onSaved,onLink:options.onLink,
        createController:({onState})=>createQrSelectionSaveController({context,getUser:options.getUser,onState,prepare:(draft,id)=>source.prepare(draft,id),submit:options.submit,
            createRequest:(prepared,operationId)=>{if(prepared.operationId!==operationId)throw Error('OPERATION_CHANGED');return prepared;}})});
        return()=>{try{cleanup();}finally{source.dispose();}};}catch(error){source.dispose();throw error;}
}
