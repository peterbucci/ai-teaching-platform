/** Verification only. Do not run concurrently with another guarded browser/database task.
 * node teacher-recovery-browser.mjs <state> <fresh-out> <playwright> <safety.mjs> <passed-authoring-report.json>
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
  helper: 'teacher-question-recovery-context-return-and-unavailable-source' });
const { report, check, unrun, capture, get } = rt;
report.harnessSha256 = hash(readFileSync(new URL(import.meta.url)));
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
function sameContext(actual, expected, keys) {
  const u = new URL(actual), e = new URL(expected);
  return u.pathname === e.pathname && keys.every(k => u.searchParams.get(k) === e.searchParams.get(k));
}
async function readBrowserPosition(page) {
  return page.evaluate(() => ({ scrollY, focusedTag: document.activeElement?.tagName,
    focusedText: document.activeElement?.textContent?.trim().slice(0, 240),
    focusedHref: document.activeElement instanceof HTMLAnchorElement ? document.activeElement.href : null }));
}

try {
  const { context, page } = await rt.launch('teacher');
  const bankPath = '/api/teacher/lessons/' + a.lesson_id + '/question-bank';
  const objectivePath = '/api/teacher/objectives/' + a.lesson_id;
  const questionBase = '/teacher/lessons/' + a.lesson_id + '/questions';
  let bankBefore, question, questionURL, original, edited;
  const wording = () => page.getByRole('textbox', { name: /^Question wording · student visible/ });

  await scenario('L-READ', 'Read exact current question bank before local recovery checks', page, async () => {
    bankBefore = await get(context, bankPath); receipts.bankBefore = bankBefore;
    assert.equal(bankBefore.lesson_id, a.lesson_id);
    question = bankBefore.draft.questions?.[0]; assert.ok(question);
    assert.ok(bankBefore.draft.question_bank?.items.some(x => x.question_id === question.question_id));
    questionURL = absolute(questionBase + '?question=' + encodeURIComponent(question.question_id));
    await page.goto(questionURL);
    const field = await requireControl(wording(), 'Question wording');
    original = await field.inputValue();
    check('L-READ', 'Current saved question is displayed without mutation', original === question.prompt_text,
      { lessonId: a.lesson_id, questionId: question.question_id, revision: bankBefore.revision });
    await capture(page, 'question-before-local-edit');
  });

  await scenario('L-NAV', 'Cancel navigation preserves unsaved question text', page, async () => {
    if (!questionURL) throw new Error('Current question fixture unavailable');
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
      await withDialogs(page, 'accept', () => page.reload());
      const discard = page.getByRole('button', { name: 'Discard recovery copy', exact: true });
      if (await discard.count() === 1) await discard.click();
    } else {
      // Browser-only recovery cleanup. Never resubmit the bank.
      await withDialogs(page, 'accept', () => page.goto(questionURL));
      const discard = page.getByRole('button', { name: 'Discard recovery copy', exact: true });
      if (await discard.count() === 1) await discard.click();
    }
    const after = await get(context, bankPath); receipts.bankAfter = after;
    check('L-RESTORE', 'Read-only reconciliation confirms the saved bank and revision are unchanged',
      JSON.stringify(after) === JSON.stringify(bankBefore), { beforeRevision: bankBefore.revision, afterRevision: after.revision });
    check('L-RESTORE', 'Local question wording restored to initial text',
      await wording().count() === 1 && await wording().inputValue() === original);
    await capture(page, 'question-original-restored');
  });

  await scenario('L-EMPHASIS', 'Native objective Emphasis keyboard selection and local restoration', page, async () => {
    const before = await get(context, objectivePath); receipts.objectivesBefore = before;
    const objectiveId = before.lesson?.draft?.objective_workflow?.items?.[0]?.concept_id;
    if (!objectiveId) throw new Error('No saved objective in the passed journey lesson');
    await withDialogs(page, 'accept', () => page.goto(absolute('/teacher/objectives/' + a.lesson_id + '?objective=' + encodeURIComponent(objectiveId))));
    const select = await requireControl(page.getByRole('combobox', { name: /^Emphasis/ }), 'Emphasis');
    const initial = await select.inputValue();
    await select.focus(); await select.press('Alt+ArrowDown');
    await capture(page, 'emphasis-native-popup-requested');
    report.observations.push({ id: 'L-EMPHASIS', visualReviewRequired: true,
      note: 'Alt+ArrowDown sent to native select; inspect original image. Do not infer menu visibility from focus or selected value.' });
    const target = initial === 'optional' ? '' : 'optional';
    const movement = initial === 'optional' ? 'Home' : 'End';
    await select.press(movement); await select.press('Enter');
    check('L-EMPHASIS', 'Native keyboard changes Emphasis to another option',
      await select.inputValue() === target && target !== initial,
      { original: initial, expected: target, actual: await select.inputValue(), method: 'Alt+ArrowDown, ' + movement + ', Enter' });
    await select.selectOption(initial); await settle(page);
    check('L-EMPHASIS', 'Local Emphasis restored without Save', await select.inputValue() === initial);
    const after = await get(context, objectivePath); receipts.objectivesAfter = after;
    check('L-EMPHASIS', 'Saved objectives unchanged after native select check', JSON.stringify(before) === JSON.stringify(after));
    unrun('L-EMPHASIS-POPUP', 'Native Emphasis expanded-menu visual acceptance', 'Original popup-request screenshot requires independent visual inspection; keyboard operation does not establish popup visibility.');
  });

  let session, concept, origin, rosterURL, rosterName;
  await scenario('R-READ', 'Read saved session to select real contextual-return fixture', page, async () => {
    session = await get(context, '/api/teacher/sessions/' + a.student_session_id); receipts.session = session;
    assert.equal(session.session.assignment_id, a.assignment_id);
    const attempt = session.attempts.find(x => x.id === a.presented_attempt_id); assert.ok(attempt);
    concept = attempt.question.concept_ids[0]; origin = session.session.data_origin;
    assert.ok(['live_demo', 'synthetic_fixture'].includes(origin));
    await withDialogs(page, 'accept', () => page.goto(absolute('/teacher/students?' + new URLSearchParams({ assignment: a.assignment_id, origin }))));
    const details = page.locator('.lp-directory-student').filter({ has: page.locator('a[href="/teacher/sessions/' + a.student_session_id + '"]') });
    if (await details.count() !== 1) throw new Error('Journey session not found in roster directory');
    rosterName = await details.locator('summary strong').innerText();
    rosterURL = absolute('/teacher/students?' + new URLSearchParams({ assignment: a.assignment_id, origin, q: rosterName }));
    check('R-READ', 'Journey fixture belongs to current selected assignment and evidence source', true,
      { assignment: a.assignment_id, session: a.student_session_id, origin, concept, student: rosterName });
  });
  async function openRosterSession() {
    if (!rosterURL) throw new Error('Roster fixture unavailable');
    await page.goto(rosterURL);
    const details = page.locator('.lp-directory-student').filter({ has: page.locator('a[href="/teacher/sessions/' + a.student_session_id + '"]') });
    await requireControl(details.locator('summary'), 'Journey student'); await details.locator('summary').click();
    const link = await requireControl(details.getByRole('link', { name: /^Inspect session/ }), 'Inspect saved session');
    const before = await readBrowserPosition(page), href = await link.getAttribute('href');
    await link.click(); await page.locator('.lp-evidence-page').waitFor();
    return { before, href };
  }
  await scenario('R-NATIVE', 'Roster native Back preserves originating assignment, source and search', page, async () => {
    const link = await openRosterSession(); await page.goBack();
    await page.getByRole('heading', { name: 'Students', exact: true }).waitFor();
    check('R-NATIVE', 'Native Back returns to filtered roster URL', sameContext(page.url(), rosterURL, ['assignment', 'origin', 'q']),
      { expected: rosterURL, actual: page.url(), link, after: await readBrowserPosition(page) });
    await capture(page, 'roster-native-back');
  });
  await scenario('R-DISPLAYED', 'Roster displayed Back returns to the originating filtered roster', page, async () => {
    const link = await openRosterSession();
    const back = await requireControl(page.locator('.lp-evidence-page').getByRole('link', { name: /^Back to / }), 'Displayed session return');
    const backText = await back.innerText(), href = await back.getAttribute('href');
    await back.click(); await settle(page);
    check('R-DISPLAYED', 'Displayed Back retains Roster, assignment, source and search', sameContext(page.url(), rosterURL, ['assignment', 'origin', 'q']),
      { expected: rosterURL, actual: page.url(), entryLink: link.href, backText, href, owner: '#116 / #8', staticFinding: 'R01' });
    await capture(page, 'roster-displayed-return');
  });
  async function openInsightsSession() {
    if (!concept || !origin) throw new Error('Insights fixture unavailable');
    const url = absolute('/teacher/insights?' + new URLSearchParams({ assignment: a.assignment_id, origin, concept }) + '#responses');
    await page.goto(url);
    const link = page.locator('#responses a[href="/teacher/sessions/' + a.student_session_id + '"]');
    if (await link.count() !== 1) throw new Error('Journey session missing from concept-filtered Insights');
    const ancestor = link.locator('xpath=ancestor::details[1]');
    if (await ancestor.count() && !await ancestor.evaluate(n => n.open)) await ancestor.locator('summary').click();
    await (await requireControl(link, 'Insights Inspect session')).click();
    await page.locator('.lp-evidence-page').waitFor(); return url;
  }
  await scenario('I-NATIVE', 'Insights native Back preserves assignment, concept and evidence source', page, async () => {
    const expected = await openInsightsSession(); await page.goBack();
    await page.getByRole('heading', { name: 'Learning insights', exact: true }).waitFor();
    check('I-NATIVE', 'Native Back returns to concept-filtered Insights', sameContext(page.url(), expected, ['assignment', 'origin', 'concept']),
      { expected, actual: page.url(), after: await readBrowserPosition(page) });
    await capture(page, 'insights-native-back');
  });
  await scenario('I-DISPLAYED', 'Insights displayed Back preserves assignment, concept and evidence source', page, async () => {
    const expected = await openInsightsSession();
    const back = await requireControl(page.locator('.lp-evidence-page').getByRole('link', { name: /^Back to / }), 'Displayed session return');
    const href = await back.getAttribute('href'); await back.click(); await settle(page);
    check('I-DISPLAYED', 'Displayed Back preserves concept-filtered Insights', sameContext(page.url(), expected, ['assignment', 'origin', 'concept']),
      { expected, actual: page.url(), href, owner: '#116 / #21', staticFinding: 'R02' });
    await capture(page, 'insights-displayed-return');
  });

  await scenario('SRC-VALID', 'Actual journey source version opens before unavailable-source probes', page, async () => {
    const response = await page.goto(absolute('/teacher/materials/' + a.source_id + '?version=' + a.source_version));
    const text = await page.locator('body').innerText();
    check('SRC-VALID', 'Exact saved source route is available', response?.status() === 200 && !/This page could not be found/.test(text),
      { sourceId: a.source_id, version: a.source_version, status: response?.status(), url: page.url() });
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
    const text = await page.locator('body').innerText(), status = response?.status();
    const unavailable = /404|could not be found|not found|unavailable/i.test(text);
    check(id, label + ' produces a bounded unavailable response',
      (status === 404 || (status === 200 && unavailable)) && unavailable && !/Internal Server Error|Application error/i.test(text),
      { url: page.url(), status, visibleText: text.slice(0, 5000), method: 'Direct GET only; nonexistent request identity; no database corruption',
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
