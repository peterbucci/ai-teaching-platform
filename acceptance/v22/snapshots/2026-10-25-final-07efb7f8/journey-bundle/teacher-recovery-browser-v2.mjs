/** Verification only. Do not run concurrently with another guarded browser/database task.
 * node teacher-recovery-browser-v2.mjs <state> <fresh-out> <playwright> <safety.mjs> <passed-authoring-report.json>
 * Uses ordinary browser controls for local edits, never Save/Approve/Publish/Generate.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hash, openRuntime, SHA, TREE, settle } from './read-only-runtime.mjs';

const [stateArg, outArg, playwrightArg, safetyArg, inputArg] = process.argv.slice(2);
assert.ok(inputArg, 'A passed current-candidate authoring report is required');
const input = JSON.parse(readFileSync(inputArg, 'utf8').replace(/^\uFEFF/, ''));
const a = input.authoring ?? input;
assert.equal(a.status, 'passed');
assert.equal(a.sourceSha, SHA); assert.equal(a.sourceTree, TREE);
assert.equal(a.functional_completed_through, 'teacher-original-evidence');
assert.equal(a.paid_calls, 0);
for (const name of ['lesson_id', 'source_id', 'assignment_id', 'student_session_id', 'presented_attempt_id'])
  assert.match(a[name], /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, name);
assert.ok(Number.isInteger(a.source_version) && a.source_version > 0);
assert.equal(a.content_ref.source_id, a.source_id);
assert.equal(a.content_ref.package_id, a.lesson_id);
const rt = await openRuntime({ stateArg, outArg, playwrightArg, safetyArg, inputArg,
  helper: 'teacher-authoring-recovery-and-unavailable-source-supplement-v2' });
const { report, check, unrun, capture, get } = rt;
report.harnessSha256 = hash(readFileSync(new URL(import.meta.url)));
report.supplement = { priorRun: 'teacher-recovery-01', reason: 'Wait for streamed authoring controls before counting; preserve application result status separately from HTTP status. No Roster/Insights return rerun.', historicalResultPreserved: true };
report.scope = 'Local question/objective form state; actual native navigation; exact-source missing GET states. No saved timestamps, quotas, authorization or server data changed.';
report.limitations.push('Native select popup visual expansion requires inspection of the original screenshot; keyboard value changes alone do not prove menu visibility.');
const receipts = {}, dialogs = [];
const absolute = path => new URL(path, rt.manifest.origin).href;

// Locator/fixture failure is a verification gap, not an application defect.
async function scenario(id, label, page, callback) {
  await rt.run(id, label, page, async () => {
    try { await callback(); }
    catch (error) {
      unrun(id, label, 'Browser scenario could not reach its observed control/state; inspect evidence before classifying: ' + String(error));
      report.observations.push({ id, url: page.url(), text: (await page.locator('body').innerText().catch(() => '')).slice(0, 16000) });
      await capture(page, id.toLowerCase() + '-scenario-unrun').catch(() => {});
    }
  });
}
async function requireControl(locator, name) {
  await locator.first().waitFor({ state: 'visible', timeout: 20000 });
  if (await locator.count() !== 1) throw new Error(name + ': expected one source-identified control; found ' + await locator.count());
  await locator.waitFor({ state: 'visible' });
  if (!await locator.isEnabled()) throw new Error(name + ': control disabled in current fixture');
  return locator;
}
async function withDialogs(page, choice, action) {
  const observed = [], pending = [];
  const listener = dialog => {
    observed.push({ type: dialog.type(), message: dialog.message(), action: choice });
    pending.push(choice === 'accept' ? dialog.accept() : dialog.dismiss());
  };
  page.on('dialog', listener);
  try { await action(); await settle(page); await Promise.all(pending); }
  finally { page.off('dialog', listener); dialogs.push(...observed); }
  return observed;
}
try {
  const { context, page } = await rt.launch('teacher');
  const bankPath = '/api/teacher/lessons/' + a.lesson_id + '/question-bank';
  const objectivePath = '/api/teacher/objectives/' + a.lesson_id;
  const questionBase = '/teacher/lessons/' + a.lesson_id + '/questions';
  let bankBefore, question, questionURL, original, edited, baselineReady = false;
  const wording = () => page.getByRole('textbox', { name: /^Question wording · student visible/ });

  await scenario('L-READ', 'Read exact current question bank before local recovery checks', page, async () => {
    bankBefore = await get(context, bankPath); receipts.bankBefore = bankBefore;
    assert.equal(bankBefore.lesson_id, a.lesson_id);
    question = bankBefore.draft.questions?.[0]; assert.ok(question);
    assert.equal(typeof question.prompt_text, 'string'); original = question.prompt_text;
    assert.ok(bankBefore.draft.question_bank?.items.some(x => x.question_id === question.question_id));
    questionURL = absolute(questionBase + '?question=' + encodeURIComponent(question.question_id));
    await page.goto(questionURL);
    const field = await requireControl(wording(), 'Question wording');
    baselineReady = await field.inputValue() === original;
    check('L-READ', 'Current saved question is displayed without mutation', baselineReady,
      { lessonId: a.lesson_id, questionId: question.question_id, revision: bankBefore.revision });
    await capture(page, 'question-before-local-edit');
  });

  await scenario('L-NAV', 'Cancel navigation preserves unsaved question text', page, async () => {
    if (!questionURL || !baselineReady) throw new Error('Baseline question text not verified; local editing is not permitted');
    edited = original + '\nLOCAL ACCEPTANCE RECOVERY CHECK — never saved.';
    await (await requireControl(wording(), 'Question wording')).fill(edited);
    await page.waitForFunction(({ key, text }) => sessionStorage.getItem(key)?.includes(text),
      { key: 'question-bank-local-edits:' + a.lesson_id, text: 'LOCAL ACCEPTANCE RECOVERY CHECK' });
    const link = page.locator('.aw-outline a[href="/teacher/lessons"]');
    const observedLink = await link.count() === 1 ? link : page.locator('a[href="/teacher/lessons"]:visible').first();
    await observedLink.waitFor({ state: 'visible' });
    const seen = await withDialogs(page, 'dismiss', () => observedLink.click());
    const retained = page.url() === questionURL && await wording().count() === 1 && await wording().inputValue() === edited;
    check('L-NAV', 'Cancel displayed unsaved-question warning retains URL and exact local text',
      seen.some(d => d.type === 'confirm' && /unsaved question-bank changes/.test(d.message)) && retained,
      { dialogs: seen, retained, url: page.url() });
    await capture(page, 'question-navigation-cancel');
  });

  await scenario('L-RELOAD', 'Native reload offers and restores question-bank local edits', page, async () => {
    if (!questionURL || !edited) throw new Error('Local question edit unavailable');
    if (page.url() !== questionURL) throw new Error('Navigation cancellation failed; do not invent continuation');
    const seen = await withDialogs(page, 'accept', () => page.reload());
    const restore = page.getByRole('button', { name: 'Restore local edits', exact: true });
    await page.getByRole('heading', { name: 'Unsaved edits from this browser tab', exact: true }).waitFor();
    await capture(page, 'question-reload-recovery-offer');
    await (await requireControl(restore, 'Restore local edits')).click();
    await requireControl(wording(), 'Restored question wording');
    check('L-RELOAD', 'Reload retains exact unsaved question through explicit Restore local edits',
      await wording().inputValue() === edited, { dialogs: seen, nativeReload: true, questionId: question.question_id });
    await capture(page, 'question-reload-restored');
  });

  await scenario('L-RESTORE', 'Restore original form text and verify unchanged saved bank', page, async () => {
    if (!bankBefore || original === undefined) throw new Error('Baseline unavailable');
    if (await wording().count() === 1 && await wording().isEnabled()) {
      await wording().fill(original); await settle(page);
      // Editing can also clear local review metadata. Reload and explicitly
      // discard this harness's recovery copy instead of pretending text alone
      // restores the entire client-side bank.
      const hasRecovery = await page.evaluate(key => sessionStorage.getItem(key) !== null, 'question-bank-local-edits:' + a.lesson_id);
      await withDialogs(page, 'accept', () => page.reload());
      const discard = page.getByRole('button', { name: 'Discard recovery copy', exact: true });
      await page.locator('.qb-editor').waitFor({ state: 'visible' });
      if (hasRecovery) await (await requireControl(discard, 'Discard harness recovery copy')).click();
    } else {
      // Browser-only recovery cleanup. Never resubmit the bank.
      await withDialogs(page, 'accept', () => page.goto(questionURL));
      const discard = page.getByRole('button', { name: 'Discard recovery copy', exact: true });
      await page.locator('.qb-editor').waitFor({ state: 'visible' });
      if (await discard.count() === 1) await (await requireControl(discard, 'Discard harness recovery copy')).click();
    }
    await requireControl(wording(), 'Restored original wording');
    check('L-RESTORE', 'Local question wording restored to initial text', await wording().inputValue() === original);
    await capture(page, 'question-original-restored');
  });

  await scenario('L-EMPHASIS', 'Native objective Emphasis keyboard selection and local restoration', page, async () => {
    const before = await get(context, objectivePath); receipts.objectivesBefore = before;
    const objectiveId = before.lesson?.draft?.objective_workflow?.items?.[0]?.concept_id;
    if (!objectiveId) throw new Error('No saved objective in the passed journey lesson');
    await withDialogs(page, 'accept', () => page.goto(absolute('/teacher/objectives/' + a.lesson_id + '?objective=' + encodeURIComponent(objectiveId))));
    const select = await requireControl(page.getByRole('combobox', { name: /^Emphasis/ }), 'Emphasis');
    const initial = await select.inputValue();
    assert.ok(['', 'essential', 'supporting', 'optional'].includes(initial));
    await select.focus(); await select.press('Alt+ArrowDown');
    await capture(page, 'emphasis-native-popup-requested');
    report.observations.push({ id: 'L-EMPHASIS', visualReviewRequired: true,
      note: 'Alt+ArrowDown sent to native select; inspect original image. Do not infer menu visibility from focus or selected value.' });
    const target = initial === 'optional' ? '' : 'optional';
    const movement = initial === 'optional' ? 'Home' : 'End';
    await select.press(movement); await select.press('Enter');
    await settle(page);
    check('L-EMPHASIS', 'Native keyboard changes Emphasis to another option',
      await select.inputValue() === target && target !== initial,
      { original: initial, expected: target, actual: await select.inputValue(), method: 'Alt+ArrowDown, ' + movement + ', Enter' });
    await capture(page, 'emphasis-after-native-keyboard-change');
    await select.selectOption(initial); await settle(page);
    check('L-EMPHASIS', 'Local Emphasis restored without Save', await select.inputValue() === initial);
    const after = await get(context, objectivePath); receipts.objectivesAfter = after;
    check('L-EMPHASIS', 'Saved objectives unchanged after native select check', JSON.stringify(before) === JSON.stringify(after));
    unrun('L-EMPHASIS-POPUP', 'Native Emphasis expanded-menu visual acceptance', 'Original popup-request screenshot requires independent visual inspection; keyboard operation does not establish popup visibility.');
  });

  // Reconcile saved records even if a preceding UI locator/cleanup was unrun.
  // This is an independent read; it never retries a mutation.
  await scenario('L-PERSISTENCE', 'Independently reconcile saved bank and objectives after local browser checks', page, async () => {
    if (!bankBefore) throw new Error('Initial bank receipt unavailable');
    const after = await get(context, bankPath); receipts.bankAfter = after;
    check('L-PERSISTENCE', 'Saved bank, review metadata and revision are unchanged',
      JSON.stringify(after) === JSON.stringify(bankBefore),
      { beforeRevision: bankBefore.revision, afterRevision: after.revision, beforeSha256: hash(JSON.stringify(bankBefore)), afterSha256: hash(JSON.stringify(after)) });
    if (receipts.objectivesBefore) {
      const objectivesAfter = await get(context, objectivePath); receipts.objectivesAfter = objectivesAfter;
      check('L-PERSISTENCE', 'Saved objectives and approval state are unchanged',
        JSON.stringify(receipts.objectivesBefore) === JSON.stringify(objectivesAfter),
        { beforeSha256: hash(JSON.stringify(receipts.objectivesBefore)), afterSha256: hash(JSON.stringify(objectivesAfter)) });
    } else unrun('L-PERSISTENCE', 'Saved objective reconciliation', 'Initial objective receipt unavailable');
  });

  await scenario('SRC-VALID', 'Actual journey source version opens before unavailable-source probes', page, async () => {
    const response = await page.goto(absolute('/teacher/materials/' + a.source_id + '?version=' + a.source_version));
    await page.locator('.lm-saved-source h1').waitFor({ state: 'visible' });
    const text = await page.locator('body').innerText();
    check('SRC-VALID', 'Exact saved source route is available', response?.status() === 200 && !/This page could not be found|This evidence isn[’']t available/.test(text),
      { sourceId: a.source_id, version: a.source_version, httpStatus: response?.status(), url: page.url() });
    await capture(page, 'source-valid-exact-version');
  });
  const absentId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  assert.notEqual(a.source_id, absentId); assert.notEqual(a.source_version, 2147483647);
  for (const [id, label, path] of [
    ['SRC-ID', 'Nonexistent source ID', '/teacher/materials/' + absentId + '?version=1'],
    ['SRC-VERSION', 'Unavailable version of actual saved source', '/teacher/materials/' + a.source_id + '?version=2147483647'],
    ['LESSON-VERSION', 'Unavailable published version of actual saved lesson', '/teacher/lessons/' + a.lesson_id + '?version=acceptance-nonexistent-version'],
  ]) await scenario(id, label + ' fails closed without fallback content', page, async () => {
    const response = await page.goto(absolute(path));
    await page.getByRole('heading', { name: 'This evidence isn’t available', exact: true }).waitFor({ state: 'visible' });
    const text = await page.locator('body').innerText(), status = response?.status();
    const unavailable = /404|could not be found|not found|unavailable|isn[’']t available/i.test(text);
    check(id, label + ' produces a bounded unavailable response',
      (status === 404 || (status === 200 && unavailable)) && unavailable && !/Internal Server Error|Application error/i.test(text),
      { url: page.url(), httpStatus: status, visibleText: text.slice(0, 5000), method: 'Direct GET only; nonexistent request identity; no database corruption',
        limitation: 'Does not establish recovery for a valid record whose underlying source becomes unavailable.' });
    await capture(page, id.toLowerCase() + '-unavailable');
  });
  unrun('SRC-LOST', 'Valid original evidence with subsequently unavailable source or contextual pane',
    'This read-only probe uses nonexistent IDs/versions. It does not corrupt a saved source or simulate production source loss.');
} catch (error) {
  unrun('HARNESS', 'Bounded teacher recovery helper', String(error));
  report.observations.push({ startupError: String(error) });
} finally {
  await writeFile(join(rt.out, 'read-only-receipts.json'), JSON.stringify({ dialogs, ...receipts }, null, 2) + '\n');
  await rt.finish();
}
