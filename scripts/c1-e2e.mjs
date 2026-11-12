import {C1_PROFILES,safeFailure} from './lib/c1-e2e-contract.mjs';
import {C1_PRIORITY_CASES,authorizeC1,readQa2Secrets} from './lib/c1-e2e-execution.mjs';

const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--help'){
 console.log(JSON.stringify({help:'--list is inert. --production requires protected manual GitHub dispatch, reviewed runner SHA, release SHA/version, Diego approval and explicit QA2 preflight/effects acknowledgements. No URL, UID, credential or clock override arguments.'}));
}else if(args.length===1&&args[0]==='--list'){
 console.log(JSON.stringify({mode:'prepared-not-executed',cases:C1_PRIORITY_CASES,profiles:C1_PROFILES,
  knownLimit:'D02 configuration documents needs an actual UI link; never inject or goto it',productionReady:false}));
}else if(args.length===1&&args[0]==='--production'){
 try{
  const config=authorizeC1(process.env);
  const secrets=readQa2Secrets(process.env);
  const {runAuthorizedC1}=await import('./lib/c1-e2e-runner.mjs');
  const report=await runAuthorizedC1(config,secrets,process.env);
  console.log(JSON.stringify(report));
  if(report.code)process.exitCode=2;
 }catch(error){
  console.log(JSON.stringify({code:safeFailure(error),wrote:false,network:false}));
  process.exitCode=2;
 }
}else{
 console.log(JSON.stringify({code:args.length?'C1_OPTIONS_INVALID':'C1_EXECUTION_NOT_AUTHORIZED',wrote:false,network:false}));
 process.exitCode=2;
}
