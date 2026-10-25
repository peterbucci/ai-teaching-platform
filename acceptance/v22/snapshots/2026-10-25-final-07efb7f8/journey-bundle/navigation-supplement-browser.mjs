/** Narrow S1/C2 supplement; the original full six-blocker run and failures remain untouched.
 * node navigation-supplement-browser.mjs <state> <fresh-out> <playwright> <safety.mjs>
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash,openRuntime,settle} from './read-only-runtime.mjs';
const [stateArg,outArg,playwrightArg,safetyArg]=process.argv.slice(2);
const rt=await openRuntime({stateArg,outArg,playwrightArg,safetyArg,helper:'S1-C2-visible-details-navigation-supplement'});
const {report,check,unrun,run,capture}=rt;
report.harnessSha256=hash(readFileSync(new URL(import.meta.url)));
report.originalHarnessSha256=hash(readFileSync(new URL('./six-blocker-browser.mjs',import.meta.url)));
report.verifierCorrection='At <=1240px, pane=details intentionally hides the main Class progress heading. Wait for the visible source-defined #cell-evidence in .ap-workbench[data-pane=details]. Selection, return URL, focus, and reload assertions are unchanged.';
report.priorRun='six-blockers-01; preserve its failing report and screenshots. This supplement never changes the application or rewrites earlier outcomes.';
const assignment='30000000-0000-4000-8000-000000000001',student='10000000-0000-4000-8000-000000000002';
const expected={assignment,student,concept:'transmission_delay',view:'progress',progressView:'grid',pane:'details'};
const progressURL=rt.manifest.origin+'/teacher/assignments?'+new URLSearchParams({...expected,origin:'all',status:'all'})+'#cell-evidence';
async function waitDetails(page){
 await page.locator('.ap-workbench[data-pane="details"] #cell-evidence').waitFor({state:'visible'});
 await page.locator('#cell-evidence').getByRole('heading',{name:'Details',exact:true}).waitFor();
 await settle(page);
}
async function cases(page,label){
 await run('S1',label+' course Assignments opens discovery from selected Details',page,async()=>{
  await page.goto(progressURL);await waitDetails(page);
  const width=await page.evaluate(()=>innerWidth);
  const link=width<=800?page.getByRole('link',{name:'Back to course assignments',exact:true}):page.getByRole('navigation',{name:'Course workspace',exact:true}).getByRole('link',{name:'Assignments',exact:true});
  const href=await link.getAttribute('href');await link.click();
  await page.waitForURL(url=>url.pathname==='/teacher/assignments'&&!url.searchParams.has('view'));
  await page.getByRole('heading',{name:'Assignments',exact:true}).waitFor();
  check('S1',label+' discovery clears selected assignment',!new URL(page.url()).searchParams.has('assignment'),{href,url:page.url(),source:progressURL});
  await capture(page,'S1-discovery-'+label);
 });
 await run('C2',label+' Class Progress Details Read in full displayed return',page,async()=>{
  await page.goto(progressURL);await waitDetails(page);
  const link=page.locator('#cell-evidence').getByRole('link',{name:'Read in full',exact:true}).first();await link.waitFor();
  const before=page.url(),entryHref=await link.getAttribute('href');await link.click();
  await page.waitForURL(url=>url.pathname.startsWith('/teacher/sessions/'));
  const back=page.locator('.lp-evidence-page').getByRole('link',{name:/^Back to /}).first();await back.waitFor();
  const sessionURL=page.url(),backHref=await back.getAttribute('href');
  await capture(page,'C2-full-session-'+label);await back.click();
  await page.waitForURL(new URL(backHref,rt.manifest.origin).href);await waitDetails(page);await page.waitForTimeout(550);
  const after=new URL(page.url());
  check('C2',label+' preserves assignment/student/concept/progress view/details pane',Object.entries(expected).every(([key,value])=>after.searchParams.get(key)===value),{before,entryHref,sessionURL,backHref,after:after.href,expected});
  const focus=await page.evaluate(()=>{const active=document.activeElement,rect=active?.getBoundingClientRect();return{id:active?.id,visible:!!rect&&rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight,scrollY};});
  check('C2',label+' displayed return restores visible Details focus',focus.id==='cell-evidence'&&focus.visible,{focus,hash:after.hash});
  await capture(page,'C2-returned-details-'+label);await page.reload();await waitDetails(page);
  check('C2',label+' reload retains exact contextual return URL',page.url()===after.href,{url:page.url()});
 });
}
try{
 const base=await rt.launch();
 for(const [width,height] of [[1440,1000],[1024,768],[390,844],[320,844]]){await base.page.setViewportSize({width,height});await cases(base.page,width+'x'+height);}
 const zoom=await rt.launch('teacher',2);
 const metric=await zoom.page.evaluate(()=>({innerWidth,innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio,rootZoom:getComputedStyle(document.documentElement).zoom,visualViewportScale:visualViewport?.scale}));
 const valid=metric.dpr>=1.95&&metric.dpr<=2.05&&metric.innerWidth<800&&['1','normal'].includes(metric.rootZoom)&&metric.visualViewportScale===1;
 check('ZOOM','Native 200% measured before S1/C2 supplement',valid,metric);
 if(valid)await cases(zoom.page,'native200');else unrun('ZOOM','Native 200% S1/C2','Actual native zoom was not established');
}catch(error){check('HARNESS','Navigation supplement setup',false,{error:String(error)});}
finally{await rt.finish();}
