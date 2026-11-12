import {fail} from './c1-e2e-contract.mjs';

// Real production port waits wall-clock time. Only unit tests inject a synthetic port.
// No clock scaling option exists in CLI/environment/workflow.
export async function timerCase(port,minutes){
  const idle=minutes*60000,grace=12000;
  await port.timerStart(minutes); // saved preference + diagnostic confirmation, innocent trusted key
  await port.wait(idle*.6);
  await port.assertUnlocked('impostazioni.html');
  await port.trustedActivity();
  await port.wait(idle*.6);
  await port.assertUnlocked('impostazioni.html'); // beyond original expiry: activity must have renewed
  await port.passiveBack(); // no child click: navigation must not renew
  await port.wait(idle*.45+grace,{allowExpectedExpiry:true});
  if(!await port.isLocked())fail('C1_TIMEOUT_NOT_LOCKED');
  await port.resumeExpectedOnce();
}
export async function runPriorityC1(port,record,onStart=()=>{}){
  onStart('D02');
  await port.ensureHome();
  await port.visit('#header-user-avatar','profilo_privato.html');
  await port.ensureHome();
  await port.visit('a[href="area_privata.html"]','area_privata.html');
  await port.visit('a[href="account_privati.html?type=standard"]','account_privati.html?type=standard');
  await port.ensureHome();
  await port.visit('a[href="scadenze.html?filter=in_scadenza"]','scadenze.html?filter=in_scadenza');
  await port.ensureSettings();
  await port.visit('#btn-account-archive','archivio_account.html');
  await port.ensureSettings();
  await port.visit('#btn-expiry-rules','regole_scadenze.html');
  const documentLink=await port.hasDocumentConfigurationLink();
  if(documentLink){
    await port.visit('a[href="configurazione_documenti.html"]','configurazione_documenti.html');
    await port.ensureSettings();
    await port.visit('#btn-expiry-rules','regole_scadenze.html');
  }
  await port.visit('a[href="gestione_destinatari.html"]','gestione_destinatari.html');
  await record('D02',documentLink?'PASS':'LIMITE',documentLink?null:'C1_CONFIG_DOC_ROUTE_UNAVAILABLE');

  onStart('D04-core');
  await port.ensureHome();
  await port.visit('#header-user-avatar','profilo_privato.html');
  await port.ensureHome();
  await port.visit('a[href="area_privata.html"]','area_privata.html');
  await port.visit('a[href="account_privati.html?type=standard"]','account_privati.html?type=standard');
  await port.back('area_privata.html');
  await port.forward('account_privati.html?type=standard');
  await port.visit('#header-left .btn-icon-header','area_privata.html');
  await record('D04-core','PASS',null);

  onStart('D05-A');
  await port.ensureHome();
  await port.visit('a[href="area_privata.html"]','area_privata.html');
  await port.visit('a[href="account_privati.html?type=standard"]','account_privati.html?type=standard');
  await port.reloadExpectedOnce();
  await record('D05-A','PASS',null);

  onStart('D06-1');
  await port.ensureSettings();
  if(await port.idleMs()!==180000)fail('C1_TIMEOUT_BASELINE');
  for(const minutes of [1,3]){
    onStart('D06-'+minutes);
    await timerCase(port,minutes);
    await record('D06-'+minutes,'PASS',null);
  }
  // Second case saved/restored the approved original 3-minute preference.
  onStart('D08-local');
  await port.ensureHome();
  const before=await port.collectDiag();
  await port.logoutLocal();
  await record('D08-local','PASS',null,before); // capture precedes intentional DIAG cleanup
}
