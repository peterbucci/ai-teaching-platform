/** Verification-only capture utilities derived from PR122 capture-shell and native zoom checks. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

export const SOURCE_SHA = "07efb7f821339538800f150f57b298eb2e606be3";
export const SOURCE_TREE = "948b9a6005a056c97f10d181c589b5352d6221f3";
export const SAFETY_SHA = "af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485";
export const VIEWPORTS = [{width:1440,height:1000},{width:1024,height:768},{width:390,height:844},{width:320,height:844}];
export const REQUIRED_STATES = ["overview","assignments","class-progress","lessons","objectives","questions","published-lesson","evidence","original-response","interventions","roster","learning-insights"];
export const hashFile = file => createHash("sha256").update(readFileSync(file)).digest("hex");
export function loadJson(file) { return JSON.parse(readFileSync(file,"utf8").replace(/^\uFEFF/,"")); }
export async function setup(stateArg, outputArg, safetyArg, scriptUrl) {
  const state=resolve(stateArg), out=resolve(outputArg), safety=resolve(safetyArg);
  assert.equal(existsSync(out),false,"Use a fresh output directory, preserving earlier results.");
  const manifest=loadJson(join(state,"manifest.json"));
  for(const path of [state,out]) {const rel=relative(resolve(manifest.source),path);assert.ok(rel&&((rel==="..")||rel.startsWith("..\\")||rel.startsWith("../")||isAbsolute(rel)),"State and captures must stay outside the application source.");}
  assert.equal(manifest.sourceSha,SOURCE_SHA); assert.equal(manifest.sourceTree,SOURCE_TREE);
  assert.equal(manifest.project,"lp-v22-final-01a173d6"); assert.equal(manifest.origin,"http://localhost:3396");
  assert.equal(manifest.paidModelCallsAuthorized,false); assert.match(manifest.configurationCategory,/provider-disabled/);
  const env=readFileSync(join(state,".env.acceptance"),"utf8");
  for(const key of ["OPENAI_API_KEY","OPENAI_MODEL"]) assert.ok(env.split(/\r?\n/).includes(key+"="));
  for(const [ref,expected] of [["HEAD",SOURCE_SHA],["HEAD^{tree}",SOURCE_TREE]]) {
    const result=spawnSync("git",["-C",manifest.source,"rev-parse",ref],{encoding:"utf8",windowsHide:true});
    assert.equal(result.status,0); assert.equal(result.stdout.trim(),expected);
  }
  const changes=spawnSync("git",["-C",manifest.source,"status","--porcelain=v1","--untracked-files=all"],{encoding:"utf8",windowsHide:true});
  assert.equal(changes.status,0); assert.equal(changes.stdout.trim(),"","Pinned candidate must remain clean.");
  assert.equal(hashFile(safety),SAFETY_SHA);
  const {acquireLock,preflight,MIN_RUNTIME_GIB}=await import(pathToFileURL(safety).href);
  const report={sourceSha:SOURCE_SHA,sourceTree:SOURCE_TREE,origin:manifest.origin,project:manifest.project,startedAt:new Date().toISOString(),harnessSha256:hashFile(new URL(scriptUrl)),sharedUtilitySha256:hashFile(new URL(import.meta.url)),states:[],safety:[],blockedRequests:[],allowedLoginRequests:[],native200Verified:false,limitations:["Screen-reader unrun","Desktop browser at phone-sized CSS viewport is not a physical mobile device","Synthetic data and disabled providers; zero paid model calls","Original screenshots are unmodified; counts/lifecycle differences must be labeled"]};
  await mkdir(out,{recursive:false});
  const release=acquireLock({command:"final-visual-capture",source:manifest.source,state,output:out,sha:SOURCE_SHA});
  const save=()=>writeFile(join(out,"report.json"),JSON.stringify(report,null,2)+"\n");
  function guard(before) {
    const observation=preflight({source:manifest.source,state,minimumGiB:MIN_RUNTIME_GIB,explicitPath:manifest.dockerDataPath,probeContainer:manifest.storageProbeContainer});
    report.safety.push({before,...observation});
    if(!observation.pass) throw new Error("Shared runtime preflight failed; no further capture is authorized.");
  }
  try {guard("initial");} catch(error) {report.fatal=error.message;await save();release();throw error;}
  let chromium;
  try {({chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??"C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));}
  catch(error) {report.fatal=error.message;await save();release();throw error;}
  return {state,out,manifest,report,release,guard,save,chromium};
}
export const browserExecutable=()=>process.env.BROWSER_EXECUTABLE??"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
export async function nativeContext(chromium,state,name,zoom) {
  const profile=join(state,"private-visual-profiles",name);
  assert.equal(existsSync(profile),false,"Native profile must be fresh; never overwrite authenticated profiles.");
  await mkdir(join(profile,"Default"),{recursive:true});
  await writeFile(join(profile,"Default","Preferences"),JSON.stringify({partition:{default_zoom_level:{x:Math.log(zoom)/Math.log(1.2),0:Math.log(zoom)/Math.log(1.2)}}}));
  return chromium.launchPersistentContext(profile,{executablePath:browserExecutable(),headless:true,viewport:null,args:["--window-size=1440,1000"]});
}
export const measureZoom=page=>page.evaluate(()=>({dpr:devicePixelRatio,innerWidth,innerHeight,outerWidth,outerHeight,visualViewportScale:visualViewport?.scale,rootZoom:getComputedStyle(document.documentElement).zoom,scrollWidth:document.documentElement.scrollWidth}));
export function verifyZoom(a,b) { return Math.abs(b.dpr/a.dpr-2)<.02&&Math.abs(b.innerWidth/a.innerWidth-.5)<.02&&b.visualViewportScale===1&&b.rootZoom==="1"&&b.outerWidth===a.outerWidth; }
export async function geometry(page) {
  return page.evaluate(()=>{
    const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none";};
    const geom=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,class:e.className,id:e.id,label:e.getAttribute("aria-label"),x:r.x,y:r.y,width:r.width,height:r.height,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,padding:s.padding,gap:s.gap,columns:s.gridTemplateColumns,overflowX:s.overflowX,overflowY:s.overflowY};};
    return {innerWidth,innerHeight,outerWidth,outerHeight,devicePixelRatio,visualViewportScale:visualViewport?.scale,rootZoom:getComputedStyle(document.documentElement).zoom,documentWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,geometry:[...document.querySelectorAll("body,header,nav,main,aside,section,dialog,[class*=pane],[class*=rail],[class*=workspace],[class*=context],[class*=heading]")].filter(visible).map(geom),headings:[...document.querySelectorAll("h1,h2,h3")].filter(visible).map(e=>({text:e.innerText,...geom(e)})),navigation:[...document.querySelectorAll("nav")].filter(visible).map(e=>({text:e.innerText,...geom(e)})),paneTabs:[...document.querySelectorAll("[role=tab],.aw-pane-switch button,.msw button")].filter(visible).map(e=>({text:e.textContent?.trim(),selected:e.getAttribute("aria-selected")??e.getAttribute("aria-pressed"),...geom(e)})),fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),active:{tag:document.activeElement?.tagName,id:document.activeElement?.id,text:document.activeElement?.textContent?.trim().slice(0,140)}};
  });
}
export async function capture(page,out,base,native200=false) {
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const metrics=await geometry(page);
  const files=[];
  async function record(name,bytes,method) {
    await writeFile(join(out,name),bytes);
    files.push({file:name,method,sha256:createHash("sha256").update(bytes).digest("hex"),pixelWidth:bytes.readUInt32BE(16),pixelHeight:bytes.readUInt32BE(20)});
  }
  await record(base+".png",await page.screenshot(),"Playwright viewport PNG; unmodified");
  if(native200) {
    const cdp=await page.context().newCDPSession(page);
    try {
      const raw=await cdp.send("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false});
      await record(base+"-cdp.png",Buffer.from(raw.data,"base64"),"CDP visible surface PNG; unmodified; inspect for crop/blank before accepting visual fidelity");
    }finally{await cdp.detach();}
  }
  await writeFile(join(out,base+".txt"),await page.locator("body").innerText());
  return {metrics,files};
}
