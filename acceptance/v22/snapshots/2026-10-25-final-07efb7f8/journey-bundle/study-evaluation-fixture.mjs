/** Synthetic evaluation through existing services after one actual browser submission. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const [mode,inputPath,outputPath]=process.argv.slice(2);
assert.equal(mode,'evaluate-study');
for(const path of [inputPath,outputPath])assert.match(path||'',/^\/tmp\/acceptance-[a-zA-Z0-9-]+\.json$/);
assert.equal(existsSync(outputPath),false);
const SHA='07efb7f821339538800f150f57b298eb2e606be3',TREE='948b9a6005a056c97f10d181c589b5352d6221f3';
assert.equal(process.env.ACCEPTANCE_SOURCE_SHA,SHA);assert.equal(process.env.ACCEPTANCE_SOURCE_TREE,TREE);
assert.equal(process.env.ACCEPTANCE_PROJECT,'lp-v22-final-01a173d6');assert.equal(process.env.AUTH_URL,'http://localhost:3396');
assert.equal(process.env.PGHOST,'db');assert.equal(process.env.PGDATABASE,'learning_platform');
for(const key of ['OPENAI_API_KEY','OPENAI_MODEL'])assert.equal(process.env[key]?.trim()||'','');
const hash=x=>createHash('sha256').update(x).digest('hex'),bytes=readFileSync(inputPath),input=JSON.parse(bytes);
assert.equal(input.status,'passed');assert.equal(input.sourceSha,SHA);assert.equal(input.sourceTree,TREE);
assert.equal(input.helper,'bounded-real-student-study-step');assert.ok(input.step_number>=1&&input.step_number<=4);
assert.ok(input.saved_attempt?.submitted_at);assert.equal(input.answerReconciled,true);
const prep=input.preparation,a=prep.authoring;const quotaPartial=prep.mode==='prepare'&&prep.status==='failed'&&prep.error==='The hourly limit of 10 draft requests has been reached. Review saved drafts or try later.';
assert.ok(prep.status==='completed'||quotaPartial);assert.equal(prep.source_sha,SHA);assert.equal(prep.source_tree,TREE);
assert.equal(prep.controller?.evaluation_id,prep.original_evaluation_id);assert.ok(prep.controller.applied_result);
assert.equal(a.functional_completed_through,'teacher-original-evidence');assert.equal(a.paid_calls,0);
globalThis.fetch=async()=>{throw Error('External HTTP forbidden for synthetic acceptance seam');};
const {getPool}=await import('/app/lib/db.ts');const pool=getPool();
const {DEMO_IDS}=await import('/app/lib/evidence/demo.ts');
const {evidenceAccess,readSession}=await import('/app/lib/evidence/store.ts');
const {evaluateSubmittedAttempt}=await import('/app/lib/evaluation/evaluate.ts');
const {evaluationRecovery}=await import('/app/lib/evaluation/recovery.ts');
const {applyTutoring}=await import('/app/lib/tutoring/store.ts');
const report={mode,status:'running',source_sha:SHA,source_tree:TREE,project:process.env.ACCEPTANCE_PROJECT,origin:process.env.AUTH_URL,
 input_sha256:hash(bytes),harness_sha256:hash(readFileSync(new URL(import.meta.url))),started_at:new Date().toISOString(),actual_model_calls:0,
 injected_evaluation_calls:0,step_number:input.step_number,preparation:prep,seams:[],forced_transition:false,interventionDraftPreparation:quotaPartial?'incomplete-hourly-quota':'completed'};
const save=()=>writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n',{flush:true});
writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n',{flag:'wx',flush:true});
try{
 assert.equal(a.student_id,DEMO_IDS.studentOne);
 const actor=await pool.query('SELECT p.auth_user_id,u.email FROM profiles p JOIN auth_user u ON u.id=p.auth_user_id WHERE p.id=$1',[a.student_id]);
 assert.equal(actor.rowCount,1);assert.equal(actor.rows[0].email,process.env.DEMO_STUDENT_ONE_EMAIL);assert.ok(actor.rows[0].email.endsWith('@example.invalid'));
 const access=evidenceAccess({profileId:a.student_id,userId:actor.rows[0].auth_user_id});
 const before=await readSession(access,a.student_session_id,'student');
 assert.equal(before.session.assignment_id,a.assignment_id);assert.equal(before.session.student_id,a.student_id);
 const original=before.attempts.find(x=>x.id===a.presented_attempt_id);
 for(const key of ['response_text','submitted_at','submission_key','question','assistance'])assert.deepEqual(original[key],prep.original_attempt_snapshot[key]);
 assert.equal(original.current_evaluation_id,prep.original_evaluation_id);
 const originalEvaluation=before.evaluations.find(x=>x.id===prep.original_evaluation_id);assert.equal(originalEvaluation?.validation_status,'accepted');
 const attempt=before.attempts.find(x=>x.id===input.saved_attempt.id);assert.ok(attempt?.submitted_at);assert.notEqual(attempt.id,original.id);
 assert.equal(attempt.response_text,input.saved_attempt.response_text);assert.equal(attempt.submission_key,input.saved_attempt.submission_key);
 assert.deepEqual(attempt.question.content_ref,a.content_ref);
 assert.equal(attempt.id,before.attempts.filter(x=>x.submitted_at).at(-1).id,'Evaluate only the latest actual intended submission');
 const evals=before.evaluations.filter(x=>x.attempt_id===attempt.id);
 assert.equal(Boolean(evaluationRecovery(evals,Date.now()).unfinished),false,'Reconcile uncertain evaluation before any provider seam');
 let accepted=evals.find(x=>x.id===attempt.current_evaluation_id&&x.validation_status==='accepted');
 if(!accepted){
  assert.equal(evals.length,0,'No replay or replacement of a recorded evaluation');
  const evaluated=await evaluateSubmittedAttempt(access,a.student_session_id,attempt.id,undefined,{provider:async prompt=>{
   report.injected_evaluation_calls++;const given=JSON.parse(prompt.input);assert.equal(given.student_response,attempt.response_text);assert.deepEqual(given.question.content_ref,a.content_ref);
   return {ok:true,needsReconciliation:false,model:'synthetic-same-browser-journey',responseId:'fixture-'+randomUUID(),latencyMs:0,usage:null,result:{
    per_concept_results:given.question.concept_ids.map(concept_id=>({concept_id,correctness:'correct',error_type:null,rubric_criteria_met:given.question.rubric.criteria,rubric_criteria_missing:[]})),
    source_passage_ids:given.question.source_passage_ids,evidence_quotes:[{quote:attempt.response_text,interpretation:'Explicit synthetic acceptance evaluator for a real additional browser answer; not actual-model judgment.'}],
    misconception_candidates:[],reasoning_observed:'Synthetic evaluator seam; zero paid model calls.',uncertainty_reason:null,proposed_next_action:'SCHEDULE_REVIEW'}};
  }});
  assert.equal(evaluated.failure,null);accepted=evaluated.evaluation;assert.equal(accepted?.validation_status,'accepted');
 }
 const controllerView=await applyTutoring(access,a.student_session_id,accepted.id);
 const after=await readSession(access,a.student_session_id,'student');const applied=after.evaluations.find(x=>x.id===accepted.id);assert.ok(applied.applied_result);
 assert.deepEqual(after.attempts.find(x=>x.id===original.id),original);assert.deepEqual(after.evaluations.find(x=>x.id===originalEvaluation.id),originalEvaluation);
 for(const key of ['response_text','submitted_at','submission_key','question','assistance'])assert.deepEqual(after.attempts.find(x=>x.id===attempt.id)[key],attempt[key]);
 report.latest_attempt_id=attempt.id;report.latest_evaluation_id=accepted.id;report.saved_attempt=attempt;report.accepted_evaluation=applied;
 report.student_view=controllerView;report.session_status=after.session.status;report.session_completed=after.session.status==='completed';
 report.original_evidence={attempt_id:original.id,evaluation_id:originalEvaluation.id,unchanged:true,answer_sha256:hash(original.response_text),assistance:original.assistance};
 report.seams.push({kind:'synthetic-additional-answer-evaluation',attempt_id:attempt.id,evaluation_id:accepted.id,provider:accepted.evaluator,actual_controller:'applyTutoring',applied_result:applied.applied_result,forced_transition:false});
 report.new_intervention_ids=after.interventions.filter(x=>!before.interventions.some(y=>y.id===x.id)).map(x=>x.id);
 report.status='completed';report.finished_at=new Date().toISOString();save();
}catch(error){report.status='failed';report.error=String(error);save();process.exitCode=1;}
finally{await pool.end();}
