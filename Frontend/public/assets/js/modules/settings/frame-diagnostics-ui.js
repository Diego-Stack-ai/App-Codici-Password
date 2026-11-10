import {t,tf} from '../../translations.js';
import {createElement,setChildren} from '../../dom-utils.js';
import {showToast} from '../../ui-core-v129.js';
import {inactivityDiagnosticTimeout} from '../../inactivity-timer.js';
import {loadFrameDiagnostics} from '../../frame-navigation.js';
import {frameDiagnostics,frameDiagnosticReport,notificationWorkerReady,observeFrameDiagnostics,frameDiagnosticContext} from '../core/vault-frame-diagnostics-runtime.js';
export function setupFrameDiagnostics() {
  const root=document.getElementById('frame-diagnostics-panel'), toggle=document.getElementById('frame-diagnostics-toggle');
  if(!root||!toggle)return;
  const summary=document.getElementById('frame-diagnostics-summary'), count=document.getElementById('frame-diagnostics-count');
  let disposed=false, pushReady=false;
  observeFrameDiagnostics();const boot=loadFrameDiagnostics().catch(()=>null);
  const report=()=>frameDiagnosticReport({idleMs:inactivityDiagnosticTimeout(),pushReady});
  const yes=value=>t(value?'frame_diag_yes':'frame_diag_no');
  const render=()=>{
    if(disposed)return;
    const value=report(), state=value.state;toggle.checked=value.enabled;
    const date=state.permitExpiresAt?new Date(state.permitExpiresAt).toLocaleString():t('frame_diag_unavailable');
    const rows=[['frame_diag_version',state.version],['frame_diag_active',yes(state.active)],['frame_diag_permit',yes(state.permitValid)],
      ['frame_diag_expiry',date],['frame_diag_idle',state.idleMs===null?t('frame_diag_unavailable'):String(state.idleMs/60000)+' min'],
      ['frame_diag_worker',yes(state.pushReady)],['frame_diag_last_lock',state.lastBlock||t('frame_diag_none')]];
    setChildren(summary,...rows.map(([label,text])=>createElement('div',{className:'diagnostics-sample'},[
      createElement('strong',{textContent:t(label)}),createElement('span',{textContent:text})])));
    count.textContent=value.available?tf('frame_diag_count',{count:value.events.length}):t('frame_diag_unavailable');
    document.getElementById('btn-copy-frame-diagnostics').disabled=!frameDiagnosticContext().ready;
  };
  toggle.addEventListener('change',()=>{if(!frameDiagnostics.setEnabled(toggle.checked))showToast(t('frame_diag_unavailable'),'error');render();});
  document.getElementById('btn-clear-frame-diagnostics').addEventListener('click',()=>{frameDiagnostics.clear();render();});
  document.getElementById('btn-copy-frame-diagnostics').addEventListener('click',()=>{
    if(!frameDiagnosticContext().ready)return;
    void navigator.clipboard.writeText(JSON.stringify(report(),null,2)).then(()=>showToast(t('dyn_technical_report_copied'),'success'))
      .catch(()=>showToast(t('dyn_copy_unavailable'),'error'));
  });
  const onChange=()=>render();
  for(const name of ['frame-diagnostics-changed','app-language-applied','private-auth-blocked'])window.addEventListener(name,onChange);
  const timer=setInterval(render,2000);
  window.addEventListener('pagehide',()=>{disposed=true;clearInterval(timer);for(const name of ['frame-diagnostics-changed','app-language-applied','private-auth-blocked'])window.removeEventListener(name,onChange);},{once:true});
  render();void boot.then(()=>notificationWorkerReady()).then(ready=>{if(!disposed){pushReady=ready;render();}});
}
