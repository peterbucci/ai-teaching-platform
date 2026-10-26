/** Usage: node capture-application.mjs <runtime-final> <fresh-out> <safety.mjs> <scenario.json> */
import assert from "node:assert/strict";
import { join } from "node:path";
import { setup,loadJson,hashFile,VIEWPORTS,REQUIRED_STATES,browserExecutable,nativeContext,measureZoom,verifyZoom,capture } from "./capture-common.mjs";
const [stateArg,outArg,safetyArg,scenarioArg]=process.argv.slice(2);
assert.ok(scenarioArg,"Explicit fixture/state scenario required; missing authoring IDs must remain unrun.");
const scenario=loadJson(scenarioArg);
assert.equal(typeof scenario.fixtureLabel,"string"); assert.ok(Array.isArray(scenario.states));
const seen=new Set();
for(const item of scenario.states) {
  assert.ok(REQUIRED_STATES.includes(item.name)||item.name==="roster-student");assert.ok(!seen.has(item.name));seen.add(item.name);
  assert.ok(item.path===null||(/^\/teacher(?:\/|\?|$)/.test(item.path)&&!/[<>\s]|REQUIRED/.test(item.path)));
  assert.equal(typeof item.fixtureLabel,"string");
  for(const action of item.actions??[]) assert.ok(["button","tab","summary"].includes(action.role)&&typeof action.name==="string");
}
const h=await setup(stateArg,outArg,safetyArg,import.meta.url),{report}=h;
report.category="actual combined application; GET-only after authorized fictional teacher login";
report.fixtureLabel=scenario.fixtureLabel;report.scenarioSha256=hashFile(scenarioArg);
report.requiredStates=REQUIRED_STATES;
report.missingStates=REQUIRED_STATES.filter(name=>!seen.has(name));
const contexts=[];let browser;
async function login(context) {
  let allowed=true;
  await context.route("**/*",async route=>{
    const request=route.request(),u=new URL(request.url());
    if(["data:","blob:"].includes(u.protocol))return route.continue();
    if(u.origin===h.manifest.origin&&["GET","HEAD","OPTIONS"].includes(request.method()))return route.continue();
    if(allowed&&u.origin===h.manifest.origin&&u.pathname==="/api/auth/demo-sign-in"&&request.method()==="POST") {report.allowedLoginRequests.push({url:u.href,method:request.method()});return route.continue();}
    report.blockedRequests.push({url:u.href,method:request.method()});return route.abort("blockedbyclient");
  });
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(20000);
  await page.goto(h.manifest.origin+"/login");
  await page.getByRole("button",{name:"Demo teacher",exact:true}).click();
  await page.waitForURL("**/teacher");await page.locator(".tw-shell").waitFor();allowed=false;
  return page;
}
async function runStates(page,size,native200=false) {
  for(const item of scenario.states) {
    h.guard(size+":"+item.name);
    const result={name:item.name,path:item.path,fixtureLabel:item.fixtureLabel,viewportLabel:size,native200,status:"unrun",errors:[]};
    if(!item.path) {result.reason=item.unrunReason??"No exact authorized fixture URL supplied";report.states.push(result);await h.save();continue;}
    const errors=e=>result.errors.push(e.message);page.on("pageerror",errors);
    try {
      const response=await page.goto(h.manifest.origin+item.path,{waitUntil:"domcontentloaded"});
      result.httpStatus=response?.status();assert.ok(response?.ok());
      assert.equal(new URL(page.url()).pathname,new URL(h.manifest.origin+item.path).pathname,"Unexpected redirect");
      await page.locator(".tw-shell").waitFor(); await page.locator("main h1, main h2").filter({visible:true}).first().waitFor();
      if(item.expectedText)await page.getByText(item.expectedText,{exact:false}).filter({visible:true}).first().waitFor();
      for(const action of item.actions??[]) {
        const locator=action.role==="summary"?page.locator("summary").filter({hasText:action.name}):page.getByRole(action.role,{name:action.name,exact:true});
        await locator.filter({visible:true}).first().click();
      }
      await page.waitForTimeout(300);
      result.finalUrl=page.url();Object.assign(result,await capture(page,h.out,item.name+"-"+size,native200));result.status="captured";
    }catch(error){result.status="failed";result.error=error.message;await page.screenshot({path:join(h.out,item.name+"-"+size+"-failed.png")}).catch(()=>{});}
    finally{page.off("pageerror",errors);report.states.push(result);await h.save();console.log(size+" "+item.name+": "+result.status);}
  }
}
try {
  browser=await h.chromium.launch({headless:true,executablePath:browserExecutable()});
  const regular=await browser.newContext({viewport:VIEWPORTS[0],deviceScaleFactor:1});contexts.push(regular);
  const page=await login(regular);
  for(const viewport of VIEWPORTS){await page.setViewportSize(viewport);await runStates(page,viewport.width+"x"+viewport.height);}
  await regular.close();await browser.close();browser=null;
  const nonce=Date.now();h.guard("native100");
  const native100=await nativeContext(h.chromium,h.state,"app-"+nonce+"-100",1);contexts.push(native100);
  const base=await login(native100);report.native100=await measureZoom(base);await native100.close();
  h.guard("native200");const native200=await nativeContext(h.chromium,h.state,"app-"+nonce+"-200",2);contexts.push(native200);
  const zoom=await login(native200);report.native200=await measureZoom(zoom);report.native200Verified=verifyZoom(report.native100,report.native200);
  if(report.native200Verified)await runStates(zoom,"native200",true);else report.native200Failure="Browser zoom measurement did not establish 200%; no native200 state is accepted.";
}catch(error){report.fatal=error.message;process.exitCode=1;}
finally {for(const context of contexts)await context.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});report.finishedAt=new Date().toISOString();report.summary={captured:report.states.filter(s=>s.status==="captured").length,failed:report.states.filter(s=>s.status==="failed").length,unrun:report.states.filter(s=>s.status==="unrun").length,missingStates:report.missingStates};await h.save();h.release();}
