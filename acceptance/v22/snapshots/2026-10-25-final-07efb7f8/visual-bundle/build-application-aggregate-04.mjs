import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, relative } from "node:path";
const root=resolve(process.argv[2]), output=resolve(root,"application-aggregate-04.json");
assert.equal(existsSync(output),false,"Preserve existing aggregation");
const hash=file=>createHash("sha256").update(readFileSync(file)).digest("hex");
const load=file=>JSON.parse(readFileSync(file,"utf8").replace(/^\uFEFF/,""));
const rawPath=resolve(root,"application-captures-03/report.json"), raw=load(rawPath);
assert.ok(raw.finishedAt);assert.equal(raw.summary.captured,60);assert.equal(raw.summary.failed,0);assert.equal(raw.states.length,60);
assert.equal(raw.sourceSha,"07efb7f821339538800f150f57b298eb2e606be3");assert.equal(raw.native200Verified,true);
const textPath=resolve(root,"application-captures-03/roster-1440x1000.txt");
const rosterText=readFileSync(textPath,"utf8");assert.match(rosterText,/27 enrolled students/);
const rel=file=>relative(root,file).replaceAll("\\","/");
const history=[1,2,3].map(number=>{
 const path=resolve(root,"application-captures-"+String(number).padStart(2,"0")+"/report.json");
 const value=load(path);assert.ok(value.finishedAt);
 return {report:rel(path),sha256:hash(path),summary:value.summary,
 interpretation:number<3?"Preserved capture-harness failure; not an application defect or a pass.":"Selected final complete captures; page errors remain separate evidence."};
});
const states=raw.states.map(state=>{
 const result={...state,originalRecordedFixtureLabel:state.fixtureLabel,captureReport:rel(rawPath),captureReportSha256:hash(rawPath)};
 result.files=state.files.map(file=>{
  const target=resolve(dirname(rawPath),file.file);assert.equal(hash(target),file.sha256);
  const bytes=readFileSync(target);assert.equal(bytes.readUInt32BE(16),file.pixelWidth);assert.equal(bytes.readUInt32BE(20),file.pixelHeight);
  return {...file,file:rel(target)};
 });
 if(["overview","class-progress","roster","learning-insights"].includes(state.name)){
  const correction="Capture-time correction: this selected fictional class has 27 enrolled students (one has answered in this assignment), as visible in the original roster/metrics captures. The scenario's initial count of three is stale descriptive metadata; it is not the current captured count or a projection defect.";
  result.fixtureLabel=state.fixtureLabel.replace("3 fictional enrolled students","27 fictional enrolled students").replace("three fictional students","27 fictional students")+" "+correction;
  result.fixtureLabelCorrection={reason:correction,evidence:rel(textPath),evidenceSha256:hash(textPath),preservesOriginalLabel:"originalRecordedFixtureLabel"};
 }
 return result;
});
const result={...raw,fixtureLabel:raw.fixtureLabel+" Capture-time enrollment is 27; original scenario descriptions are retained per state.",states,
 aggregation:{kind:"Read-only report selection and explicit fixture-label correction; original reports and PNG bytes unchanged",sourceReport:rel(rawPath),sourceReportSha256:hash(rawPath),history,correctedEnrollment:27,correctionEvidence:rel(textPath),correctionEvidenceSha256:hash(textPath),imageCount:states.reduce((n,state)=>n+state.files.length,0),native200Primary:"Use complete original CDP PNGs; ordinary viewport captures remain linked, not edited.",allImagesHashVerified:true}};
writeFileSync(output,JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({output,sha256:hash(output),selectedStates:states.length,images:result.aggregation.imageCount,history,pageErrorStates:states.filter(state=>state.errors.length).map(state=>({name:state.name,viewport:state.viewportLabel,errors:state.errors})),overflowStates:states.filter(state=>state.metrics.overflow).length},null,2));

