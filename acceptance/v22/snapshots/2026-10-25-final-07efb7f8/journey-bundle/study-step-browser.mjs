/** One bounded REAL browser answer. No direct submission, evaluation, or display mutation. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {hash,openRuntime,SHA,TREE,settle} from './read-only-runtime.mjs';
const [stateArg,outArg,playwrightArg,safetyArg,inputArg]=process.argv.slice(2);
const input=JSON.parse(readFileSync(inputArg,'utf8'));
assert.equal(input.source_sha,SHA);assert.equal(input.source_tree,TREE);
const isPreparation=['prepare','prepare-draft'].includes(input.mode);
const prep=isPreparation?input:input.preparation,a=prep.authoring;
const quotaPartial=prep.mode==='prepare'&&prep.status==='failed'&&prep.error==='The hourly limit of 10 draft requests has been reached. Review saved drafts or try later.';
assert.ok(prep.status==='completed'||quotaPartial);assert.ok(['prepare','prepare-draft'].includes(prep.mode));
assert.equal(prep.controller?.evaluation_id,prep.original_evaluation_id);assert.ok(prep.controller.applied_result);
if(!isPreparation)assert.equal(input.status,'completed');
const step=isPreparation?1:input.session_completed?input.step_number:input.step_number+1;assert.ok(step>=1&&step<=4,'At most four additional intended answers');
const rt=await openRuntime({stateArg,outArg,playwrightArg,safetyArg,inputArg,helper:'bounded-real-student-study-step'});
const {report,check,get,capture}=rt;Object.assign(report,{harnessSha256:hash(readFileSync(new URL(import.meta.url))),preparation:prep,
 step_number:step,writes:[],answerReconciled:false,interventionDraftPreparation:quotaPartial?'incomplete-hourly-quota':'completed',method:'Real authenticated browser composer and explicit answer button. Existing app saves answer and acknowledges actually visible help. Synthetic evaluation is a separately guarded service phase.'});
let teacher,student,before,expectedAttempt,conversation,submitted=false,dispatchUncertain=false;
const evidence={};
try{
 teacher=await rt.launch('teacher');student=await rt.launch('student');
 before=await get(teacher.context,'/api/teacher/sessions/'+a.student_session_id);evidence.before=before;
 assert.equal(before.session.assignment_id,a.assignment_id);
 const original=before.attempts.find(x=>x.id===a.presented_attempt_id);assert.equal(original.response_text,a.original_response);assert.equal(original.current_evaluation_id,prep.original_evaluation_id);
 const publicBefore=await get(student.context,'/api/tutoring/'+a.student_session_id);evidence.publicBefore=publicBefore;
 const pendingHelp=new Set(before.interventions.filter(x=>x.delivery_status==='created').map(x=>x.id));
 expectedAttempt=before.attempts.find(x=>x.id===publicBefore.progress.current_attempt_id);
 conversation=await get(student.context,'/api/tutoring/'+a.student_session_id+'/conversation');evidence.conversationBefore=conversation;
 assert.equal(conversation.dialogue.state.active_request_id,null,'Read-only reconcile any prior pending message before a new intended answer');
 const intended='Evaporation changes liquid water into water vapor, a gas in the air. The water remains matter rather than disappearing. This is my intended fictional diagnostic answer '+step+'.';
 report.intendedAnswer={attemptId:expectedAttempt?.id,responseText:intended,syntheticAuthoredAnswer:true};await rt.save();
 const used=new Set();
 await student.page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==rt.manifest.origin||request.method()!=='POST')return route.fallback();
  let body;try{body=request.postDataJSON();}catch{return route.fallback();}
  let kind;
  if(url.pathname==='/api/sessions/'+a.student_session_id+'/answers'&&body.attempt_id===expectedAttempt?.id&&body.response_text===intended&&typeof body.submission_key==='string')kind='actual-composer-answer';
  else if(url.pathname==='/api/tutoring/'+a.student_session_id+'/conversation'&&body.version==='r7-conversation-v1'&&body.session_id===a.student_session_id&&body.attempt_id===expectedAttempt?.id&&body.expected_revision===conversation.dialogue.state.revision&&/^[0-9a-f-]{36}$/.test(body.request_id)){
   if(body.action==='send_message'&&body.text===intended&&conversation.dialogue.state.active_request_id===null)kind='actual-intended-message';
   else if(body.action==='resolve_intent'&&body.choice==='answer'&&conversation.dialogue.state.active_request_id===body.message_request_id&&conversation.messages.some(x=>x.request_id===body.message_request_id&&x.attempt_id===expectedAttempt.id&&x.text===intended&&x.outcome.status==='clarification'))kind='actual-explicit-answer-confirmation';
  }
  else if(url.pathname==='/api/tutoring/'+a.student_session_id&&body.attempt_id===expectedAttempt?.id)kind='automatic-existing-controller';
  else if([...pendingHelp].some(id=>url.pathname==='/api/sessions/'+a.student_session_id+'/interventions/'+id)&&Object.keys(body).length===0)kind='actual-visible-help-acknowledgment';
  else return route.fallback();
  if(!kind)return route.fallback();
  const key=url.pathname+':'+kind;assert.equal(used.has(key),false,'No mutation replay');used.add(key);
  rt.guard(kind);const receipt={kind,path:url.pathname,body,startedAt:new Date().toISOString(),status:'dispatched'};report.writes.push(receipt);await rt.save();
  try{
   const response=await route.fetch({timeout:30000,maxRedirects:0,maxRetries:0});
   const bytes=await response.body();receipt.httpStatus=response.status();receipt.responseSha256=hash(bytes);receipt.responseText=bytes.toString('utf8');receipt.status='acknowledged';receipt.finishedAt=new Date().toISOString();
   if(['actual-intended-message','actual-explicit-answer-confirmation'].includes(kind)&&response.status()===200){
    const savedConversation=JSON.parse(bytes.toString('utf8'));
    assert.equal(savedConversation.dialogue.state.lesson.session_id,a.student_session_id);
    const message=savedConversation.messages.find(x=>x.request_id===(body.action==='send_message'?body.request_id:body.message_request_id));
    assert.equal(message?.text,intended);assert.equal(message.attempt_id,expectedAttempt.id);
    conversation=savedConversation;evidence.latestConversation=conversation;
   }
   await rt.save();await route.fulfill({response,body:bytes});
  }catch(error){receipt.status='uncertain';receipt.error=String(error);dispatchUncertain=true;rt.retainLock('Read-only reconciliation required for uncertain '+kind);await rt.save();await route.abort('failed').catch(()=>{});}
 });
 await student.page.goto(new URL(a.student_session_url,rt.manifest.origin).href);await settle(student.page);
 for(const id of pendingHelp){
  const content=student.page.locator('#feedback-'+id);await content.waitFor();await content.scrollIntoViewIfNeeded();
  await student.page.waitForFunction(id=>Boolean(document.getElementById('feedback-'+id)),id);await capture(student.page,'displayed-help-'+id);
 }
 if(pendingHelp.size){
  for(let n=0;n<15;n++){
   const current=await get(teacher.context,'/api/teacher/sessions/'+a.student_session_id);
   if([...pendingHelp].every(id=>current.interventions.some(x=>x.id===id&&x.delivery_status==='displayed'&&x.visible_at))){evidence.afterVisibleHelp=current;break;}
   await student.page.waitForTimeout(250);
  }
  assert.ok(evidence.afterVisibleHelp,'Visible help must be saved as displayed by the real app');
  check('HELP','Only actually visible existing tutoring help acknowledged',true,{ids:[...pendingHelp]});
 }
 const currentView=await get(student.context,'/api/tutoring/'+a.student_session_id);evidence.currentView=currentView;
 if(currentView.session.status!=='active'){
  report.session_completed=currentView.session.status==='completed';report.noAdditionalAnswerNeeded=true;report.latest_attempt_id=before.attempts.filter(x=>x.submitted_at).at(-1)?.id;
  check('RESULT','Existing controller naturally completed the same session',true,{progress:currentView.progress});await capture(student.page,'naturally-completed-study-result');
 }else{
  assert.equal(currentView.progress.phase,'answer','Proceed only to an actual unanswered next question');
  assert.equal(currentView.progress.current_attempt_id,expectedAttempt?.id);assert.ok(expectedAttempt&&!expectedAttempt.submitted_at);assert.notEqual(expectedAttempt.id,a.presented_attempt_id);
  const composer=student.page.getByRole('textbox',{name:'Message your tutor',exact:true});await composer.waitFor();await composer.fill(intended);
  await capture(student.page,'extra-intended-answer-before-submit');
  submitted=true;await student.page.getByRole('button',{name:'Send',exact:true}).click();
  await student.page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>['Submit this as my answer','Submit as my answer'].includes(button.textContent.trim())&&!button.disabled),{},{timeout:15000});
  const fallback=student.page.getByRole('button',{name:'Submit this as my answer',exact:true});
  if(await fallback.isVisible()){
   report.answerConfirmation='Actual Send exposed provider-disabled direct answer fallback';await fallback.click();
  }else{
   conversation=await get(student.context,'/api/tutoring/'+a.student_session_id+'/conversation');evidence.clarification=conversation;
   const pending=conversation.messages.find(x=>x.request_id===conversation.dialogue.state.active_request_id);
   assert.equal(pending?.text,intended);assert.equal(pending?.attempt_id,expectedAttempt.id);assert.equal(pending?.outcome.status,'clarification');
   report.answerConfirmation='Actual Send saved ambiguous provider-disabled message, then explicit answer confirmation';
   await capture(student.page,'actual-message-awaiting-explicit-answer-confirmation');
   await student.page.getByRole('button',{name:'Submit as my answer',exact:true}).click();
  }
  let after;
  for(let n=0;n<30;n++){
   after=await get(teacher.context,'/api/teacher/sessions/'+a.student_session_id);
   if(after.attempts.some(x=>x.id===expectedAttempt.id&&x.submitted_at&&x.response_text===intended))break;
   await student.page.waitForTimeout(250);
  }
  evidence.after=after;const saved=after.attempts.find(x=>x.id===expectedAttempt.id);assert.ok(saved?.submitted_at);assert.equal(saved.response_text,intended);
  const answerWrite=report.writes.find(x=>x.kind==='actual-composer-answer');
  if(answerWrite)assert.equal(saved.submission_key,answerWrite.body.submission_key);
  else{
   assert.ok(report.writes.some(x=>x.kind==='actual-explicit-answer-confirmation'));
   const confirmed=await get(student.context,'/api/tutoring/'+a.student_session_id+'/conversation');evidence.confirmedConversation=confirmed;
   const message=confirmed.messages.find(x=>x.text===intended&&x.attempt_id===expectedAttempt.id);assert.equal(message?.outcome.status,'answer');assert.equal(saved.submission_key,message.outcome.submission_key);
  }
  assert.deepEqual(after.attempts.find(x=>x.id===original.id),original);assert.deepEqual(after.evaluations.find(x=>x.id===prep.original_evaluation_id),before.evaluations.find(x=>x.id===prep.original_evaluation_id));
  report.saved_attempt=saved;report.answerReconciled=true;report.session_completed=false;
  check('ANSWER','Real intended next-question answer persisted once with exact key',true,{attemptId:saved.id,submissionKey:saved.submission_key,originalAttemptId:original.id});
  await student.page.getByText('Your answer — saved',{exact:false}).first().waitFor();await capture(student.page,'extra-answer-saved-awaiting-synthetic-evaluation');
  evidence.conversation=await get(student.context,'/api/tutoring/'+a.student_session_id+'/conversation');
  assert.equal(evidence.conversation.dialogue.state.active_request_id,null,'Reconcile pending conversation before synthetic evaluation');
  check('ORIGINAL','Original answer, accepted evaluation and assistance untouched',true,{originalAttemptId:original.id,originalEvaluationId:prep.original_evaluation_id});
 }
}catch(error){check('STUDY','Bounded real browser continuation',false,{error:String(error)});
 try{if(student)await capture(student.page,'study-failure-before-close');}catch(captureError){report.failureScreenshotError=String(captureError);}
 if(submitted&&!report.answerReconciled){
  try{evidence.reconciliation=await get(teacher.context,'/api/teacher/sessions/'+a.student_session_id);}catch(readError){report.reconciliationError=String(readError);}
  rt.retainLock('Actual answer click has no complete reviewed reconciliation; inspect retained API evidence before any retry');
 }
}finally{
 for(let n=0;n<20&&report.writes.some(x=>x.status==='dispatched');n++)await student?.page.waitForTimeout(250).catch(()=>{});
 if(report.writes.some(x=>x.status==='dispatched')){dispatchUncertain=true;report.pendingDispatches=report.writes.filter(x=>x.status==='dispatched');}
 if(dispatchUncertain)rt.retainLock('An allowed browser mutation has an uncertain response; inspect read-only evidence before any replay');
 await writeFile(join(rt.out,'api-evidence.json'),JSON.stringify(evidence,null,2)+'\n');await rt.finish();
}
