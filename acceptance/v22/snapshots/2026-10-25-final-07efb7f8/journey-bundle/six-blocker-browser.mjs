/** Usage: node six-blocker-browser.mjs <runtime-final> <fresh-out> <playwright> <safety.mjs> [completed-preparation.json]
 * Verification only. Reuses PR123 pane geometry/history approach and PR122 source/guard contracts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hash, openRuntime, settle, SHA, TREE } from './read-only-runtime.mjs';
const [stateArg, outArg, playwrightArg, safetyArg, inputArg] = process.argv.slice(2);
const rt = await openRuntime({ stateArg, outArg, playwrightArg, safetyArg, inputArg, helper: 'six-original-blockers' });
const { report, check, unrun, run, capture, get } = rt;
report.harnessSha256 = hash(readFileSync(new URL(import.meta.url)));
report.upstream = ['PR123 tests/evidence-workspace-browser.mjs', 'PR122 shell-accessibility-browser.mjs'];
const prep = inputArg ? JSON.parse(readFileSync(inputArg, 'utf8')) : null;
if (prep) { assert.equal(prep.source_sha, SHA); assert.equal(prep.source_tree, TREE); assert.equal(prep.status, 'completed'); }
const assignment = '30000000-0000-4000-8000-000000000001';
const student = '10000000-0000-4000-8000-000000000002';
const evidenceURL = rt.manifest.origin + '/teacher/evidence?' + new URLSearchParams({ assignment, origin: 'synthetic_fixture', concept: 'transmission_delay' });
const progressURL = rt.manifest.origin + '/teacher/assignments?' + new URLSearchParams({ assignment, origin: 'all', view: 'progress', student,
  concept: 'transmission_delay', progressView: 'grid', pane: 'details', status: 'all' }) + '#cell-evidence';
async function observed(page) {
  await settle(page);
  return page.evaluate(() => {
    const rect = selector => { const e = document.querySelector(selector); if (!e || !e.getClientRects().length) return null;
      const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom }; };
    const list = document.querySelector('.wb-response-list'), scroller = list?.closest('.tw-panes-body') ?? list;
    const active = document.activeElement, ar = active?.getBoundingClientRect();
    return { url: location.href, innerWidth, innerHeight, dpr: devicePixelRatio, rootZoom: getComputedStyle(document.documentElement).zoom,
      layout: document.querySelector('.tw-panes')?.dataset.layout, activePane: document.querySelector('.tw-panes')?.dataset.activePane,
      activeId: active?.id, activeVisible: !!ar && ar.width > 0 && ar.height > 0 && ar.bottom > 0 && ar.top < innerHeight,
      listScrollTop: scroller?.scrollTop, listScrollHeight: scroller?.scrollHeight, listClientHeight: scroller?.clientHeight,
      rows: list?.querySelectorAll('[data-evidence-attempt]').length, scrollY,
      record: rect('#response-detail-title'), original: rect('.wb-original-response'), navigation: rect('.tw-panes-panel--navigation'),
      main: rect('.tw-panes-panel--main'), context: rect('.tw-panes-context'), mainBody:rect('.tw-panes-panel--main .tw-panes-body'),
      bottomNav: rect('.tw-bottom-nav'), answer: document.querySelector('.wb-original-response')?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
}
async function waitPanes(page) {
  await page.locator('.tw-panes').waitFor();
  await page.waitForFunction(()=>document.querySelector('.tw-panes')?.dataset.layout === (innerWidth<=800?'compact':innerWidth<=1240?'medium':'wide'));
  await settle(page);
}
async function waitEvidence(page) {
  await waitPanes(page);
  await page.waitForFunction(()=>{
    const expected=new URL(location.href).searchParams.get('attempt');
    return document.querySelectorAll('.wb-response-list').length===1 && (!expected || document.querySelector('.wb-response-list [data-evidence-attempt="'+expected+'"] a[aria-current="true"]'));
  });
  await settle(page); await page.waitForTimeout(550);
}
async function tabTo(page, id) {
  for(let n=0;n<250;n++) { if(await page.evaluate(id => document.activeElement?.id === id,id)) return n;
    await page.keyboard.press('Tab'); }
  throw Error('Keyboard did not reach response row ' + id);
}
async function evidenceCases(page, context, label) {
  await run('V02/V03', label + ' dedicated original-record geometry', page, async () => {
    await page.goto(evidenceURL); await waitEvidence(page);
    const link = page.locator('.wb-response-list [data-evidence-attempt] a[id]').first();
    const href = await link.getAttribute('href'), url = new URL(href, rt.manifest.origin);
    const session = await get(context, '/api/teacher/sessions/' + url.searchParams.get('session'));
    const attempt = session.attempts.find(a=>a.id===url.searchParams.get('attempt')); assert.ok(attempt);
    await link.click(); await page.waitForURL(url.href); await waitEvidence(page);
    const o = await observed(page); report.observations.push({label,...o});
    check('V02', label + ' original answer is exact', o.answer === attempt.response_text, {attemptId:attempt.id, sourceVersion:attempt.question.content_ref});
    check('V02', label + ' record opens immediately near top', !!o.record && o.record.y>=0 && o.record.y<600 && (o.innerWidth>800 || o.activePane==='main'),o);
    check('V02', label + ' record is above fixed navigation', !!o.mainBody && o.mainBody.bottom <= (o.bottomNav?.y ?? o.innerHeight)+1,o);
    check('V03', label + ' no horizontal overflow', !o.overflow,o);
    if(o.innerWidth>1240) check('V03', label + ' list/record/context are adjacent', !!o.navigation && !!o.main && !!o.context &&
      Math.abs(o.navigation.width-330)<=2 && Math.abs(o.context.width-360)<=2 && o.navigation.x+o.navigation.width<=o.main.x+2 &&
      o.main.x+o.main.width<=o.context.x+2,o);
    if(o.innerWidth>800 && o.innerWidth<=1240) {
      const opener=page.getByRole('button',{name:'Open Context',exact:true}); await opener.click();
      await page.locator('dialog.tw-panes-context[open]').waitFor();
      check('V03', label + ' tablet context drawer opens',await opener.getAttribute('aria-expanded')==='true');
      await capture(page,'V03-context-'+label); await page.keyboard.press('Escape');
      await page.locator('dialog.tw-panes-context[open]').waitFor({state:'hidden'});
      check('V03',label+' context Escape restores opener',await opener.evaluate(e=>document.activeElement===e));
    }
    await capture(page,'V02-V03-selected-'+label);
    await page.reload(); await waitEvidence(page);
    check('V02',label+' direct reload retains exact selected answer',(await observed(page)).answer===attempt.response_text);
  });
  await run('F1',label+' native Back/Forward and originating scroll',page,async()=>{
    await page.goto(evidenceURL); await waitEvidence(page);
    const links=page.locator('.wb-response-list [data-evidence-attempt] a[id]'); assert.ok(await links.count());
    for(const which of ['first','last']) {
      await page.goto(evidenceURL); await waitEvidence(page);
      const row=which==='first'?links.first():links.last(); const id=await row.getAttribute('id');
      const href=new URL(await row.getAttribute('href'),rt.manifest.origin).href;
      const tabs=await tabTo(page,id); const before=await observed(page);
      await page.keyboard.press('Enter'); await page.waitForURL(href); await waitEvidence(page);
      const selected=await observed(page); const answer=selected.answer;
      check('F1',label+' '+which+' keyboard opens record',selected.activeId==='response-detail-title' && selected.activeVisible,{tabs,...selected});
      await page.goBack(); await page.waitForURL(evidenceURL); await waitEvidence(page); const back=await observed(page);
      check('F1',label+' '+which+' Back restores originating row',back.activeId===id && back.activeVisible,{expectedFocus:id,before,back});
      check('F1',label+' '+which+' Back restores scroll position',Math.abs(back.listScrollTop-before.listScrollTop)<=4,{before,back});
      if(which==='last' && before.listScrollHeight<=before.listClientHeight+1) unrun('F1',label+' nonzero long-list scroll','Current authorized fixture list does not overflow; needs normal --class fixture and new run');
      await capture(page,'F1-'+which+'-back-'+label); await page.goForward(); await page.waitForURL(href); await waitEvidence(page);
      const forward=await observed(page); check('F1',label+' '+which+' Forward retains original record',forward.answer===answer && forward.activeId==='response-detail-title',forward);
    }
  });
}
async function navCases(page,label) {
  await run('S1',label+' course Assignments opens discovery',page,async()=>{
    await page.goto(progressURL); await page.getByRole('heading',{name:'Class progress',exact:true}).waitFor();
    const width=await page.evaluate(()=>innerWidth);
    const link=width<=800?page.getByRole('link',{name:'Back to course assignments',exact:true}):page.getByRole('navigation',{name:'Course workspace',exact:true}).getByRole('link',{name:'Assignments',exact:true});
    const href=await link.getAttribute('href'); await link.click(); await page.waitForURL(u=>u.pathname==='/teacher/assignments'&&!u.searchParams.has('view'));
    await page.getByRole('heading',{name:'Assignments',exact:true}).waitFor();
    check('S1',label+' discovery clears selected assignment',!new URL(page.url()).searchParams.has('assignment'),{href,url:page.url()}); await capture(page,'S1-'+label);
  });
  await run('C2',label+' Class Progress read-in-full displayed return',page,async()=>{
    await page.goto(progressURL); await page.getByRole('link',{name:'Read in full',exact:true}).first().waitFor();
    const link=page.getByRole('link',{name:'Read in full',exact:true}).first(); const before=page.url();
    await link.click(); await page.waitForURL(u=>u.pathname.startsWith('/teacher/sessions/'));
    const back=page.locator('.lp-evidence-page').getByRole('link',{name:/^Back to /}).first();
    const backHref=await back.getAttribute('href'); await back.click();
    await page.waitForURL(new URL(backHref,rt.manifest.origin).href); await page.getByRole('heading',{name:'Class progress',exact:true}).waitFor();
    await page.waitForTimeout(550); const after=new URL(page.url());
    const expected={assignment,student,concept:'transmission_delay',view:'progress',progressView:'grid',pane:'details'};
    check('C2',label+' preserves assignment/student/concept/view/pane',Object.entries(expected).every(([k,v])=>after.searchParams.get(k)===v),{before,after:after.href,backHref,expected});
    const focus=await page.evaluate(()=>({id:document.activeElement?.id,visible:!!document.activeElement?.getClientRects().length}));
    check('C2',label+' displayed return restores Details focus',focus.id==='cell-evidence'&&focus.visible,{focus,hash:after.hash});
    await capture(page,'C2-'+label); await page.reload(); await page.getByRole('heading',{name:'Class progress',exact:true}).waitFor();
    check('C2',label+' refreshed return URL stays scoped',page.url()===after.href,{url:page.url()});
  });
}
async function interventionCases(page,label) {
  await run('V09',label+' Evidence Activity Steps panes',page,async()=>{
    const url=prep?.teacher_url ?? '/teacher/interventions?'+new URLSearchParams({assignment,origin:'all',concept:'transmission_delay'});
    await page.goto(new URL(url,rt.manifest.origin).href); await page.locator('.lp-intervention-workspace .tw-panes').waitFor(); await waitPanes(page);
    const width=await page.evaluate(()=>innerWidth), selected=[];
    const choose=async name=>{if(width<=800){const tab=page.getByRole('tab',{name,exact:true});await tab.click();assert.equal(await tab.getAttribute('aria-selected'),'true');}
      else if(width<=1240&&name==='Steps'){const open=page.getByRole('button',{name:'Open Steps',exact:true});if(await open.getAttribute('aria-expanded')!=='true')await open.click();}};
    for(const name of ['Evidence','Activity','Steps']) {
      await choose(name); const heading=page.locator('.tw-panes-heading').filter({hasText:new RegExp('^'+name+'$')});
      check('V09',label+' '+name+' pane visible',await heading.isVisible());
      selected.push({name,url:page.url()}); await capture(page,'V09-'+name.toLowerCase()+'-'+label);
    }
    if(width>800&&width<=1240){await page.keyboard.press('Escape');await page.locator('dialog.tw-panes-context[open]').waitFor({state:'hidden'});
      check('V09',label+' Steps Escape restores opener',await page.getByRole('button',{name:'Open Steps',exact:true}).evaluate(e=>e===document.activeElement));}
    await choose('Activity');
    const direction=page.getByRole('textbox',{name:prep?'What should change?':'Optional teaching direction',exact:true});
    if(await direction.count() && await direction.isEnabled()) {
      const original=await direction.inputValue(),sentinel=original+' Local pane retention check.';
      try{await direction.fill(sentinel);await choose('Evidence');await choose('Steps');
        if(width>800&&width<=1240)await page.keyboard.press('Escape');await choose('Activity');
        check('V09',label+' local editing survives all pane changes',await direction.inputValue()===sentinel,{databaseSaveAttempted:false});}
      finally{if(width>800&&width<=1240&&await page.locator('dialog.tw-panes-context').evaluate(e=>e.open))await page.keyboard.press('Escape');await choose('Activity');await direction.fill(original);}
    } else unrun('V09',label+' local edit retention','This lifecycle state has no enabled revision/preparation textbox');
    const o=await observed(page);check('V09',label+' no horizontal overflow',!o.overflow,o);report.observations.push({label:'V09 panes '+label,selected});
  });
}
try {
  const {page,context}=await rt.launch();
  for(const [width,height] of [[1440,1000],[1024,768],[390,844],[320,844]]){
    await page.setViewportSize({width,height});const label=width+'x'+height;
    await evidenceCases(page,context,label);await navCases(page,label);await interventionCases(page,label);
  }
  const native=await rt.launch('teacher',2); const m=await observed(native.page);
  check('ZOOM','Native 200% is measured',m.dpr>=1.95&&m.dpr<=2.05&&m.innerWidth<800&&['1','normal'].includes(m.rootZoom),m);
  if(m.dpr>=1.95&&m.dpr<=2.05){await evidenceCases(native.page,native.context,'native200');await navCases(native.page,'native200');await interventionCases(native.page,'native200');}
  else unrun('ZOOM','Six-blocker native200 cases','Native browser zoom not established');
  unrun('V09','Save/recipient approval/delivery/follow-up lifecycle','Run the separately guarded same-record intervention continuation; these read-only cases do not prove persistence');
}catch(error){check('HARNESS','Runtime setup',false,{error:String(error)});}
finally{await rt.finish();}
