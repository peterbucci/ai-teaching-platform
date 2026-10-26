/** V09 only: populated private draft, local edit retention, responsive tabs and native Steps drawer.
 * node v09-private-draft-browser.mjs <state> <fresh-out> <playwright> <safety.mjs> <completed-preparation.json>
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {hash,openRuntime,settle,SHA,TREE} from './read-only-runtime.mjs';
const [stateArg,outArg,playwrightArg,safetyArg,inputArg]=process.argv.slice(2);
const prep=JSON.parse(readFileSync(inputArg,'utf8'));assert.equal(prep.status,'completed');assert.equal(prep.source_sha,SHA);assert.equal(prep.source_tree,TREE);
assert.ok(prep.draft_id&&prep.teacher_url);const a=prep.authoring;
const rt=await openRuntime({stateArg,outArg,playwrightArg,safetyArg,inputArg,helper:'V09-populated-private-draft-responsive-supplement'});
const {report,check,run,capture,get}=rt;report.harnessSha256=hash(readFileSync(new URL(import.meta.url)));
report.scope='V09 only on the actual connected private draft. Local Activity title edit and restoration; all three panes; tablet native modal Escape/Close and focus; no Save, approval, delivery or other mutation.';
report.persistenceBoundary='Local pane/edit retention is verified here. Separate actual connected save/approve/deliver/follow-up browser phases are required for server persistence.';
const api='/api/teacher/interventions/'+prep.draft_id,evidence={};
async function ready(page){await page.locator('.lp-intervention-workspace .tw-panes').waitFor();await page.waitForFunction(()=>document.querySelector('.lp-intervention-workspace .tw-panes')?.dataset.layout===(innerWidth<=800?'compact':innerWidth<=1240?'medium':'wide'));await settle(page);}
async function choose(page,name){
 const width=await page.evaluate(()=>innerWidth);
 if(width<=800){const tab=page.getByRole('tab',{name,exact:true});await tab.click();await page.waitForFunction(({name})=>[...document.querySelectorAll('[role=tab]')].some(tab=>tab.textContent.trim()===name&&tab.getAttribute('aria-selected')==='true'),{name});}
 else if(width<=1240){
  const dialog=page.locator('dialog.tw-panes-context');
  if(name==='Steps'){const open=page.getByRole('button',{name:'Open Steps',exact:true});if(await open.getAttribute('aria-expanded')!=='true')await open.click();await page.locator('dialog.tw-panes-context[open]').waitFor();}
  else if(await dialog.evaluate(element=>element.open)){await page.getByRole('button',{name:'Close Steps',exact:true}).click();await page.locator('dialog.tw-panes-context[open]').waitFor({state:'hidden'});}
 }
 await page.locator('.tw-panes-heading').filter({hasText:new RegExp('^'+name+'$')}).waitFor({state:'visible'});await settle(page);
}
async function geometry(page){return page.evaluate(()=>{const root=document.querySelector('.tw-panes');const boxes=[...document.querySelectorAll('.tw-panes-panel')].map(element=>{const r=element.getBoundingClientRect();return{id:element.id,visible:!!element.getClientRects().length,x:r.x,y:r.y,width:r.width,height:r.height};});return{innerWidth,innerHeight,dpr:devicePixelRatio,layout:root?.dataset.layout,activePane:root?.dataset.activePane,overflow:document.documentElement.scrollWidth>innerWidth+1,panes:boxes,activeId:document.activeElement?.id};});}
async function caseAt(page,label){
 await run('V09',label+' populated Evidence Activity Steps and local edit retention',page,async()=>{
  await page.goto(new URL(prep.teacher_url,rt.manifest.origin).href);await ready(page);
  const width=await page.evaluate(()=>innerWidth);
  for(const name of ['Evidence','Activity','Steps']){
   await choose(page,name);const observed=await geometry(page);report.observations.push({label:label+' '+name,...observed});
   check('V09',label+' '+name+' pane visible with no horizontal overflow',!observed.overflow,{pane:name,...observed});
   if(width<=800)check('V09',label+' '+name+' mobile tab selected',(await page.getByRole('tab',{name,exact:true}).getAttribute('aria-selected'))==='true');
   await capture(page,'V09-'+name.toLowerCase()+'-'+label);
  }
  if(width>800&&width<=1240){
   const dialog=page.locator('dialog.tw-panes-context[open]'),opener=page.getByRole('button',{name:'Open Steps',exact:true});
   check('V09',label+' Steps uses native modal',await dialog.evaluate(element=>element.matches(':modal')));
   const focusSequence=[];for(const key of ['Tab','Tab','Shift+Tab']){await page.keyboard.press(key);focusSequence.push(await page.evaluate(()=>({inside:!!document.activeElement?.closest('dialog[open]'),visible:!!document.activeElement?.getClientRects().length})));}
   check('V09',label+' Steps keyboard focus stays inside modal',focusSequence.every(x=>x.inside&&x.visible),{focusSequence});
   await page.keyboard.press('Escape');await page.locator('dialog.tw-panes-context[open]').waitFor({state:'hidden'});await settle(page);
   check('V09',label+' Steps Escape restores opener',await opener.evaluate(element=>element===document.activeElement));
   await choose(page,'Steps');await page.getByRole('button',{name:'Close Steps',exact:true}).click();await page.locator('dialog.tw-panes-context[open]').waitFor({state:'hidden'});await settle(page);
   check('V09',label+' Steps Close restores opener',await opener.evaluate(element=>element===document.activeElement));
  }
  await choose(page,'Evidence');
  const originalEvidence=page.locator('#evidence-'+a.presented_attempt_id+' details');
  if(!(await originalEvidence.evaluate(element=>element.open)))await originalEvidence.locator('summary').click();
  check('V09',label+' populated evidence retains exact original answer',(await originalEvidence.innerText()).includes(a.original_response.trim()),{originalAttemptId:a.presented_attempt_id});
  await capture(page,'V09-original-evidence-'+label);
  await choose(page,'Activity');await page.getByRole('button',{name:'Edit activity',exact:true}).click();
  const title=page.getByLabel('Activity title',{exact:true});await title.waitFor();
  const original=await title.inputValue();assert.equal(original,evidence.before.draft.activity.title);
  const local=original+' — local pane retention check';let changed=false;
  try{
   await title.fill(local);changed=true;
   await choose(page,'Evidence');await choose(page,'Steps');
   check('V09',label+' private save is offered for unsaved local edit',await page.getByRole('button',{name:'Save private revision',exact:true}).isEnabled(),{serverSaveAttempted:false});
   await choose(page,'Activity');assert.equal(await title.inputValue(),local);
   check('V09',label+' exact local Activity title survives all pane changes',true,{savedRevision:evidence.before.draft.revision});
   await page.getByRole('button',{name:'Student preview',exact:true}).click();
   await page.locator('.lp-intervention-student-preview').getByRole('heading',{name:local,exact:true}).waitFor();
   check('V09',label+' student preview reflects explicitly unsaved local edit',true,{serverSaveAttempted:false});await capture(page,'V09-unsaved-preview-'+label);
   await page.getByRole('button',{name:'Edit activity',exact:true}).click();assert.equal(await title.inputValue(),local);
  }finally{
   if(changed){await choose(page,'Activity');await page.getByRole('button',{name:'Edit activity',exact:true}).click();await title.fill(original);await settle(page);check('V09',label+' exact local title restored without Save',(await title.inputValue())===original);}
  }
  await choose(page,'Steps');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Save private revision'&&button.disabled));
  check('V09',label+' restored local edit is clean and cannot save unchanged revision',!(await page.getByRole('button',{name:'Save private revision',exact:true}).isEnabled()));
  await choose(page,'Activity');
 });
}
try{
 const base=await rt.launch('teacher');evidence.before=await get(base.context,api);
 assert.equal(evidence.before.draft.id,prep.draft_id);assert.equal(evidence.before.draft.status,'private_draft');assert.equal(evidence.before.approval,null);assert.equal(evidence.before.delivery,null);assert.deepEqual(evidence.before.draft.evidence.content_ref,a.content_ref);
 for(const [width,height] of [[1440,1000],[1024,768],[390,844],[320,844]]){await base.page.setViewportSize({width,height});await caseAt(base.page,width+'x'+height);}
 const zoom=await rt.launch('teacher',2);const metric=await zoom.page.evaluate(()=>({dpr:devicePixelRatio,innerWidth,innerHeight,rootZoom:getComputedStyle(document.documentElement).zoom,visualViewportScale:visualViewport?.scale}));
 const verified=metric.dpr>=1.95&&metric.dpr<=2.05&&metric.innerWidth<800&&['1','normal'].includes(metric.rootZoom)&&metric.visualViewportScale===1;
 check('ZOOM','Actual native 200% measured for populated private intervention',verified,metric);
 if(verified)await caseAt(zoom.page,'native200');else rt.unrun('V09','Native 200% private draft','Actual native zoom not established');
 evidence.after=await get(base.context,api);
 check('V09','Saved private activity, revision, approval, recipients and delivery unchanged by local checks',JSON.stringify(evidence.after)===JSON.stringify(evidence.before),{beforeSha256:hash(JSON.stringify(evidence.before)),afterSha256:hash(JSON.stringify(evidence.after)),actualSaveApprovalDeliveryCalls:0});
}catch(error){check('HARNESS','Populated V09 supplement setup',false,{error:String(error)});}
finally{await writeFile(join(rt.out,'api-evidence.json'),JSON.stringify(evidence,null,2)+'\n');await rt.finish();}
