/** Builds a comparison page from actual capture receipts. Does not change images or infer acceptance. */
import assert from "node:assert/strict";
import { existsSync,readFileSync,writeFileSync } from "node:fs";
import { dirname,relative,resolve,join } from "node:path";
import { inflateSync } from "node:zlib";
import { loadJson,hashFile,REQUIRED_STATES,SOURCE_SHA,SOURCE_TREE } from "./capture-common.mjs";
const [appArg,prototypeArg,outArg,reviewArg]=process.argv.slice(2);
assert.ok(appArg&&prototypeArg&&outArg);
const app=loadJson(appArg),prototype=loadJson(prototypeArg),out=resolve(outArg),review=reviewArg?loadJson(reviewArg):{};
assert.equal(app.sourceSha,SOURCE_SHA);assert.equal(app.sourceTree,SOURCE_TREE);
assert.equal(prototype.htmlSha256,"c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54");
assert.equal(existsSync(out),false,"Use a new gallery output to preserve earlier evidence.");
const allowed=new Set(["Accepted","Accepted with documented deviations","Changes required","Not verified"]);
for(const value of Object.values(review)){assert.ok(allowed.has(value.classification));assert.equal(typeof value.reason,"string");}
const escape=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const link=file=>relative(dirname(out),file).replaceAll("\\","/").split("/").map(encodeURIComponent).join("/");
// Read original PNG pixels only; no image or screenshot is rewritten. This
// detects a blank capture, not visual fidelity or successful interaction.
function nonblankPNG(file){
  const bytes=readFileSync(file);assert.equal(bytes.toString("hex",0,8),"89504e470d0a1a0a");
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),depth=bytes[24],type=bytes[25],interlace=bytes[28];
  if(depth!==8||![2,6].includes(type)||interlace!==0)return null;
  const data=[];for(let i=8;i<bytes.length;){const n=bytes.readUInt32BE(i),kind=bytes.toString("ascii",i+4,i+8);if(kind==="IDAT")data.push(bytes.subarray(i+8,i+8+n));i+=n+12;}
  const raw=inflateSync(Buffer.concat(data)),bpp=type===6?4:3,stride=width*bpp;
  assert.equal(raw.length,(stride+1)*height);
  let previous=Buffer.alloc(stride),offset=0;const colors=new Set();
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[offset++],row=Buffer.alloc(stride);assert.ok(filter<=4);
    for(let x=0;x<stride;x++){
      const left=x>=bpp?row[x-bpp]:0,up=previous[x],corner=x>=bpp?previous[x-bpp]:0;
      row[x]=(raw[offset++]+(filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,corner)))&255;
    }
    for(let x=0;x<stride;x+=bpp){colors.add(row.readUIntBE(x,3));if(colors.size>16)return true;}
    previous=row;
  }
  return false;
}
function panel(reportPath,result,label){
  if(!result)return `<article><h3>${escape(label)}</h3><p class="status">Not captured / unrun</p></article>`;
  const files=result.files??(result.screenshot?[{file:result.screenshot,method:"Historical capture format"}]:[]);
  const verified=files.map(file=>{const target=resolve(dirname(reportPath),file.file);assert.ok(existsSync(target));if(file.sha256)assert.equal(hashFile(target),file.sha256);return {file,target};});
  const native=result.native200||result.viewportLabel==="native200",m=result.metrics;
  const full=native&&verified.find(({file,target})=>/CDP visible surface/.test(file.method??"")&&m&&
    file.pixelWidth===Math.round(m.innerWidth*m.devicePixelRatio)&&file.pixelHeight===Math.round(m.innerHeight*m.devicePixelRatio)&&nonblankPNG(target)===true);
  const shown=full?[full]:verified;
  const retained=full?verified.filter(item=>item!==full):[];
  const note=native?full?'<p class="notice">Primary image: original CDP visible surface. Pixel dimensions match the measured native-zoom surface and pixels are nonblank. Layout/fidelity still requires visual review. The ordinary viewport PNG is retained below.</p>':'<p class="error">Complete nonblank native200 CDP surface was not established. This image must not be accepted as a complete zoom comparison.</p>':"";
  const originals=retained.length?`<details><summary>Retained ordinary native200 viewport PNG — not the primary comparison</summary>${retained.map(({file,target})=>`<p><strong>${file.pixelWidth<full.file.pixelWidth||file.pixelHeight<full.file.pixelHeight?"Cropped ordinary capture":"Additional original capture"}</strong>: <a href="${escape(link(target))}">${escape(file.file)}</a> · original ${escape(file.pixelWidth)}×${escape(file.pixelHeight)} pixels · ${escape(file.method)}</p>`).join("")}</details>`:"";
  return `<article><h3>${escape(label)}</h3><p class="status">${escape(result.status)}</p><p>${escape(result.fixtureLabel)}</p>${result.error?`<p class="error">${escape(result.error)}</p>`:""}${result.reason?`<p>${escape(result.reason)}</p>`:""}${note}${shown.map(({file,target})=>`<figure><a href="${escape(link(target))}"><img loading="lazy" src="${escape(link(target))}" alt="${escape(label+" "+result.name+" "+result.viewportLabel)}"></a><figcaption>${escape(file.method)} · original ${escape(file.pixelWidth??"?")}×${escape(file.pixelHeight??"?")} pixels</figcaption></figure>`).join("")}${originals}<details><summary>Measured geometry and capture provenance</summary><pre>${escape(JSON.stringify({metrics:result.metrics,path:result.path,finalUrl:result.finalUrl,files,primaryNative200:full?.file.file??null},null,2))}</pre></details></article>`;
}
const sizes=["1440x1000","1024x768","390x844","320x844","native200"];
const names=[...REQUIRED_STATES,...(prototype.states.some(x=>x.name==="roster-student")?["roster-student"]:[])];
const summary=names.map(name=>`<tr><th><a href="#${name}">${escape(name)}</a></th><td>${escape(review[name]?.classification??"Not verified")}</td><td>${escape(review[name]?.reason??"Human visual inspection / acceptance disposition not recorded by this generator.")}</td></tr>`).join("");
const sections=names.map(name=>`<section id="${name}"><h2>${escape(name)}</h2><p><strong>${escape(review[name]?.classification??"Not verified")}</strong> — ${escape(review[name]?.reason??"Capture presence is not acceptance.")}</p>${sizes.map(size=>`<h3 class="viewport">${escape(size)}</h3><div class="pair">${panel(prototypeArg,prototype.states.find(x=>x.name===name&&x.viewportLabel===size),"Approved prototype")}${panel(appArg,app.states.find(x=>x.name===name&&x.viewportLabel===size),"Integrated application")}</div>`).join("")}</section>`).join("");
writeFileSync(out,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workbench v2.2 final integration visual comparison</title><style>body{margin:0;color:#182c29;background:#f7f8f5;font:16px/1.55 system-ui}main{max-width:1700px;margin:auto;padding:28px}h1,h2,h3{line-height:1.2}h2{border-top:3px solid #234c40;padding-top:24px;margin-top:54px}.pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}article{background:white;padding:18px;border:1px solid #bccbc2;min-width:0}figure{margin:14px 0}img{display:block;width:100%;height:auto;border:1px solid #b6c8be}figcaption,.status{font-size:13px;color:#456254}pre{overflow:auto;font-size:11px;max-height:30em}.viewport{background:#e2e9e2;padding:12px}.error{color:#9b2424}table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #cbd7d0}a{color:#175d46}.notice{padding:18px;border-left:5px solid #9b7b29;background:#fff8df}@media(max-width:850px){.pair{grid-template-columns:1fr}main{padding:12px}}</style><main><h1>Teaching Workbench v2.2 — independent combined comparison</h1><p>Application commit <code>${SOURCE_SHA}</code><br>Tree <code>${SOURCE_TREE}</code></p><p class="notice">Screenshots are actual, unmodified captures. Prototype and application have different fictional records, counts, lesson versions and lifecycle states; each panel labels its state. No pixel equivalence is claimed. “Learning insights” compares the legacy application page with the prototype's corresponding concern workspace because the prototype has no exact route of that name. Native 200% geometry must pass and PNG completeness must be inspected separately.</p><p>Application native200 verified: <strong>${escape(app.native200Verified)}</strong>; prototype native200 verified: <strong>${escape(prototype.native200Verified)}</strong>. <a href="${escape(link(resolve(appArg)))}">Application receipt</a> · <a href="${escape(link(resolve(prototypeArg)))}">Prototype receipt</a></p><table><thead><tr><th>Surface</th><th>Visual classification</th><th>Disposition</th></tr></thead><tbody>${summary}</tbody></table>${sections}</main></html>`);
console.log(JSON.stringify({gallery:out,applicationReportSha256:hashFile(appArg),prototypeReportSha256:hashFile(prototypeArg),reviewProvided:Boolean(reviewArg)}));
