/** Third-case-only supplement. No application mutations after fictional login.
 * node authored-pane-retention-supplement.mjs <state> <fresh-out> <playwright> <safety> <authoring-report>
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openRuntime,hash,SHA,TREE} from './read-only-runtime.mjs';
const [stateArg,outArg,playwrightArg,safetyArg,inputArg]=process.argv.slice(2);
const authoring=JSON.parse(readFileSync(inputArg,'utf8').replace(/^\uFEFF/,''));
assert.equal(authoring.status,'passed');assert.equal(authoring.sourceSha,SHA);assert.equal(authoring.sourceTree,TREE);
assert.equal(authoring.functional_completed_through,'teacher-original-evidence');assert.equal(authoring.paid_calls,0);
const rt=await openRuntime({stateArg,outArg,playwrightArg,safetyArg,inputArg,helper:'authoring-mobile-pane-retention-only'});
const {report}=rt,origin=rt.manifest.origin;
report.harnessSha256=hash(readFileSync(new URL(import.meta.url)));
report.supplement={priorRuns:['shell-accessibility-01','shell-accessibility-02'],
  priorSha256:['shell-accessibility-01','shell-accessibility-02'].map(name=>hash(readFileSync(new URL('../'+name+'/report.json',import.meta.url)))),
  reason:'Prior screenshots show the requested field. Replace undocumented React property and overly broad textarea predicates with the source-defined direct Learning objective label; observe actual Unsaved changes UI before pane navigation. Exact prior wait phase was not recorded and is not inferred.',
  scope:'Only mobile authored objective pane retention; all earlier scope/history passes and failures are preserved.'};
const check=(label,passed,detail={},owner)=>rt.check('authored-pane-retention',label,passed,{...detail,...(owner?{owner}:{})});
const screenshot=(page,name)=>rt.capture(page,name);
async function diagnostics(page,label){
  report.observations.push({label,url:page.url(),dom:await page.evaluate(()=>({
    shells:[...document.querySelectorAll('.tw-shell')].map(e=>({scope:e.getAttribute('data-scope'),rects:e.getClientRects().length})),
    panes:[...document.querySelectorAll('nav[aria-label="Authoring panes"]')].map(e=>({rects:e.getClientRects().length,text:e.textContent})),
    objectiveTextareas:[...document.querySelectorAll('.lo-objective textarea')].map(e=>({label:e.closest('label')?.textContent.trim(),rects:e.getClientRects().length,visible:getComputedStyle(e).visibility,detailsOpen:e.closest('details')?.open??null,directLabel:e.parentElement?.parentElement?.matches('.lo-objective'),placeholder:e.getAttribute('placeholder')})),
    activePane:[...document.querySelectorAll('.aw-workspace')].map(e=>e.getAttribute('data-active-pane'))
  }))});await rt.save();
}
async function authoredPaneCheck(page,context){
  await page.setViewportSize({width:390,height:844});
  const path='/api/teacher/objectives/'+authoring.lesson_id;
  const before=await rt.get(context,path);
  const objective=before.lesson?.draft?.objective_workflow?.items?.[0];
  assert.ok(objective?.concept_id&&typeof objective.objective==='string','Saved objective receipt is required');
  report.objectiveReceiptBeforeSha256=hash(JSON.stringify(before));
  await page.goto(origin+'/teacher/objectives/'+encodeURIComponent(authoring.lesson_id)+'?objective='+encodeURIComponent(objective.concept_id));
  await diagnostics(page,"after-navigation");
  const panes=page.locator('nav[aria-label="Authoring panes"]:visible');
  await panes.waitFor({state:'visible'});assert.equal(await panes.count(),1);
  const editor=panes.getByRole('button',{name:'Editor',exact:true});
  await editor.click();
  // This direct child label is the objective wording. Supporting quote/note
  // textareas are nested inside details and are not the requested control.
  const input=page.locator('.lo-objective > label.lp-field > textarea:visible');
  await input.waitFor({state:'visible',timeout:25000});
  await diagnostics(page,'exact-objective-field-ready');
  assert.equal(await input.count(),1,'Source renders one selected objective; no arbitrary first match');
  const association=await input.evaluate(e=>({label:e.closest('label')?.textContent.trim(),article:e.closest('article')?.getAttribute('aria-labelledby')}));
  assert.equal(association.label,'Learning objective');assert.equal(association.article,'concept-label-'+objective.concept_id);
  const original=await input.inputValue();assert.equal(original,objective.objective,'Exact saved objective must precede local edits');
  const localText=original+' Local unsaved pane-retention verification.';
  const receipts={before};
  try{
    await input.fill(localText);
    // Establish actual React form-state change through rendered user-visible
    // behavior, instead of depending on React's private DOM property names.
    await page.locator('.lo-record-heading').getByText('Unsaved changes',{exact:true}).waitFor({state:'visible'});
    await diagnostics(page,'local-edit-observed-in-ui');
    await panes.getByRole('button',{name:'Reading',exact:true}).click();
    const reading=page.locator('.aw-reading-pane:visible');await reading.waitFor();assert.equal(await reading.count(),1);
    const readingText=await reading.innerText();
    check('Mobile authored reading shows pinned source words',readingText.includes('Evaporation')&&readingText.includes('water vapor'),{source_id:authoring.source_id,source_version:authoring.source_version},'#118');
    await screenshot(page,'authored-mobile-reading-with-unsaved-work');
    await panes.getByRole('button',{name:'Outline',exact:true}).click();
    await editor.click();await input.waitFor({state:'visible'});
    check('Unsaved objective survives Reading/Outline/Editor pane changes',(await input.inputValue())===localText,{lesson_id:authoring.lesson_id,server_save_attempted:false},'#118');
    await screenshot(page,'authored-mobile-unsaved-restored');
  }finally{
    await editor.click();await input.waitFor({state:'visible'});await input.fill(original);
    check('Local verification edit restored without saving',(await input.inputValue())===original,{},'#118');
    const after=await rt.get(context,path);receipts.after=after;
    report.objectiveReceiptAfterSha256=hash(JSON.stringify(after));
    check('Saved objectives and approval metadata remain unchanged',JSON.stringify(before)===JSON.stringify(after),{beforeSha256:report.objectiveReceiptBeforeSha256,afterSha256:report.objectiveReceiptAfterSha256},'#118');
    await writeFile(join(rt.out,'objective-read-only-receipts.json'),JSON.stringify(receipts,null,2)+'\n');
  }
}
try{
  const {page,context}=await rt.launch('teacher');
  await rt.run('authored-pane-retention','Exact authored objective retains local edits across mobile panes',page,async()=>{
    try{await authoredPaneCheck(page,context);}
    catch(error){await diagnostics(page,'failure-diagnostics').catch(()=>{});throw error;}
  });
}catch(error){rt.check('HARNESS','Authoring supplement startup',false,{error:String(error)});}
finally{await rt.finish();}
