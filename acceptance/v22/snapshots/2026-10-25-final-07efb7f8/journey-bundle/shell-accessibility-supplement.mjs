/** Narrow read-only supplement for three preserved shell-accessibility-01 harness failures.
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
const focus = (page) =>
  page.evaluate(() => {
    const element = document.activeElement;
    return {
      tag: element.tagName,
      id: element.id,
      className: element.className,
      text: (element.getAttribute("aria-label") || element.textContent || "")
        .trim()
        .slice(0, 180),
      href: element.getAttribute("href"),
      controls: element.getAttribute("aria-controls"),
      name: element.getAttribute("name"),
      inDialog: Boolean(element.closest("dialog[open]")),
      visible: element.getClientRects().length > 0,
      outline: getComputedStyle(element).outline,
      scrollY,
    };
  });
async function scopeDialog(page, label) {
  const before = await tabTo(
    page,
    (current) =>
      current.tag === "BUTTON" &&
      current.controls === "teacher-workspace-switcher",
    label + " trigger",
    "Shift+Tab",
  );
  await page.keyboard.press("Enter");
  await page.locator("#teacher-workspace-switcher[open]").waitFor();
  const sequence = [];
  for (const key of ["Tab", "Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    sequence.push(await focus(page));
  }
  check(
    label + " keyboard focus remains inside dialog",
    sequence.every((item) => item.inDialog && item.visible),
    { sequence },
    "#120",
  );
  await page.keyboard.press("Escape");
  await page
    .locator("#teacher-workspace-switcher[open]")
    .waitFor({ state: "hidden" });
  await settle(page);
  const after = await focus(page);
  check(
    label + " Escape restores opener",
    after.tag === before.tag &&
      after.className === before.className &&
      after.text === before.text &&
      after.visible,
    { before, after },
    "#120",
  );
}

const assignment="30000000-0000-4000-8000-000000000001";
async function evidenceHistory(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const baseURL =
    origin +
    "/teacher/evidence?" +
    new URLSearchParams({
      assignment,
      origin: "synthetic_fixture",
      concept: "transmission_delay",
    });
  await page.goto(baseURL);
  await ready(page);
  const list = page.locator(".wb-response-list:visible");
  await list.waitFor();
  await settle(page);
  const ids = await list
    .locator("[data-evidence-attempt]")
    .evaluateAll((rows) => rows.map((row) => row.dataset.evidenceAttempt));
  assert.ok(
    ids.length >= 2,
    "Two seeded original responses are required for history checks.",
  );
  const first = ids[0],
    last = ids.at(-1);
  const overflowing = await list.evaluate(
    (element) => { const scroller=element.closest('.tw-panes-body')??element; return scroller.scrollHeight > scroller.clientHeight + 1; },
  );
  report.observations.push({
    label: "Evidence history fixture",
    rows: ids.length,
    first,
    last,
    overflowing,
  });
  if(!overflowing) report.checks.push({label:'F1 nonzero long-list scroll',status:'unrun',reason:'Authorized current response list does not overflow its actual pane scroller; no fixture mutation performed.'});
  async function inspect(label, expectedURL, attempt, focusId, expectedRecord) {
    await page.waitForURL(expectedURL);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".wb-response-list")].filter(
          (element) => element.getClientRects().length,
        ).length === 1,
    );
    await list
      .locator(`[data-evidence-attempt="${attempt}"] a[aria-current="true"]`)
      .waitFor();
    await page.locator("#response-detail-title:visible").waitFor();
    await settle(page);
    // Sample after router/effect placement, without manually setting focus or scroll.
    await page.waitForTimeout(180);
    const observed = await page.evaluate((focusId) => {
      const list = [...document.querySelectorAll(".wb-response-list")].find(
        (element) => element.getClientRects().length,
      );
      const current = list.querySelector("a[aria-current='true']");
      const row = current.closest("[data-evidence-attempt]");
      const scroller=list.closest('.tw-panes-body')??list;
      const listBounds = scroller.getBoundingClientRect(),
        rowBounds = row.getBoundingClientRect();
      const targetRow=([...document.querySelectorAll('[id]')].find(element=>element.id===focusId&&element.getClientRects().length)?.closest('[data-evidence-attempt]'))??row;
      const targetBounds=targetRow.getBoundingClientRect();
      const active = document.activeElement,
        activeBounds = active.getBoundingClientRect();
      const state = history.state;
      return {
        url: location.href,
        selectedAttempt: row.dataset.evidenceAttempt,
        originalResponse: [
          ...document.querySelectorAll(".wb-original-response"),
        ].find((element) => element.getClientRects().length)?.textContent,
        activeId: active.id,
        activeTag: active.tagName,
        focusVisible:
          activeBounds.width > 0 &&
          activeBounds.height > 0 &&
          activeBounds.bottom > 0 &&
          activeBounds.top < innerHeight,
        selectedRowVisibleInList:
          rowBounds.bottom > listBounds.top &&
          rowBounds.top < listBounds.bottom,
        targetRowVisibleInList:targetBounds.bottom>listBounds.top&&targetBounds.top<listBounds.bottom,
        listScrollTop: scroller.scrollTop,
        listClientHeight: scroller.clientHeight,
        listScrollHeight: scroller.scrollHeight,
        windowScrollY: scrollY,
        entryToken:
          state && typeof state === "object"
            ? state.__learningPulseWorkspaceEntry
            : undefined,
      };
    },focusId);
    check(
      label + " preserves exact selected record",
      observed.url === expectedURL &&
        observed.selectedAttempt === attempt &&
        typeof observed.originalResponse === "string" &&
        observed.originalResponse.trim().length > 0,
      observed,
      "#116 / #120",
    );
    check(
      label + " restores page-owned focus",
      observed.activeId === focusId && observed.focusVisible,
      { expectedFocus: focusId, ...observed },
      "#116 / #120",
    );
    check(
      label + " keeps the intended focus row visible in its actual pane scroller",
      observed.targetRowVisibleInList,
      observed,
      "#116 / #120",
    );
    if (expectedRecord) {
      check(
        label + " preserves original response text",
        observed.originalResponse === expectedRecord.originalResponse,
        { expectedAttempt: attempt, actualAttempt: observed.selectedAttempt },
        "#116 / #120",
      );
      check(
        label + " restores the known list position",
        Math.abs(observed.listScrollTop - expectedRecord.listScrollTop) <= 4,
        {
          expectedScrollTop: expectedRecord.listScrollTop,
          actualScrollTop: observed.listScrollTop,
          tolerancePixels: 4,
        },
        "#116 / #120",
      );
    }
    return observed;
  }
  async function choose(attempt, label) {
    const link = list.locator(`#evidence-response-${attempt}`);
    const expectedURL = new URL(await link.getAttribute("href"), origin).href;
    const targetId=`evidence-response-${attempt}`;
    if((await focus(page)).id!==targetId)await tabTo(page,current=>current.id===targetId,label+' actual keyboard originating row');
    await settle(page);
    const departure=await page.evaluate(()=>{const list=[...document.querySelectorAll('.wb-response-list')].find(element=>element.getClientRects().length);const scroller=list.closest('.tw-panes-body')??list;return{url:location.href,activeId:document.activeElement.id,listScrollTop:scroller.scrollTop};});
    await page.keyboard.press('Enter');
    return {arrived:await inspect(label,expectedURL,attempt,'response-detail-title'),departure};
  }
  const firstVisit = await choose(first, "Evidence first A entry"),a1=firstVisit.arrived;
  const secondVisit = await choose(last, "Evidence B entry"),b=secondVisit.arrived;
  const repeatedVisit = await choose(first, "Evidence repeated A entry"),a2=repeatedVisit.arrived;
  const a1Departure={...a1,listScrollTop:secondVisit.departure.listScrollTop};
  const bDeparture={...b,listScrollTop:repeatedVisit.departure.listScrollTop};
  const baseDeparture={...a1,listScrollTop:firstVisit.departure.listScrollTop};
  report.observations.push({label:'Actual originating row and scroll at each keyboard departure',first:firstVisit.departure,second:secondVisit.departure,repeated:repeatedVisit.departure});
  check("Evidence actual links revisit the identical URL", a1.url === a2.url, {
    first: a1.url,
    repeat: a2.url,
  });
  check(
    "Repeated Evidence URL preserves the exact original response",
    a1.originalResponse === a2.originalResponse,
    { attempt: first },
    "#116 / #120",
  );
  report.observations.push({
    label: "Repeated-URL entry identities (opaque diagnostics only)",
    first: a1.entryToken,
    repeat: a2.entryToken,
  });
  await screenshot(page, "evidence-repeated-A-entry");
  await page.goBack();
  await inspect("Evidence Back to B", b.url, last, repeatedVisit.departure.activeId, bDeparture);
  await page.goBack();
  await inspect(
    "Evidence Back to first A",
    a1.url,
    first,
    secondVisit.departure.activeId,
    a1Departure,
  );
  await page.goBack();
  await inspect(
    "Evidence Back to originating row",
    baseURL,
    first,
    `evidence-response-${first}`,
    baseDeparture,
  );
  await screenshot(page, "evidence-originating-row-restored");
  await page.goForward();
  await inspect(
    "Evidence Forward to first A",
    a1.url,
    first,
    secondVisit.departure.activeId,
    a1Departure,
  );
  await page.goForward();
  await inspect(
    "Evidence Forward to B",
    b.url,
    last,
    repeatedVisit.departure.activeId,
    bDeparture,
  );
  await page.goForward();
  await inspect(
    "Evidence Forward to repeated A",
    a2.url,
    first,
    "response-detail-title",
    a2,
  );
  await page.reload();
  await inspect(
    "Evidence repeated-URL reload selection/hash",
    a2.url,
    first,
    "response-detail-title",
  );

  // Anonymous filters must not resurrect a formerly focused response row.
  await page.goto(baseURL);
  await list.waitFor();
  await list.locator(`#evidence-response-${first}`).focus();
  await page.getByLabel("Find a response", { exact: true }).click();
  await settle(page);
  const before = await focus(page);
  await page
    .getByRole("navigation", { name: "Course workspace", exact: true })
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === "/teacher");
  await ready(page);
  await page.goBack();
  await page.waitForURL(baseURL);
  await list.waitFor();
  await settle(page);
  await page.waitForTimeout(180);
  const after = await focus(page);
  check(
    "Anonymous Evidence filter does not restore stale response-row focus",
    !after.id.startsWith("evidence-response-") &&
      Math.abs(after.scrollY - before.scrollY) <= 4,
    { before, after, exactAnonymousControlRestorationRequired: false },
    "#120",
  );
  await screenshot(page, "evidence-anonymous-filter-history");
}

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
