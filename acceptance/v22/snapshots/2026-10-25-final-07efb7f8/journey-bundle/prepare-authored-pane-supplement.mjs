// Offline construction: no browser or application calls.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=dirname(fileURLToPath(import.meta.url));
const input=readFileSync(join(folder,'shell-accessibility-supplement.mjs'),'utf8');
const target=join(folder,'authored-pane-retention-supplement.mjs');assert.equal(existsSync(target),false);
let method=input.slice(input.indexOf('async function authoredPaneCheck'),input.indexOf('\ntry{\n  const {page,context}'));
assert.ok(method.startsWith('async function authoredPaneCheck')&&method.trimEnd().endsWith('}'));
method=method.replace('  await ready(page);','  await diagnostics(page,"after-navigation");');
const start=method.indexOf('  await page.waitForFunction('),end=method.indexOf('  assert.equal(await input.count()',start);
assert.ok(start>0&&end>start);
method=method.slice(0,start)+String.raw`  // This direct child label is the objective wording. Supporting quote/note
  // textareas are nested inside details and are not the requested control.
  const input=page.locator('.lo-objective > label.lp-field > textarea:visible');
  await input.waitFor({state:'visible',timeout:25000});
  await diagnostics(page,'exact-objective-field-ready');
`+method.slice(end);
method=method.replace('    await input.fill(localText);',String.raw`    await input.fill(localText);
    // Establish actual React form-state change through rendered user-visible
    // behavior, instead of depending on React's private DOM property names.
    await page.locator('.lo-record-heading').getByText('Unsaved changes',{exact:true}).waitFor({state:'visible'});
    await diagnostics(page,'local-edit-observed-in-ui');`);
const prefix=String.raw`/** Third-case-only supplement. No application mutations after fictional login.
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
`;
const tail=String.raw`
try{
  const {page,context}=await rt.launch('teacher');
  await rt.run('authored-pane-retention','Exact authored objective retains local edits across mobile panes',page,async()=>{
    try{await authoredPaneCheck(page,context);}
    catch(error){await diagnostics(page,'failure-diagnostics').catch(()=>{});throw error;}
  });
}catch(error){rt.check('HARNESS','Authoring supplement startup',false,{error:String(error)});}
finally{await rt.finish();}
`;
writeFileSync(target,prefix+method+tail);console.log(target);
