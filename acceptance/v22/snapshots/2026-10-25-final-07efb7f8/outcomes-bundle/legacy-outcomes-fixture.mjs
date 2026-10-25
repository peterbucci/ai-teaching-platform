/** Verification-only adapter; unmodified assertions, explicit zero-provider scope. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {getPool} from '/app/lib/db.ts';
import {DEMO_IDS} from '/app/lib/evidence/demo.ts';
const [mode,inputPath,outputPath] = process.argv.slice(2);
assert.equal(mode,'legacy-outcomes');
assert.ok(inputPath && outputPath);
assert.equal(process.env.ACCEPTANCE_PROJECT,'lp-v22-final-01a173d6');
assert.equal(process.env.ACCEPTANCE_SOURCE_SHA,'07efb7f821339538800f150f57b298eb2e606be3');
assert.equal(process.env.ACCEPTANCE_SOURCE_TREE,'948b9a6005a056c97f10d181c589b5352d6221f3');
assert.equal(process.env.OPENAI_API_KEY?.trim() || '', '');
assert.equal(process.env.OPENAI_MODEL?.trim() || '', '');
assert.equal(process.env.AUTH_URL,'http://localhost:3396');
const hash = v => createHash('sha256').update(v).digest('hex');
const inputBytes=await readFile(inputPath);
assert.equal(hash(inputBytes),'126ae193248d76951a1cf55feed860ed104152325d4e40c850c1fdbbc54bcff8');
const input=JSON.parse(inputBytes);
assert.equal(input.status,'passed');
assert.equal(input.paid_calls,0);
const source=input.completed.find(row=>row.kind==='curated');
assert.equal(source.draft_id,'1e68ead8-23ae-442f-a200-91b41d266b37');
assert.equal(source.assignment_id,DEMO_IDS.assignmentId);
const originalPath='/app/scripts/check-intervention-outcomes.ts';
const originalBytes=await readFile(originalPath);
assert.equal(hash(originalBytes),'d30248acbe2d245cd0a43279b361fd77cc15284ca346e38e259674494c80c8cf');
const db=getPool();
// This is the sole domain operation before reconciliation is durably recorded.
// It is a SELECT; no approval, generation, quota, timestamp or auth mutation.
const result=await db.query('SELECT id,teacher_id,assignment_id,revision,snapshot FROM teacher_intervention_drafts WHERE id=$1',[source.draft_id]);
assert.equal(result.rowCount,1);
const row=result.rows[0], snapshot=row.snapshot;
assert.equal(row.teacher_id,DEMO_IDS.teacher);
assert.equal(row.assignment_id,DEMO_IDS.assignmentId);
assert.equal(snapshot.id,source.draft_id);
assert.equal(snapshot.assignment_id,DEMO_IDS.assignmentId);
assert.ok(snapshot.provenance.response_id,'Saved source response provenance is required; never fabricate it.');
assert.ok(snapshot.evidence.observations.length>0);
assert.ok(snapshot.evidence.observations.every(item=>item.data_origin==='synthetic_fixture'));
const reconciliation={status:'passed',source_sha:process.env.ACCEPTANCE_SOURCE_SHA,source_tree:process.env.ACCEPTANCE_SOURCE_TREE,origin:process.env.AUTH_URL,checked_at:new Date().toISOString(),method:'Read-only SELECT of exact curated approval-matrix draft before any domain mutation',source_draft_id:row.id,source_assignment_id:row.assignment_id,source_revision:row.revision,source_snapshot_sha256:hash(JSON.stringify(snapshot)),source_provenance:snapshot.provenance,source_observation_count:snapshot.evidence.observations.length,original_script_sha256:hash(originalBytes),approval_receipt_sha256:hash(inputBytes),new_model_calls:0};
await writeFile(outputPath+'.reconciliation.json',JSON.stringify(reconciliation,null,2)+'\n',{flag:'wx'});
const requestPath=outputPath+'.source.json';
await writeFile(requestPath,JSON.stringify({request:{draft_id:source.draft_id,selection:{assignment_id:source.assignment_id}}})+'\n',{flag:'wx'});
process.env.CHECK_INTERVENTION_REPORT=requestPath;
// Preserve all legacy assertions. Only its three output filenames are relocated.
const outputPairs=[
 ['"evals/results/intervention-outcomes-http.json"',JSON.stringify(outputPath+'.outcomes.json')],
 ['"evals/results/intervention-outcomes-persistence.json"',JSON.stringify(outputPath+'.persistence.json')],
 ['"evals/results/intervention-outcomes-integrity.json"',JSON.stringify(outputPath+'.integrity.json')],
];
let adapted=originalBytes.toString('utf8');
const replacements=[];
for(const [from,to] of outputPairs){
 const count=adapted.split(from).length-1;
 assert.ok(count<=1,'Unexpected duplicate output literal');
 if(count===1){adapted=adapted.replace(from,to);replacements.push({from,to,count});}
}
assert.ok(replacements.some(item=>item.from.includes('-http.json')));
const suffix=outputPath.split('/').at(-1).replace(/[^a-z0-9-]/gi,'-');
const scriptPath='/app/scripts/acceptance-'+suffix+'.ts';
await writeFile(scriptPath,adapted,{flag:'wx'});
await import(pathToFileURL(scriptPath).href);
const legacyBytes=await readFile(outputPath+'.outcomes.json');
const legacy=JSON.parse(legacyBytes);
assert.equal(legacy.status,'passed');
assert.equal(legacy.new_model_calls,0);
assert.equal(legacy.source_draft_id,source.draft_id);
await writeFile(outputPath,JSON.stringify({status:'completed',source_sha:process.env.ACCEPTANCE_SOURCE_SHA,source_tree:process.env.ACCEPTANCE_SOURCE_TREE,project:process.env.ACCEPTANCE_PROJECT,origin:process.env.AUTH_URL,new_model_calls:0,verification:'Legacy real PostgreSQL/authenticated HTTP outcomes suite with injected providers; no browser or actual-model claim',reconciliation,adapted_script_path:scriptPath,adapted_script_sha256:hash(adapted),output_relocations:replacements,legacy_report_sha256:hash(legacyBytes),legacy_report:legacy,limitations:['No separate database-restart persistence mode in this execution','No actual-model call','Rejected timestamp UPDATE assertions remain as integrity tests; no saved timestamp is changed to pass']},null,2)+'\n',{flag:'wx'});
