import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {getPool} from '/app/lib/db.ts';
const input='/tmp/acceptance-output-de1d36f1-16a0-44e0-8778-ecbe17456998.json.reconciliation.json';
const before=JSON.parse(await readFile(input,'utf8'));
assert.equal(before.source_draft_id,'1e68ead8-23ae-442f-a200-91b41d266b37');
const db=getPool();
try {
 const client=await db.connect();
 try {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const result=await client.query('SELECT id,revision,snapshot FROM teacher_intervention_drafts WHERE id=$1',[before.source_draft_id]);
  assert.equal(result.rowCount,1);
  const after=createHash('sha256').update(JSON.stringify(result.rows[0].snapshot)).digest('hex');
  assert.equal(after,before.source_snapshot_sha256);
  assert.equal(result.rows[0].revision,before.source_revision);
  const newDrafts=await client.query('SELECT id FROM teacher_intervention_drafts WHERE created_at >= $1::timestamptz',['2026-10-25T17:39:49.629Z']);
  assert.equal(newDrafts.rowCount,0,'No learning draft clones were created by the stopped suite');
  await client.query('ROLLBACK');
  console.log(JSON.stringify({status:'reconciled-before-domain-fixtures',at:new Date().toISOString(),sourceDraftId:before.source_draft_id,beforeHash:before.source_snapshot_sha256,afterHash:after,revision:result.rows[0].revision,newDraftCount:newDrafts.rowCount,reason:'Missing DEMO_STUDENT_THREE credential assertion at fourth login, before learning fixture cloning. Three normal authentication logins may have created auth sessions. No learning action replayed.'},null,2));
 } finally {client.release();}
} finally {await db.end();}
