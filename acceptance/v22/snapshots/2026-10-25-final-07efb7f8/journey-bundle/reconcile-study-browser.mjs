/** Read-only reconciliation of one exact acknowledged evaluation/controller execution. No evaluation/apply imports or calls. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {hash,openRuntime,SHA,TREE} from './read-only-runtime.mjs';
const [stateArg,outArg,playwrightArg,safetyArg,inputArg,stepArg]=process.argv.slice(2);
assert.ok(inputArg&&stepArg);
const partialBytes=readFileSync(inputArg),partial=JSON.parse(partialBytes);
assert.equal(hash(partialBytes),'f0cadf710a1af273f440eef465910b0b7bf126fb63e8d80fc3274bc421d051a4','Reconcile only reviewed original derived-outcome assertion failure');
assert.equal(partial.status,'failed');assert.equal(partial.mode,'evaluate-study');assert.equal(partial.injected_evaluation_calls,1);
assert.match(partial.error,/correct_diagnostic_without_content_assistance/);assert.match(partial.error,/outcome: null/);
assert.equal(partial.source_sha,SHA);assert.equal(partial.source_tree,TREE);
const stepBytes=readFileSync(stepArg),step=JSON.parse(stepBytes);assert.equal(hash(stepBytes),partial.input_sha256);
assert.equal(step.status,'passed');assert.equal(step.answerReconciled,true);assert.equal(step.helper,'bounded-real-student-study-step');
const priorBytes=readFileSync(join(dirname(stepArg),'api-evidence.json')),prior=JSON.parse(priorBytes);
const prep=partial.preparation,a=prep.authoring;
const rt=await openRuntime({stateArg,outArg,playwrightArg,safetyArg,inputArg,helper:'read-only-study-controller-reconciliation'});
const {report,get,check}=rt;Object.assign(report,{harnessSha256:hash(readFileSync(new URL(import.meta.url))),
 browserReceiptSha256:hash(stepBytes),priorApiEvidenceSha256:hash(priorBytes),actualModelCalls:0,evaluationCalls:0,controllerCalls:0,
 method:'Authenticated read-only APIs after fictional demo sign-in; compare every original attempt field except controller-derived outcome, and full accepted original evaluation.'});
const evidence={};
try{
 const teacher=await rt.launch('teacher'),student=await rt.launch('student');
 const actual=await get(teacher.context,'/api/teacher/sessions/'+a.student_session_id);evidence.actual=actual;
 assert.equal(actual.session.student_id,a.student_id);assert.equal(actual.session.assignment_id,a.assignment_id);assert.equal(actual.session.status,'completed');
 const before=prior.before;assert.equal(before.session.id,a.student_session_id);
 const oldOriginal=before.attempts.find(x=>x.id===a.presented_attempt_id),original=actual.attempts.find(x=>x.id===a.presented_attempt_id);
 assert.ok(oldOriginal&&original);
 const {outcome:beforeOutcome,...immutableBefore}=oldOriginal,{outcome:afterOutcome,...immutableAfter}=original;
 assert.deepEqual(immutableAfter,immutableBefore,'Every original evidence field except separately derived outcome must remain exactly equal');
 assert.equal(original.response_text,a.original_response);assert.deepEqual(original.question.content_ref,a.content_ref);
 assert.equal(original.current_evaluation_id,prep.original_evaluation_id);
 const priorEvaluation=before.evaluations.find(x=>x.id===prep.original_evaluation_id),originalEvaluation=actual.evaluations.find(x=>x.id===prep.original_evaluation_id);
 assert.ok(priorEvaluation);assert.deepEqual(originalEvaluation,priorEvaluation,'Full original accepted evaluation must remain unchanged');
 assert.equal(originalEvaluation.validation_status,'accepted');assert.equal(originalEvaluation.applied_result.action,'ASK_DIAGNOSTIC_FOLLOWUP');
 check('ORIGINAL','Every immutable original field and full original accepted evaluation preserved',true,{attemptId:original.id,evaluationId:originalEvaluation.id,immutableSha256:hash(JSON.stringify(immutableAfter)),acceptedEvaluationSha256:hash(JSON.stringify(originalEvaluation))});
 const latest=actual.attempts.find(x=>x.id===step.saved_attempt.id);assert.ok(latest);
 const {current_evaluation_id:_beforeEvaluation,outcome:_beforeOutcome,...submittedBefore}=step.saved_attempt;
 const {current_evaluation_id:_afterEvaluation,outcome:_afterOutcome,...submittedAfter}=latest;
 assert.deepEqual(submittedAfter,submittedBefore,'Every diagnostic submission field remains exact');
 assert.equal(latest.id,actual.attempts.filter(x=>x.submitted_at).at(-1).id);assert.equal(latest.parent_attempt_id,original.id);
 const accepted=actual.evaluations.find(x=>x.id===latest.current_evaluation_id&&x.attempt_id===latest.id);assert.ok(accepted);
 assert.equal(accepted.validation_status,'accepted');assert.equal(accepted.evaluator.model,'synthetic-same-browser-journey');
 assert.ok(accepted.result.per_concept_results.every(x=>x.correctness==='correct'));assert.equal(accepted.applied_result.action,'END_SESSION');
 assert.equal(beforeOutcome,null);assert.equal(afterOutcome.outcome,'correct_diagnostic_without_content_assistance');
 assert.equal(afterOutcome.root_attempt_id,original.id);assert.deepEqual(afterOutcome.supporting_attempt_ids,[original.id,latest.id]);
 assert.deepEqual(afterOutcome.concept_ids,original.question.concept_ids);assert.deepEqual(afterOutcome.intervention_ids,[]);
 assert.equal(afterOutcome.review_policy_version,'approved-sequence-v1');
 const interval=Date.parse(afterOutcome.next_review_at)-Date.parse(afterOutcome.recorded_at);assert.ok(Math.abs(interval-24*60*60*1000)<5000);
 check('DERIVED','Existing controller recorded expected diagnostic outcome and illustrative review',true,{before:beforeOutcome,after:afterOutcome,source:'lib/tutoring/decide.ts diagnostic_followup correct -> END_SESSION, correct_diagnostic_without_content_assistance',originalResultRelabeled:false});
 check('LATEST','Latest accepted diagnostic result and existing applied controller found without replay',true,{attemptId:latest.id,evaluationId:accepted.id,action:accepted.applied_result.action});
 const view=await get(student.context,'/api/tutoring/'+a.student_session_id);evidence.studentView=view;
 assert.equal(view.session.status,'completed');assert.equal(view.progress.phase,'completed');assert.ok(view.progress.message.includes('Your answer is correct.'));
 assert.equal(view.attempts.find(x=>x.id===latest.id)?.response_text,latest.response_text);
 const after=await get(teacher.context,'/api/teacher/sessions/'+a.student_session_id);assert.deepEqual(after,actual);evidence.unchangedAfterRead=true;
 const fixture={mode:'reconcile-study',status:'completed',source_sha:SHA,source_tree:TREE,project:rt.manifest.project,origin:rt.manifest.origin,
  preparation:prep,step_number:step.step_number,latest_attempt_id:latest.id,latest_evaluation_id:accepted.id,saved_attempt:latest,accepted_evaluation:accepted,
  student_view:view,session_status:actual.session.status,session_completed:true,new_intervention_ids:actual.interventions.filter(x=>!before.interventions.some(y=>x.id===y.id)).map(x=>x.id),
  actual_model_calls:0,injected_evaluation_calls:0,controller_calls:0,forced_transition:false,read_only_reconciliation:true,
  reconciled_failed_execution_sha256:hash(partialBytes),actual_browser_submission_sha256:hash(stepBytes),prior_api_evidence_sha256:hash(priorBytes),
  original_evidence:{attempt_id:original.id,evaluation_id:originalEvaluation.id,immutable_fields_unchanged:true,accepted_evaluation_unchanged:true,derived_outcome_before:beforeOutcome,derived_outcome_after:afterOutcome,assistance:original.assistance},
  seams:[{kind:'read-only-existing-synthetic-evaluation-and-controller-reconciliation',evaluation_id:accepted.id,existing_provider:accepted.evaluator,existing_applied_result:accepted.applied_result,reevaluated:false,reapplied:false}],
  interventionDraftPreparation:'incomplete-hourly-quota',finished_at:new Date().toISOString()};
 await writeFile(join(rt.out,'fixture.json'),JSON.stringify(fixture,null,2)+'\n',{flag:'wx'});report.completedReceipt='fixture.json';
}catch(error){check('RECONCILIATION','Read-only saved result reconciliation',false,{error:String(error)});}
finally{await writeFile(join(rt.out,'api-evidence.json'),JSON.stringify(evidence,null,2)+'\n');await rt.finish();}
