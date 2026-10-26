/** OPTIONAL: verify already-completed same-journey records across ONLY this disposable project's DB restart.
 * node journey-persistence.mjs <runtime-final> <fresh-out> <final-linked-browser-report.json> <safety.mjs>
 * No application/service mutations, provider calls, seeding, migrations, cleanup or daemon/shared restart.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [stateArg,outArg,inputArg,safetyArg]=process.argv.slice(2);
for(const value of [stateArg,outArg,inputArg,safetyArg])assert.ok(value);
const state=resolve(stateArg),out=resolve(outArg),inputBytes=readFileSync(resolve(inputArg)),input=JSON.parse(inputBytes);
const SHA='07efb7f821339538800f150f57b298eb2e606be3',TREE='948b9a6005a056c97f10d181c589b5352d6221f3';
const project='lp-v22-final-01a173d6',db=project+'-db-1',app=project+'-app-1',volume=project+'_postgres_data';
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const stable=value=>JSON.stringify(canonical(value));
assert.equal(existsSync(out),false,'Fresh supplement directory required; preserve all prior outcomes');
assert.ok(['passed','failed-responsive'].includes(input.status));assert.equal(input.phase,'inspect-followup');
assert.equal(input.source_sha,SHA);assert.equal(input.source_tree,TREE);assert.equal(input.project,project);assert.equal(input.origin,'http://localhost:3396');
assert.equal(input.functional_completed_through,'teacher-inspected-accepted-linked-followup-with-explicit-synthetic-seams');
assert.deepEqual(input.mutations,[]);assert.deepEqual(input.blocked_context_writes,[]);
const prep=input.preparation,a=prep.authoring,comparison=input.comparison;
assert.equal(prep.status,'completed');assert.equal(prep.source_sha,SHA);assert.equal(prep.source_tree,TREE);
assert.equal(comparison.assignment_id,a.assignment_id);assert.equal(comparison.draft_id,prep.draft_id);assert.equal(comparison.approval_id,input.approval_id);
assert.deepEqual(comparison.content_ref,a.content_ref);assert.equal(comparison.counts.intended,1);assert.equal(comparison.counts.accepted,1);
assert.equal(comparison.recipients.length,1);const recipient=comparison.recipients[0];assert.equal(recipient.student_id,a.student_id);
assert.equal(recipient.followup.evaluation_status,'accepted');assert.equal(recipient.followup.evaluation_provenance,'injected_fixture');
assert.equal(recipient.followup.attempt_id,input.followup.attempt_id);assert.equal(recipient.followup.evaluation_id,input.followup.evaluation_id);
const uuid=value=>{assert.match(value||'',/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);return "'"+value+"'";};
const scope={source_id:a.source_id,source_version:a.source_version,lesson_id:a.lesson_id,published_version:a.published_version,
 assignment_id:a.assignment_id,student_id:a.student_id,original_session_id:a.student_session_id,original_attempt_id:a.presented_attempt_id,
 original_evaluation_id:prep.original_evaluation_id,draft_id:prep.draft_id,approval_id:input.approval_id,
 followup_session_id:recipient.session_id,followup_attempt_id:input.followup.attempt_id,followup_evaluation_id:input.followup.evaluation_id};
for(const [key,value] of Object.entries(scope))if(key.endsWith('_id'))uuid(value);
assert.ok(Number.isInteger(scope.source_version)&&scope.source_version>0);assert.match(String(scope.published_version),/^[1-9][0-9]{0,8}$/);
const manifest=JSON.parse(readFileSync(join(state,'manifest.json'),'utf8'));
assert.equal(manifest.sourceSha,SHA);assert.equal(manifest.sourceTree,TREE);assert.equal(manifest.project,project);assert.equal(manifest.origin,input.origin);
assert.equal(manifest.paidModelCallsAuthorized,false);assert.match(manifest.configurationCategory,/provider-disabled/);
const config=JSON.parse(readFileSync(join(state,'compose.json'),'utf8'));
assert.equal(config.services.app.image,project+':'+SHA);assert.equal(config.services.db.image,'postgres:17.11-bookworm');assert.equal(config.networks.acceptance.internal,true);
const env=Object.fromEntries(readFileSync(join(state,'.env.acceptance'),'utf8').split(/\r?\n/).filter(Boolean).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
assert.equal(env.PGDATABASE,'learning_platform');for(const key of ['OPENAI_API_KEY','OPENAI_MODEL'])assert.equal(env[key],'');
for(const [ref,expected] of [['HEAD',SHA],['HEAD^{tree}',TREE]]){const got=spawnSync('git',['-C',manifest.source,'rev-parse',ref],{encoding:'utf8',windowsHide:true});assert.equal(got.status,0);assert.equal(got.stdout.trim(),expected);}
assert.equal(hash(readFileSync(safetyArg)),'af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485');
const {acquireLock,preflight,MIN_RUNTIME_GIB,LOCK_PATH}=await import(pathToFileURL(resolve(safetyArg)).href);
mkdirSync(out);
const report={status:'prepared',sourceSha:SHA,sourceTree:TREE,project,origin:manifest.origin,inputSha256:hash(inputBytes),harnessSha256:hash(readFileSync(new URL(import.meta.url))),
 startedAt:new Date().toISOString(),scope,checks:[],commands:[],safety:[],actualModelCalls:0,
 method:'Direct PostgreSQL repeatable-read READ ONLY snapshots of already-completed fictional journey records; one verified private DB-container restart; exact stable JSON comparison. No new browser workflow or authorization behavior claimed.',
 limitations:['Application process identity is checked but this supplement does not perform an authenticated post-restart UI journey. Existing read-only original-result/inspect-followup helpers can be run afterward with fresh outputs.'],
 restrictions:['No application/service writes','No model calls','No migrations/reseed','No daemon/shared-container restart','No volume deletion or cleanup','No retry of restart on uncertain outcome']};
const save=()=>writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flush:true});save();
let release,restartDispatched=false,retain=false;
function guard(label){const observation=preflight({source:manifest.source,state,minimumGiB:MIN_RUNTIME_GIB,explicitPath:manifest.dockerDataPath||undefined,probeContainer:manifest.storageProbeContainer||undefined});report.safety.push({label,...observation});save();assert.equal(observation.pass,true,'Reviewed runtime storage guard stopped this supplement');}
function run(label,args,{restart=false,allowNonzero=false}={}){
 guard(label);const receipt={label,args,startedAt:new Date().toISOString()};report.commands.push(receipt);
 if(restart){assert.deepEqual(args,['restart','--time','10',db]);restartDispatched=true;report.restartDispatched=true;}save();
 const result=spawnSync('docker',args,{encoding:'utf8',timeout:30000,windowsHide:true,maxBuffer:10*1024*1024});
 receipt.exitCode=result.status;receipt.error=result.error?.message??null;receipt.finishedAt=new Date().toISOString();
 if(result.error||result.status===null){if(restartDispatched)retain=true;receipt.uncertain=true;save();throw Error(label+' transport/timeout outcome needs read-only reconciliation; do not replay restart');}
 const log=String(report.commands.length).padStart(2,'0')+'-'+label+'.log';writeFileSync(join(out,log),(result.stdout??'')+(result.stderr??''),{flag:'wx'});receipt.log=log;save();
 if(!allowNonzero&&result.status!==0){if(restartDispatched)retain=true;throw Error(label+' failed with exit '+result.status);}
 return result;
}
function inspect(container,label){
 const result=run(label,['container','inspect',container,'--format','{{.Id}}|{{.Name}}|{{.Config.Image}}|{{.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.State.StartedAt}}|{{json .Mounts}}']);
 const fields=result.stdout.trim().split('|');assert.equal(fields.length,10);
 return {id:fields[0],name:fields[1],configuredImage:fields[2],imageId:fields[3],project:fields[4],service:fields[5],status:fields[6],health:fields[7],startedAt:fields[8],mounts:JSON.parse(fields[9])};
}
const scalar=(table,where)=>`(SELECT to_jsonb(t) FROM public.${table} t WHERE ${where})`;
const rows=(table,where,order='id')=>`(SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY ${order}),'[]'::jsonb) FROM public.${table} t WHERE ${where})`;
const sessionIds=[scope.original_session_id,scope.followup_session_id].map(uuid).join(',');
const attemptScope=`session_id IN (${sessionIds})`;
const expressions={
 source_document:scalar('source_documents','id='+uuid(scope.source_id)),
 source_version:scalar('source_versions','document_id='+uuid(scope.source_id)+' AND version='+scope.source_version),
 lesson:scalar('lessons','id='+uuid(scope.lesson_id)),
 published_version:scalar('lesson_versions','lesson_id='+uuid(scope.lesson_id)+" AND version='"+scope.published_version+"'"),
 assignment:scalar('assignments','id='+uuid(scope.assignment_id)),
 sessions:rows('sessions',`id IN (${sessionIds})`),attempts:rows('attempts',attemptScope),
 evaluations:rows('evaluations',`attempt_id IN (SELECT id FROM public.attempts WHERE ${attemptScope})`),
 assistance_records:rows('interventions',attemptScope),
 private_draft:scalar('teacher_intervention_drafts','id='+uuid(scope.draft_id)),
 generation_requests:rows('teacher_intervention_requests','draft_id='+uuid(scope.draft_id),'request_id'),
 approval:scalar('teacher_intervention_approvals','id='+uuid(scope.approval_id)),
 delivery:scalar('teacher_intervention_deliveries','approval_id='+uuid(scope.approval_id)),
 recipients:rows('teacher_intervention_recipients','approval_id='+uuid(scope.approval_id),'student_id'),
 followup_links:rows('teacher_intervention_followups','approval_id='+uuid(scope.approval_id),'student_id'),
 followup_evaluation_requests:rows('teacher_intervention_evaluation_requests','approval_id='+uuid(scope.approval_id),'request_id'),
 intervention_actions:rows('teacher_intervention_actions','draft_id='+uuid(scope.draft_id),'request_id'),
};
const query='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT jsonb_build_object('+Object.entries(expressions).map(([key,value])=>"'"+key+"',"+value).join(',')+'); COMMIT;';
function snapshot(label){const result=run(label,['exec',db,'psql','-X','-q','-A','-t','-U','postgres','-d','learning_platform','-v','ON_ERROR_STOP=1','-c',query]);const value=JSON.parse(result.stdout.trim());writeFileSync(join(out,label+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});return value;}
function validate(value){
 for(const key of ['source_document','source_version','lesson','published_version','assignment','private_draft','approval','delivery'])assert.ok(value[key],key+' must exist');
 assert.equal(value.source_version.review_status,'approved');assert.equal(value.source_version.document_sha256,a.content_ref.document_sha256);assert.equal(value.source_version.excerpt_sha256,a.content_ref.excerpt_sha256);
 assert.deepEqual(value.published_version.content_ref,a.content_ref);assert.equal(value.assignment.lesson_id,a.lesson_id);assert.equal(value.assignment.lesson_version,String(a.published_version));assert.ok(value.assignment.teacher_approved_at);
 const original=value.attempts.find(x=>x.id===scope.original_attempt_id);assert.ok(original);assert.equal(original.response_text,a.original_response);assert.deepEqual(original.question.content_ref,a.content_ref);assert.equal(original.current_evaluation_id,scope.original_evaluation_id);
 const originalEvaluation=value.evaluations.find(x=>x.id===scope.original_evaluation_id);assert.equal(originalEvaluation?.validation_status,'accepted');
 assert.equal(value.private_draft.revision,comparison.approved_revision+1,'Approval stores reviewed revision and increments the terminal draft once');assert.equal(value.private_draft.snapshot.status,'approved');
 assert.equal(value.approval.draft_id,scope.draft_id);assert.equal(value.approval.assignment_id,scope.assignment_id);assert.equal(value.approval.approved_revision,comparison.approved_revision);assert.equal(value.delivery.approval_id,scope.approval_id);
 assert.equal(value.recipients.length,1);assert.equal(value.recipients[0].student_id,scope.student_id);assert.ok(value.recipients[0].displayed_at);
 assert.equal(value.followup_links.length,1);assert.equal(value.followup_links[0].session_id,scope.followup_session_id);assert.equal(value.followup_links[0].attempt_id,scope.followup_attempt_id);
 const followup=value.attempts.find(x=>x.id===scope.followup_attempt_id);assert.equal(followup?.response_text,input.followup.response_text);assert.equal(followup.current_evaluation_id,scope.followup_evaluation_id);
 const evaluation=value.evaluations.find(x=>x.id===scope.followup_evaluation_id);assert.equal(evaluation?.validation_status,'accepted');assert.deepEqual(evaluation.result,recipient.evaluation.result);
 assert.equal(value.generation_requests.some(x=>x.status==='pending'),false);assert.equal(value.followup_evaluation_requests.some(x=>x.state==='pending'),false);
}
try{
 release=acquireLock({mode:'same-journey-private-db-persistence',source:manifest.source,state,out,project,sourceSha:SHA});report.lockOwner=JSON.parse(readFileSync(join(LOCK_PATH,'owner.json'),'utf8'));report.status='running';save();
 const dbBefore=inspect(db,'db-identity-before'),appBefore=inspect(app,'app-identity-before');
 assert.equal(dbBefore.name,'/'+db);assert.equal(dbBefore.project,project);assert.equal(dbBefore.service,'db');assert.equal(dbBefore.configuredImage,config.services.db.image);assert.equal(dbBefore.status,'running');assert.equal(dbBefore.health,'healthy');
 const dataMount=dbBefore.mounts.find(x=>x.Destination==='/var/lib/postgresql/data');assert.equal(dataMount?.Type,'volume');assert.equal(dataMount.Name,volume);
 assert.equal(appBefore.name,'/'+app);assert.equal(appBefore.project,project);assert.equal(appBefore.service,'app');assert.equal(appBefore.configuredImage,project+':'+SHA);assert.equal(appBefore.status,'running');
 const pinnedImage=run('image-identity',['image','inspect',project+':'+SHA,'--format','{{.Id}}']).stdout.trim();assert.equal(appBefore.imageId,pinnedImage);
 report.identityBefore={db:dbBefore,app:appBefore};const before=snapshot('before');validate(before);
 report.beforeSha256=hash(stable(before));report.checks.push({id:'BEFORE',status:'passed',scope,tableGroups:Object.keys(before)});save();
 run('restart-owned-database-only',['restart','--time','10',db],{restart:true});
 let dbAfter;
 for(let count=0;count<18;count++){
  dbAfter=inspect(db,'db-health-'+String(count+1).padStart(2,'0'));
  assert.equal(dbAfter.id,dbBefore.id);assert.equal(dbAfter.project,project);assert.equal(dbAfter.service,'db');
  if(dbAfter.status==='running'&&dbAfter.health==='healthy')break;
  await new Promise(done=>setTimeout(done,2000));
 }
 assert.equal(dbAfter.status,'running');assert.equal(dbAfter.health,'healthy');assert.notEqual(dbAfter.startedAt,dbBefore.startedAt,'An actual container restart must be observed');
 assert.deepEqual(dbAfter.mounts,dbBefore.mounts);
 const after=snapshot('after');validate(after);report.afterSha256=hash(stable(after));
 report.comparisons=Object.keys(before).map(key=>({tableGroup:key,beforeSha256:hash(stable(before[key])),afterSha256:hash(stable(after[key])),equal:stable(before[key])===stable(after[key])}));save();
 assert.deepEqual(after,before,'Every scoped saved field, source, version, approval, delivery, answer and accepted evaluation must survive unchanged');
 const appAfter=inspect(app,'app-identity-after');assert.equal(appAfter.id,appBefore.id);assert.equal(appAfter.startedAt,appBefore.startedAt,'Application must not have been restarted by this supplement');assert.equal(appAfter.status,'running');
 report.identityAfter={db:dbAfter,app:appAfter};report.checks.push({id:'RESTART',status:'passed',container:db,privateVolume:volume,otherContainersRestarted:[]},{id:'PERSISTENCE',status:'passed',identicalTableGroups:report.comparisons.length});
 report.status='passed';
}catch(error){report.status=restartDispatched?'failed-after-restart':'blocked-before-restart';report.error=String(error);if(restartDispatched)retain=true;process.exitCode=1;}
finally{
 if(retain){report.lockRetained=true;report.reconciliationRequired='Inspect the recorded exact private DB/app identities, health and snapshots read-only. Do not replay restart or modify saved records. Owner must reconcile before releasing its own lock.';}
 else release?.();
 report.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,report:join(out,'report.json'),lockRetained:!!report.lockRetained}));
}
