/** Read-only continuation after prepare: node original-result-browser.mjs <state> <fresh-out> <playwright> <safety.mjs> <completed-preparation.json> */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hash, openRuntime, SHA, TREE } from './read-only-runtime.mjs';
const [stateArg,outArg,playwrightArg,safetyArg,inputArg]=process.argv.slice(2);
assert.ok(inputArg);const prep=JSON.parse(readFileSync(inputArg,'utf8'));
const quotaPartial=prep.mode==='prepare'&&prep.status==='failed'&&prep.error==='The hourly limit of 10 draft requests has been reached. Review saved drafts or try later.';
assert.ok(prep.status==='completed'||quotaPartial);assert.equal(prep.source_sha,SHA);assert.equal(prep.source_tree,TREE);
assert.equal(prep.controller?.evaluation_id,prep.original_evaluation_id);assert.ok(prep.controller.applied_result);
const a=prep.authoring;assert.equal(a.functional_completed_through,'teacher-original-evidence');
const rt=await openRuntime({stateArg,outArg,playwrightArg,safetyArg,inputArg,helper:'same-session-original-result-and-assistance'});
const {report,check,unrun,run,capture,get}=rt;report.harnessSha256=hash(readFileSync(new URL(import.meta.url)));
report.interventionDraftPreparation=quotaPartial?'incomplete-hourly-quota':'completed';
report.syntheticSeam='Synthetic accepted evaluator output applied by existing tutoring controller. Any additional diagnostic answers were actually entered and saved through the browser. This helper verifies the latest scoped result separately from original intervention evidence.';
const evidence={};
try{
  const teacher=await rt.launch('teacher'),student=await rt.launch('student');
  await run('J09/J10','Exact accepted original evaluation, source and assistance',teacher.page,async()=>{
    const before=await get(teacher.context,'/api/teacher/sessions/'+a.student_session_id);evidence.teacherBefore=before;
    assert.equal(before.session.assignment_id,a.assignment_id);assert.equal(before.session.student_id,a.student_id);
    const attempt=before.attempts.find(x=>x.id===a.presented_attempt_id);assert.ok(attempt);
    assert.equal(attempt.response_text,a.original_response);assert.deepEqual(attempt.question.content_ref,a.content_ref);
    assert.equal(attempt.current_evaluation_id,prep.original_evaluation_id);
    const evaluation=before.evaluations.find(x=>x.id===attempt.current_evaluation_id);assert.ok(evaluation);
    assert.equal(evaluation.attempt_id,attempt.id);assert.equal(evaluation.validation_status,'accepted');
    check('J09','Accepted result is tied to the exact original attempt and source',true,{sessionId:before.session.id,assignmentId:a.assignment_id,attemptId:attempt.id,evaluationId:evaluation.id,contentRef:attempt.question.content_ref,provider:evaluation.evaluator,appliedResult:evaluation.applied_result});
    assert.deepEqual(attempt.assistance,prep.original_attempt_snapshot.assistance);
    const displayedBefore=before.interventions.filter(x=>x.delivery_status==='displayed'&&x.visible_at&&Date.parse(x.visible_at)<=Date.parse(attempt.submitted_at));
    const counted=before.interventions.filter(x=>attempt.assistance?.intervention_ids.includes(x.id));
    check('J10','Original submission assistance snapshot remains immutable',true,{assistance:attempt.assistance,displayedBeforeSubmission:displayedBefore,countedInterventions:counted});
    check('J10','Unavailable conversational help did not become delivered content assistance',attempt.assistance?.assistance_level==='none_recorded'&&attempt.assistance.intervention_ids.length===0,{assistance:attempt.assistance,scope:'Authored help request explicitly fell back because provider is disabled; no tutoring help claimed'});
    await student.page.goto(new URL(a.student_session_url,rt.manifest.origin).href);
    await student.page.getByText('Your answer — saved',{exact:false}).first().waitFor();
    const publicView=await get(student.context,'/api/tutoring/'+a.student_session_id);evidence.studentView=publicView;
    const publicAttempt=publicView.attempts.find(x=>x.id===attempt.id);assert.equal(publicAttempt?.response_text,a.original_response);
    evidence.conversation=await get(student.context,'/api/tutoring/'+a.student_session_id+'/conversation');
    const body=await student.page.locator('body').innerText();
    const latest=before.attempts.filter(x=>x.submitted_at).at(-1);assert.ok(latest);
    const latestEvaluation=before.evaluations.find(x=>x.id===latest.current_evaluation_id&&x.attempt_id===latest.id&&x.validation_status==='accepted');assert.ok(latestEvaluation);
    assert.deepEqual(latest.question.content_ref,a.content_ref);
    const expected=latestEvaluation.result.per_concept_results.some(x=>x.correctness==='uncertain')?'Your latest answer could not be assessed with confidence.':latestEvaluation.result.per_concept_results.every(x=>x.correctness==='incorrect')?'Your latest answer is not correct yet.':latestEvaluation.result.per_concept_results.every(x=>x.correctness==='correct')?'Your answer is correct.':'Your latest answer is partly correct.';
    const visible=body.includes(expected);report.observations.push({label:'Student latest matching assessment after natural controller progression',expected,visible,progress:publicView.progress,sessionStatus:publicView.session.status,latestAttemptId:latest.id,latestEvaluationId:latestEvaluation.id,originalAttemptId:attempt.id,originalEvaluationId:evaluation.id});
    check('J09','Student displays assessment scoped to latest actual saved answer',visible&&publicView.session.status==='completed',{
      expected,latestAttemptId:latest.id,latestEvaluationId:latestEvaluation.id,originalAttemptId:attempt.id,originalEvaluationId:evaluation.id,
      latestAssistance:latest.assistance,originalAssistance:attempt.assistance,progress:publicView.progress,appliedResult:latestEvaluation.applied_result,
      originalResultNotRelabeled:true});
    check('J09','Student projection does not expose private evaluation criteria',!JSON.stringify(publicView).includes('"rubric"')&&!JSON.stringify(publicView).includes('"answer_guidance"'));
    await capture(student.page,'student-original-result-after-synthetic-evaluation');
    await teacher.page.goto(rt.manifest.origin+'/teacher/sessions/'+a.student_session_id+'?assignment='+a.assignment_id+'&origin=all');
    await teacher.page.getByRole('heading',{name:'Original student response',exact:true}).first().waitFor();
    const teacherText=await teacher.page.locator('body').innerText();
    check('J10','Teacher displays original answer and exact no-help wording',teacherText.includes(a.original_response.trim())&&teacherText.includes('No content help recorded before this answer.'),{attemptId:attempt.id,assistance:attempt.assistance});
    await teacher.page.getByRole('heading',{name:'Original student response',exact:true}).first().scrollIntoViewIfNeeded();await capture(teacher.page,'teacher-original-and-recorded-assistance');
    const investigation = rt.manifest.origin + '/teacher/evidence?' + new URLSearchParams({
      assignment:a.assignment_id, origin:'all', session:a.student_session_id, attempt:attempt.id,
      evaluation:evaluation.id, concept:prep.concept_id,
    });
    await teacher.page.goto(investigation);
    await teacher.page.locator('.wb-original-response').waitFor();
    assert.equal(await teacher.page.locator('.wb-original-response').textContent(), a.original_response);
    const prepareLink = teacher.page.getByRole('link',{name:'Prepare from this response',exact:false});
    const prepareHref = await prepareLink.getAttribute('href');
    await prepareLink.click();
    await teacher.page.waitForURL(url=>url.pathname==='/teacher/interventions');
    await teacher.page.locator('.lp-intervention-workspace').waitFor();
    const handoff = new URL(teacher.page.url());
    const expectedScope = {assignment:a.assignment_id, session:a.student_session_id, attempt:attempt.id, evaluation:evaluation.id};
    check('J11','Selected Evidence response opens exact intervention preparation scope',
      Object.entries(expectedScope).every(([key,value])=>handoff.searchParams.get(key)===value)&&
      handoff.searchParams.getAll('seedAttempt').includes(attempt.id),
      {from:investigation,link:prepareHref,destination:handoff.href,expectedScope,generationMutationAttempted:false});
    const original = teacher.page.locator('#evidence-'+attempt.id+' details');
    await original.locator('summary').click();
    check('J11','Preparation displays the original selected saved answer',
      (await original.innerText()).includes(a.original_response.trim()),{attemptId:attempt.id});
    await capture(teacher.page,'evidence-selected-to-intervention-preparation');
    const after=await get(teacher.context,'/api/teacher/sessions/'+a.student_session_id);evidence.teacherAfter=after;
    check('J10','Read-only inspection did not change original evidence',JSON.stringify(after)===JSON.stringify(before),{beforeSha256:hash(JSON.stringify(before)),afterSha256:hash(JSON.stringify(after))});
  });
}catch(error){check('HARNESS','Setup',false,{error:String(error)});}
finally{await writeFile(join(rt.out,'api-evidence.json'),JSON.stringify(evidence,null,2)+'\n');await rt.finish();}
