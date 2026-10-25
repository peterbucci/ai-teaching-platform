// Offline construction only. Reads preserved harness; never launches a browser.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=dirname(fileURLToPath(import.meta.url));
const original=readFileSync(join(folder,'shell-accessibility-browser.mjs'),'utf8');
const target=join(folder,'shell-accessibility-supplement.mjs');
assert.equal(existsSync(target),false,'Never overwrite a prepared or executed helper');
function extract(from,to){ const start=original.indexOf(from), end=original.indexOf(to,start); assert.ok(start>=0&&end>start); return original.slice(start,end); }
const focus=extract('const focus = (page) =>','function check(');
const scope=extract('async function scopeDialog','const assignment =');
let evidence=extract('async function evidenceHistory','async function authoredPaneCheck');
evidence=evidence.replace('await page.goto(baseURL);','await page.goto(baseURL);\n  await ready(page);');
evidence=evidence.replaceAll('page.locator("#response-detail-title")','page.locator("#response-detail-title:visible")');
evidence=evidence.replace("document.getElementById(focusId)?.closest('[data-evidence-attempt]')","[...document.querySelectorAll('[id]')].find(element=>element.id===focusId&&element.getClientRects().length)?.closest('[data-evidence-attempt]')");
evidence=evidence.replace("const list=document.querySelector('.wb-response-list');","const list=[...document.querySelectorAll('.wb-response-list')].find(element=>element.getClientRects().length);");
evidence=evidence.replace('await page.locator(".tw-shell").waitFor();','await ready(page);');
evidence=evidence.replace("status:'unrun'","status:'unrun'");
const prefix=String.raw`/** Narrow read-only supplement for three preserved shell-accessibility-01 harness failures.
 * node shell-accessibility-supplement.mjs <state> <fresh-out> <playwright> <safety.mjs> <authoring-report.json>
 * No record mutations after fictional login. Original history record/focus/scroll assertions retained.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openRuntime,hash,SHA,TREE,settle} from './read-only-runtime.mjs';
const [stateArg,outArg,playwrightArg,safetyArg,inputArg]=process.argv.slice(2);
assert.ok(inputArg);
const authoring=JSON.parse(readFileSync(inputArg,'utf8').replace(/^\uFEFF/,''));
assert.equal(authoring.status,'passed');assert.equal(authoring.sourceSha,SHA);assert.equal(authoring.sourceTree,TREE);
assert.equal(authoring.functional_completed_through,'teacher-original-evidence');assert.equal(authoring.paid_calls,0);
const rt=await openRuntime({stateArg,outArg,playwrightArg,safetyArg,inputArg,helper:'shell-accessibility-three-case-supplement'});
const {report}=rt,origin=rt.manifest.origin;
report.harnessSha256=hash(readFileSync(new URL(import.meta.url)));
report.supplement={priorRun:'shell-accessibility-01',priorReportSha256:hash(readFileSync(new URL('../shell-accessibility-01/report.json',import.meta.url))),
  reason:'Desktop Overview has no visible switcher by design; test assignment workspace opener. Bound keyboard traversal by measured tabbable count. Wait for hydrated unique visible objective editor, not first hidden streaming match.',
  assertions:'Existing record identity, exact original text, page-owned focus, visible originating row and four-pixel scroll tolerance are retained. Earlier failures are unchanged.'};
// Correct sibling report path relative to this bundle is supplied below by offline construction.
let caseId='setup';
const check=(label,passed,detail={},owner)=>rt.check(caseId,label,passed,{...detail,...(owner?{owner}:{})});
const screenshot=(page,name)=>rt.capture(page,name);
async function ready(page){
  await page.waitForFunction(()=>{
    const shells=[...document.querySelectorAll('.tw-shell[data-scope]')].filter(e=>e.getClientRects().length);
    if(shells.length!==1)return false;
    const trigger=shells[0].querySelector('.tw-scope-switch');
    return !!trigger&&Object.keys(trigger).some(k=>k.startsWith('__reactProps$')&&typeof trigger[k]?.onClick==='function');
  },undefined,{timeout:25000});
  await settle(page);
}
async function tabTo(page,predicate,label,key='Tab'){
  const count=await page.evaluate(()=>[...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].filter(e=>
    e.tabIndex>=0&&!e.matches(':disabled')&&!e.closest('[inert]')&&e.getClientRects().length&&getComputedStyle(e).visibility==='visible').length);
  const bound=count*2+20;
  assert.ok(count>0&&bound<=2000,'Unexpected focusable count; refuse unbounded traversal');
  for(let tabs=1;tabs<=bound;tabs++){
    await page.keyboard.press(key);const current=await focus(page);
    if(predicate(current)){report.observations.push({label,key,tabs,measuredTabbableCount:count,bound,focus:current});return current;}
  }
  throw new Error('Keyboard target not reached after measured traversal bound: '+label+' ('+bound+')');
}
`;
const authored=String.raw`
async function authoredPaneCheck(page,context){
  await page.setViewportSize({width:390,height:844});
  const path='/api/teacher/objectives/'+authoring.lesson_id;
  const before=await rt.get(context,path);
  const objective=before.lesson?.draft?.objective_workflow?.items?.[0];
  assert.ok(objective?.concept_id&&typeof objective.objective==='string','Saved objective receipt is required');
  report.objectiveReceiptBeforeSha256=hash(JSON.stringify(before));
  await page.goto(origin+'/teacher/objectives/'+encodeURIComponent(authoring.lesson_id)+'?objective='+encodeURIComponent(objective.concept_id));
  await ready(page);
  const panes=page.locator('nav[aria-label="Authoring panes"]:visible');
  await panes.waitFor({state:'visible'});assert.equal(await panes.count(),1);
  const editor=panes.getByRole('button',{name:'Editor',exact:true});
  await editor.click();
  await page.waitForFunction(()=>{
    const fields=[...document.querySelectorAll('.lo-objective textarea')].filter(e=>e.getClientRects().length);
    return fields.length===1&&Object.keys(fields[0]).some(k=>k.startsWith('__reactProps$')&&typeof fields[0][k]?.onChange==='function');
  },undefined,{timeout:25000});
  const input=page.locator('.lo-objective textarea:visible');
  assert.equal(await input.count(),1,'Source renders one selected objective; no arbitrary first match');
  const association=await input.evaluate(e=>({label:e.closest('label')?.textContent.trim(),article:e.closest('article')?.getAttribute('aria-labelledby')}));
  assert.equal(association.label,'Learning objective');assert.equal(association.article,'concept-label-'+objective.concept_id);
  const original=await input.inputValue();assert.equal(original,objective.objective,'Exact saved objective must precede local edits');
  const localText=original+' Local unsaved pane-retention verification.';
  const receipts={before};
  try{
    await input.fill(localText);
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
  const {page,context}=await rt.launch('teacher');await ready(page);
  caseId='desktop-scope-keyboard';
  await rt.run(caseId,'Desktop assignment switcher keyboard dialog',page,async()=>{
    await page.goto(origin+'/teacher/assignments?assignment='+assignment+'&view=progress&origin=all');await ready(page);
    const opener=page.locator('button.tw-assignment-switch:visible');await opener.waitFor();assert.equal(await opener.count(),1);
    report.observations.push({label:'Desktop opener scope',url:page.url(),hiddenGenericSwitchCount:await page.locator('.tw-scope-switch:visible').count(),assignmentSwitchCount:await opener.count()});
    await scopeDialog(page,'Desktop assignment scope dialog');await screenshot(page,'desktop-assignment-switcher-restored');
  });
  caseId='evidence-page-owned-history';
  await rt.run(caseId,'Repeated Evidence URL and native history with measured keyboard traversal',page,()=>evidenceHistory(page));
  caseId='authored-pane-retention';
  await rt.run(caseId,'Exact authored objective retains local edits across mobile panes',page,()=>authoredPaneCheck(page,context));
}catch(error){rt.check('HARNESS','Supplement startup',false,{error:String(error)});}
finally{await rt.finish();}
`;
let script=prefix+focus+scope+'\nconst assignment="30000000-0000-4000-8000-000000000001";\n'+evidence+authored;
script=script.replace('// Correct sibling report path relative to this bundle is supplied below by offline construction.\n','');
writeFileSync(target,script);
console.log(target);
