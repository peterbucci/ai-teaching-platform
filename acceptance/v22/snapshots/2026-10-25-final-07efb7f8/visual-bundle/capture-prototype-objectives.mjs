/** Usage: node capture-prototype-objectives.mjs <runtime-final> <fresh-out> <safety.mjs> <original-export-directory> */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname,join,resolve,relative,isAbsolute } from "node:path";
import { setup,hashFile,VIEWPORTS,browserExecutable,nativeContext,measureZoom,verifyZoom,capture } from "./capture-common.mjs";
const [stateArg,outArg,safetyArg,exportArg]=process.argv.slice(2);
assert.ok(exportArg);const exportDir=resolve(exportArg);
const htmlSha="c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54";
assert.equal(hashFile(join(exportDir,"Main.dc.html")),htmlSha,"Actual unchanged export required.");
const h=await setup(stateArg,outArg,safetyArg,import.meta.url),{report}=h;
report.category="actual approved HTML prototype; built-in fictional data; read-only navigation; not application acceptance";
report.htmlSha256=htmlSha;report.archiveSha256="74bc909dffba839d6850823b35b8c8fc3c67adf1a64b14d67f245560fb87768f";
report.supplement={originalRun:"prototype-captures-01",reason:"Original S1 word-boundary selector did not match adjacent DOM text. Exact observed span and editor controls used here; historical failed captures preserved.",scope:"Objectives only; no underlying prototype or application modification"};report.exportDirectory=exportDir;report.networkRequests=[];
const types={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".woff2":"font/woff2"};
const server=createServer(async(req,res)=>{
  if(!["GET","HEAD"].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
    const file=resolve(exportDir,"."+pathname), rel=relative(exportDir,file);
    if(rel.startsWith("..")||isAbsolute(rel)){res.writeHead(403);res.end();return;}
    const bytes=await readFile(file);res.writeHead(200,{"Content-Type":types[extname(file)]??"application/octet-stream","Cache-Control":"no-store"});res.end(req.method==="HEAD"?undefined:bytes);
  }catch{res.writeHead(404);res.end();}
});
await new Promise((done,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",done);});
const url=`http://127.0.0.1:${server.address().port}/Main.dc.html`;report.prototypeUrl=url;
const contexts=[];let browser;
const button=(p,name)=>p.getByRole("button",{name,exact:true}).filter({visible:true}).first();
async function course(p,name){await p.locator("nav.ctabs,nav.mbar").filter({visible:true}).getByRole("button",{name,exact:true}).click();}
async function assignment(p){await course(p,"Assignments");await button(p,"Open Section A · Bandwidth and Latency, version 3").click();}
async function assignmentTab(p,name){await p.locator("nav.atabs,nav.mbar").filter({visible:true}).getByRole("button",{name:new RegExp("^"+name+"(?:\\s*\\d+)?$")}).click();}
async function lesson(p,title){await course(p,"Lessons");await p.locator("button.lrow").filter({hasText:title}).click();}
async function outline(p){const b=button(p,"Outline");if(await b.isVisible())await b.click();}
async function concern(p){await p.getByRole("button",{name:"Look into it",exact:true}).nth(1).click();}
const states=[
  {name:"objectives",fixtureLabel:"Packet Switching Basics draft; objective S1 Store-and-forward; three suggested objectives/zero questions; different source/count/state from application journey",navigate:async p=>{
    await lesson(p,"Packet Switching Basics");await outline(p);
    const objective=p.locator("nav.ol button").filter({has:p.locator("span.small").filter({hasText:/^S1$/})});
    assert.equal(await objective.count(),1,"Exactly one S1 outline entry must be observed");
    await objective.click();
    await p.getByRole("heading",{name:"Store-and-forward",exact:true}).waitFor({state:"visible"});
    assert.equal(await p.locator("#o-name").inputValue(),"Store-and-forward");
    assert.equal(await p.locator("#o-emph").inputValue(),"Essential");
  }},
];
async function attach(context){
  await context.route("**/*",async route=>{const request=route.request();if(["GET","HEAD"].includes(request.method()))return route.continue();report.blockedRequests.push({url:request.url(),method:request.method()});return route.abort("blockedbyclient");});
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(15000);
  page.on("response",r=>{if(report.networkRequests.length<300&&!r.url().startsWith("data:"))report.networkRequests.push({url:r.url(),status:r.status()});});return page;
}
async function reset(page){await page.goto(url,{waitUntil:"load"});await page.locator(".lpc").waitFor();await page.locator(".pq-r").first().waitFor();await page.evaluate(()=>document.fonts.ready);}
async function runStates(page,label,native200=false){
  for(const state of states){
    h.guard(label+":"+state.name);const result={name:state.name,fixtureLabel:state.fixtureLabel,viewportLabel:label,native200,status:"unrun",errors:[]};
    const errors=e=>result.errors.push(e.message);page.on("pageerror",errors);
    try{await reset(page);await state.navigate(page);await page.waitForTimeout(150);Object.assign(result,await capture(page,h.out,state.name+"-"+label,native200));result.status="captured";}
    catch(error){result.status="failed";result.error=error.message;await page.screenshot({path:join(h.out,state.name+"-"+label+"-failed.png")}).catch(()=>{});}
    finally{page.off("pageerror",errors);report.states.push(result);await h.save();console.log(label+" "+state.name+": "+result.status);}
  }
}
try{
  browser=await h.chromium.launch({headless:true,executablePath:browserExecutable()});
  const regular=await browser.newContext({viewport:VIEWPORTS[0],deviceScaleFactor:1});contexts.push(regular);const p=await attach(regular);
  for(const v of VIEWPORTS){await p.setViewportSize(v);await runStates(p,v.width+"x"+v.height);}
  await regular.close();await browser.close();browser=null;
  const nonce=Date.now();h.guard("prototype-native100");const base=await nativeContext(h.chromium,h.state,"prototype-objectives-"+nonce+"-100",1);contexts.push(base);
  const bp=await attach(base);await reset(bp);report.native100=await measureZoom(bp);await base.close();
  h.guard("prototype-native200");const zoom=await nativeContext(h.chromium,h.state,"prototype-objectives-"+nonce+"-200",2);contexts.push(zoom);
  const zp=await attach(zoom);await reset(zp);report.native200=await measureZoom(zp);report.native200Verified=verifyZoom(report.native100,report.native200);
  if(report.native200Verified)await runStates(zp,"native200",true);else report.native200Failure="200% native zoom not established; no native200 captures accepted.";
}catch(error){report.fatal=error.message;process.exitCode=1;}
finally{for(const context of contexts)await context.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});await new Promise(done=>server.close(done));report.finishedAt=new Date().toISOString();report.summary={captured:report.states.filter(s=>s.status==="captured").length,failed:report.states.filter(s=>s.status==="failed").length};await h.save();h.release();}
