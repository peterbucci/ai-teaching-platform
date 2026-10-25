/** READ ONLY after-restart reconciliation; NEVER restarts a container or releases the retained owner lock.
 * node reconcile-journey-persistence.mjs <state> <fresh-out> <failed-report.json> <before.json> <reviewed-safety.mjs>
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const [stateArg,outArg,failureArg,beforeArg,safetyArg]=process.argv.slice(2);
for(const value of [stateArg,outArg,failureArg,beforeArg,safetyArg])assert.ok(value);
const state=resolve(stateArg),out=resolve(outArg),failurePath=resolve(failureArg),beforePath=resolve(beforeArg);
const SHA='07efb7f821339538800f150f57b298eb2e606be3',TREE='948b9a6005a056c97f10d181c589b5352d6221f3';
const project='lp-v22-final-01a173d6',db=project+'-db-1',app=project+'-app-1',volume=project+'_postgres_data';
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const stable=value=>JSON.stringify(canonical(value));
const mountSet=mounts=>{assert.equal(new Set(mounts.map(m=>m.Destination)).size,mounts.length,'Mount destinations must be unique');return mounts.map(canonical).sort((a,b)=>a.Destination.localeCompare(b.Destination));};
assert.equal(existsSync(out),false,'Preserve every earlier report; choose a fresh output directory');
const failureBytes=readFileSync(failurePath),beforeBytes=readFileSync(beforePath);
assert.equal(hash(failureBytes),'5968c4545087b076a6498d29e40d38d335a7959a7e2444f6f682a9b51e32d804');
assert.equal(hash(beforeBytes),'71f906f41a9fb5fd4f8aef5a40f08c744713a5327dfbfd603386c079f1b653c1');
const prior=JSON.parse(failureBytes),before=JSON.parse(beforeBytes);
assert.equal(prior.status,'failed-after-restart');assert.equal(prior.restartDispatched,true);assert.equal(prior.lockRetained,true);
assert.match(prior.error,/deep-equal/);assert.match(prior.error,/Destination/);
assert.equal(prior.sourceSha,SHA);assert.equal(prior.sourceTree,TREE);assert.equal(prior.project,project);assert.equal(prior.origin,'http://localhost:3396');
assert.equal(hash(stable(before)),prior.beforeSha256);
const groups=['source_document','source_version','lesson','published_version','assignment','sessions','attempts','evaluations','assistance_records','private_draft','generation_requests','approval','delivery','recipients','followup_links','followup_evaluation_requests','intervention_actions'];
assert.deepEqual(Object.keys(before).sort(),[...groups].sort());
assert.ok(prior.checks.some(v=>v.id==='BEFORE'&&v.status==='passed'));
const restarts=prior.commands.filter(v=>v.args[0]==='restart');assert.equal(restarts.length,1);assert.equal(restarts[0].exitCode,0);assert.equal(restarts[0].error,null);
assert.deepEqual(restarts[0].args,['restart','--time','10',db]);
const snapshotArgs=prior.commands.find(v=>v.label==='before')?.args;
assert.deepEqual(snapshotArgs?.slice(0,-1),['exec',db,'psql','-X','-q','-A','-t','-U','postgres','-d','learning_platform','-v','ON_ERROR_STOP=1','-c']);
const query=snapshotArgs.at(-1);
assert.ok(query.startsWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT jsonb_build_object('));
assert.ok(query.endsWith('); COMMIT;'));assert.equal(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|COPY|CALL|DO)\b/i.test(query),false);
assert.equal(query.split(';').length,4,'Use exactly the prior bounded read-only transaction');
const parseIdentity=text=>{const fields=text.trim().split('|');assert.equal(fields.length,10);return{id:fields[0],name:fields[1],configuredImage:fields[2],imageId:fields[3],project:fields[4],service:fields[5],status:fields[6],health:fields[7],startedAt:fields[8],mounts:JSON.parse(fields[9])};};
const healthBytes=readFileSync(join(dirname(failurePath),'07-db-health-02.log'));
assert.equal(hash(healthBytes),'80a88486da1660674d09948e3770a84e3be51b7e870e3d3a29e3decc9cc60224');
const historicalAfter=parseIdentity(healthBytes.toString('utf8'));
assert.equal(historicalAfter.health,'healthy');assert.equal(historicalAfter.id,prior.identityBefore.db.id);
assert.notEqual(historicalAfter.startedAt,prior.identityBefore.db.startedAt);
assert.deepEqual(mountSet(historicalAfter.mounts),mountSet(prior.identityBefore.db.mounts),'Only enumeration order may differ in the retained failure');
const manifest=JSON.parse(readFileSync(join(state,'manifest.json'),'utf8'));
assert.equal(manifest.sourceSha,SHA);assert.equal(manifest.sourceTree,TREE);assert.equal(manifest.project,project);assert.equal(manifest.origin,prior.origin);
assert.equal(manifest.paidModelCallsAuthorized,false);assert.match(manifest.configurationCategory,/provider-disabled/);
const config=JSON.parse(readFileSync(join(state,'compose.json'),'utf8'));
assert.equal(config.services.app.image,project+':'+SHA);assert.equal(config.services.db.image,'postgres:17.11-bookworm');assert.equal(config.networks.acceptance.internal,true);
const env=Object.fromEntries(readFileSync(join(state,'.env.acceptance'),'utf8').split(/\r?\n/).filter(Boolean).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
assert.equal(env.PGDATABASE,'learning_platform');for(const key of ['OPENAI_API_KEY','OPENAI_MODEL'])assert.equal(env[key],'');
for(const [ref,expected] of [['HEAD',SHA],['HEAD^{tree}',TREE]]){const got=spawnSync('git',['-C',manifest.source,'rev-parse',ref],{encoding:'utf8',windowsHide:true});assert.equal(got.status,0);assert.equal(got.stdout.trim(),expected);}
assert.equal(hash(readFileSync(safetyArg)),'af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485');
const {preflight,MIN_RUNTIME_GIB,LOCK_PATH}=await import(pathToFileURL(resolve(safetyArg)).href);
assert.equal(prior.lockOwner.token,'18b4376c-1a15-4446-8b9b-3a78f1f41f72');assert.equal(prior.lockOwner.pid,88056);
function verifyRetainedOwner(){const current=JSON.parse(readFileSync(join(LOCK_PATH,'owner.json'),'utf8'));assert.deepEqual(current,prior.lockOwner,'The exact retained owner must still hold the guard; never take over another lock');return current;}
verifyRetainedOwner();
let oldProcessAlive=true;try{process.kill(prior.lockOwner.pid,0);}catch(error){if(error.code==='ESRCH')oldProcessAlive=false;else throw error;}
assert.equal(oldProcessAlive,false,'Original restart helper must have exited before its owner runs reconciliation');
mkdirSync(out);
const report={status:'running',sourceSha:SHA,sourceTree:TREE,project,origin:manifest.origin,startedAt:new Date().toISOString(),
 priorFailureSha256:hash(failureBytes),beforeFileSha256:hash(beforeBytes),beforeSha256:prior.beforeSha256,inputSha256:prior.inputSha256,
 harnessSha256:hash(readFileSync(new URL(import.meta.url))),querySha256:hash(query),scope:prior.scope,lockOwner:prior.lockOwner,
 lockRetained:true,lockReleasePerformed:false,restartPerformed:false,restartCommands:0,originalRestartSucceeded:true,
 method:'Read-only reconciliation under the unchanged retained owner lock: exact historical identities; full mount objects sorted only by Destination; exact same repeatable-read READ ONLY 17-group SQL; complete saved-record comparison.',
 restrictions:['No Docker restart or daemon operation','No application or database mutations','No model calls','No cleanup or lock release','No timestamp or quota changes'],
 limitations:['Direct database persistence verification; no authenticated post-restart browser journey is claimed'],
 checks:[],commands:[],safety:[],actualModelCalls:0};
const save=()=>writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flush:true});save();
function guard(label){verifyRetainedOwner();const observation=preflight({source:manifest.source,state,minimumGiB:MIN_RUNTIME_GIB,explicitPath:manifest.dockerDataPath||undefined,probeContainer:manifest.storageProbeContainer||undefined});report.safety.push({label,...observation});save();assert.equal(observation.pass,true,'Reviewed runtime preflight must pass');}
function run(label,args){
 assert.ok(['container','image','exec'].includes(args[0]),'Only read-only inspection or exact snapshot is allowed');
 if(args[0]==='exec')assert.deepEqual(args,snapshotArgs,'The only executable container operation is the exact prior READ ONLY SQL');
 else if(args[0]==='container')assert.ok(args[1]==='inspect'&&[db,app].includes(args[2]));
 else assert.deepEqual(args,['image','inspect',project+':'+SHA,'--format','{{.Id}}']);
 guard(label);const receipt={label,args,startedAt:new Date().toISOString()};report.commands.push(receipt);save();
 const result=spawnSync('docker',args,{encoding:'utf8',timeout:30000,windowsHide:true,maxBuffer:10*1024*1024});
 receipt.exitCode=result.status;receipt.error=result.error?.message??null;receipt.finishedAt=new Date().toISOString();
 const log=String(report.commands.length).padStart(2,'0')+'-'+label+'.log';writeFileSync(join(out,log),(result.stdout??'')+(result.stderr??''),{flag:'wx'});receipt.log=log;save();
 assert.equal(result.error,undefined,label+' transport failure; preserve lock');assert.equal(result.status,0,label+' failure; preserve lock');verifyRetainedOwner();return result.stdout;
}
const inspect=(container,label)=>parseIdentity(run(label,['container','inspect',container,'--format','{{.Id}}|{{.Name}}|{{.Config.Image}}|{{.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.State.StartedAt}}|{{json .Mounts}}']));
function sameIdentity(current,expected){for(const key of ['id','name','configuredImage','imageId','project','service'])assert.equal(current[key],expected[key],key);assert.deepEqual(mountSet(current.mounts),mountSet(expected.mounts));}
try{
 const dbAfter=inspect(db,'db-identity-reconciled'),appAfter=inspect(app,'app-identity-reconciled');
 sameIdentity(dbAfter,prior.identityBefore.db);sameIdentity(dbAfter,historicalAfter);
 assert.equal(dbAfter.name,'/'+db);assert.equal(dbAfter.project,project);assert.equal(dbAfter.service,'db');assert.equal(dbAfter.configuredImage,config.services.db.image);
 assert.equal(dbAfter.status,'running');assert.equal(dbAfter.health,'healthy');assert.equal(dbAfter.startedAt,historicalAfter.startedAt,'No additional DB restart may intervene');assert.notEqual(dbAfter.startedAt,prior.identityBefore.db.startedAt);
 const dataMount=dbAfter.mounts.find(m=>m.Destination==='/var/lib/postgresql/data');assert.equal(dataMount.Type,'volume');assert.equal(dataMount.Name,volume);
 sameIdentity(appAfter,prior.identityBefore.app);assert.equal(appAfter.name,'/'+app);assert.equal(appAfter.project,project);assert.equal(appAfter.service,'app');
 assert.equal(appAfter.status,'running');assert.equal(appAfter.health,'healthy');assert.equal(appAfter.startedAt,prior.identityBefore.app.startedAt,'App must remain the same running process');
 const imageId=run('pinned-app-image',['image','inspect',project+':'+SHA,'--format','{{.Id}}']).trim();assert.equal(appAfter.imageId,imageId);
 report.identityBefore=prior.identityBefore;report.identityAfter={db:dbAfter,app:appAfter};report.mountComparison='Full mount objects equal after sorting unique Destination; no mount fields ignored';
 report.checks.push({id:'IDENTITY',status:'passed',sameDbContainer:true,samePrivateVolume:true,healthy:true,oneOriginalRestart:true,noAdditionalRestart:true,sameAppProcessAndImage:true});save();
 const after=JSON.parse(run('after-read-only-snapshot',snapshotArgs).trim());
 writeFileSync(join(out,'after.json'),JSON.stringify(after,null,2)+'\n',{flag:'wx'});
 assert.deepEqual(Object.keys(after).sort(),[...groups].sort());
 report.afterSha256=hash(stable(after));report.comparisons=groups.map(key=>({tableGroup:key,beforeSha256:hash(stable(before[key])),afterSha256:hash(stable(after[key])),equal:stable(before[key])===stable(after[key])}));save();
 assert.deepEqual(canonical(after),canonical(before),'Every scoped saved field must remain unchanged; no record fields or array entries are excluded');
 assert.equal(report.afterSha256,prior.beforeSha256);
 const finalDb=inspect(db,'db-final-health'),finalApp=inspect(app,'app-final-identity');sameIdentity(finalDb,dbAfter);sameIdentity(finalApp,appAfter);
 assert.equal(finalDb.startedAt,dbAfter.startedAt);assert.equal(finalDb.health,'healthy');assert.equal(finalDb.status,'running');
 assert.equal(finalApp.startedAt,appAfter.startedAt);assert.equal(finalApp.health,'healthy');assert.equal(finalApp.status,'running');
 report.checks.push({id:'PERSISTENCE',status:'passed',identicalTableGroups:17,allSavedFieldsUnchanged:true},{id:'NO_RESTART_REPLAY',status:'passed',newRestartCommands:0});
 report.status='passed';report.releaseRecommendation='Coordinator may release only the exact retained token after reviewing this passing report, both process exits, all17 equal groups and current owner. This helper performs no release.';
}catch(error){report.status='failed-read-only-reconciliation';report.error=String(error);report.releaseRecommendation='Keep the retained guard and reconcile read-only; do not restart, alter records or automatically retry.';process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,report:join(out,'report.json'),lockRetained:true,restartPerformed:false}));}
