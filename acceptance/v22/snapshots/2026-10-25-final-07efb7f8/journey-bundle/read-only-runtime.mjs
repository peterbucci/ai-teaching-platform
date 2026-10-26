import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SHA = '07efb7f821339538800f150f57b298eb2e606be3';
export const TREE = '948b9a6005a056c97f10d181c589b5352d6221f3';
export const safetyHash = 'af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const settle = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

/** New verification-only harness. Shared safety implementation is imported unchanged. */
export async function openRuntime({ stateArg, outArg, playwrightArg, safetyArg, helper, inputArg }) {
  for (const value of [stateArg, outArg, playwrightArg, safetyArg]) assert.ok(value);
  const state = resolve(stateArg), out = resolve(outArg);
  assert.equal(existsSync(out), false, 'Fresh output directory required');
  const manifest = JSON.parse(readFileSync(join(state, 'manifest.json'), 'utf8'));
  assert.equal(manifest.sourceSha, SHA); assert.equal(manifest.sourceTree, TREE);
  assert.equal(manifest.project, 'lp-v22-final-01a173d6');
  assert.equal(manifest.origin, 'http://localhost:3396');
  assert.equal(manifest.target, 'shell'); assert.equal(manifest.paidModelCallsAuthorized, false);
  assert.match(manifest.configurationCategory, /provider-disabled/);
  const rel = relative(manifest.source, out);
  assert.ok(rel.startsWith('..') || isAbsolute(rel), 'Evidence must be outside source');
  const envText = readFileSync(join(state, '.env.acceptance'), 'utf8');
  for (const key of ['OPENAI_API_KEY', 'OPENAI_MODEL'])
    assert.deepEqual(envText.split(/\r?\n/).filter(line => new RegExp('^' + key + '=').test(line)), [key + '=']);
  assert.equal(hash(readFileSync(safetyArg)), safetyHash);
  for (const [ref, expected] of [['HEAD', SHA], ['HEAD^{tree}', TREE]]) {
    const result = spawnSync('git', ['-C', manifest.source, 'rev-parse', ref], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0); assert.equal(result.stdout.trim(), expected);
  }
  const { acquireLock, preflight, MIN_RUNTIME_GIB, LOCK_PATH } = await import(pathToFileURL(resolve(safetyArg)).href);
  const { chromium } = createRequire(import.meta.url)(resolve(playwrightArg));
  await mkdir(out, { recursive: false });
  const report = {
    helper, sourceSha: SHA, sourceTree: TREE, project: manifest.project, origin: manifest.origin,
    inputSha256: inputArg ? hash(readFileSync(resolve(inputArg))) : null,
    runtimeHelperSha256: hash(readFileSync(new URL(import.meta.url))), safetySha256: safetyHash,
    startedAt: new Date().toISOString(), status: 'running', checks: [], observations: [], screenshots: [],
    blockedRequests: [], safety: [], actualModelCalls: 0, syntheticEvaluation: true,
    method: 'Authenticated native browser application checks; all requests after fictional login are read-only. No mutation replay.',
    limitations: ['No screen reader or physical device acceptance', 'Synthetic fixtures do not demonstrate actual-model decisions'],
  };
  const save = () => writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const release = acquireLock({ action: helper, source: manifest.source, state, out, project: manifest.project, sourceSha: SHA });
  report.lockOwner = JSON.parse(readFileSync(join(LOCK_PATH, 'owner.json'), 'utf8'));
  await save();
  const contexts = [], browsers = [];
  let fatal = false;
  function guard(label) {
    const result = preflight({ source: manifest.source, state, minimumGiB: MIN_RUNTIME_GIB,
      explicitPath: manifest.dockerDataPath || undefined, probeContainer: manifest.storageProbeContainer || undefined });
    report.safety.push({ label, ...result });
    if (!result.pass) { fatal = true; throw new Error('Reviewed runtime storage preflight failed'); }
  }
  const check = (id, label, passed, detail = {}) => report.checks.push({ id, label, status: passed ? 'passed' : 'failed', ...detail });
  const unrun = (id, label, reason) => report.checks.push({ id, label, status: 'unrun', reason });
  async function capture(page, name) {
    await settle(page);
    const file = name + '.png';
    await page.screenshot({ path: join(out, file), fullPage: false, timeout: 15000 });
    const metrics = await page.evaluate(() => ({ innerWidth, innerHeight, outerWidth, outerHeight, dpr: devicePixelRatio,
      rootZoom: getComputedStyle(document.documentElement).zoom, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
    report.screenshots.push({ file, url: page.url(), ...metrics }); await save();
  }
  async function run(id, label, page, callback) {
    if (fatal) { unrun(id, label, 'Runtime guard or browser state unavailable'); return; }
    try { guard(label); await callback(); }
    catch (error) {
      check(id, label, false, { error: String(error), url: page.url() });
      try { await capture(page, 'failure-' + id.replace(/[^a-zA-Z0-9-]/g, '-') + '-' + report.checks.length); } catch { /* Preserve original. */ }
    }
    await save();
  }
  async function launch(role = 'teacher', zoom = null) {
    guard('launch-' + role + '-' + (zoom ?? 'viewport'));
    const executablePath = process.env.BROWSER_EXECUTABLE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    let context;
    if (zoom) {
      const profile = join(out, 'private-profile-' + role + '-' + zoom);
      await mkdir(join(profile, 'Default'), { recursive: true });
      await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: {
        x: Math.log(zoom) / Math.log(1.2), 0: Math.log(zoom) / Math.log(1.2) } } }));
      context = await chromium.launchPersistentContext(profile, { executablePath, headless: true, viewport: null,
        args: ['--window-size=1440,1000'] });
    } else {
      const browser = await chromium.launch({ executablePath, headless: true }); browsers.push(browser);
      context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    }
    contexts.push(context);
    let loginUsed = false;
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
      if (url.origin === manifest.origin && ['GET', 'HEAD'].includes(request.method())) return route.continue();
      if (url.origin === manifest.origin && url.pathname === '/api/auth/demo-sign-in' && request.method() === 'POST' && !loginUsed) {
        loginUsed = true; return route.continue();
      }
      report.blockedRequests.push({ url: url.href, method: request.method() }); return route.abort('blockedbyclient');
    });
    const page = context.pages()[0] ?? await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto(manifest.origin + '/login');
    await page.getByRole('button', { name: role === 'teacher' ? 'Demo teacher' : 'Demo student', exact: true }).click();
    await page.waitForURL(role === 'teacher' ? '**/teacher' : '**/study/assignments');
    return { context, page };
  }
  async function get(context, path) {
    const url = new URL(path, manifest.origin); assert.equal(url.origin, manifest.origin);
    const response = await context.request.get(url.href, { timeout: 20000 });
    assert.equal(response.status(), 200, 'Authorized read failed: ' + url.pathname); return response.json();
  }
  async function finish() {
    for (const context of contexts) {
      let timeout;
      try { await Promise.race([context.close(), new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Context close timeout')), 20000); })]); }
      catch (error) { fatal = true; report.closeError = String(error); }
      finally { clearTimeout(timeout); }
    }
    for (const browser of browsers) { try { await browser.close(); } catch (error) { fatal = true; report.closeError = String(error); } }
    if (report.blockedRequests.length) check('SAFETY', 'Read-only browser attempted no forbidden requests', false, { requests: report.blockedRequests });
    report.status = fatal ? 'blocked' : report.checks.some(c => c.status === 'failed') ? 'failed' : 'passed';
    report.finishedAt = new Date().toISOString();
    if (fatal) { report.lockRetained = true; report.reconciliationRequired ??= 'Reconcile browser closure/guard state before owner release'; }
    else release();
    await save();
    if (report.status !== 'passed') process.exitCode = 1;
    console.log(JSON.stringify({ status: report.status, report: join(out, 'report.json') }));
  }
  function retainLock(reason) { fatal = true; report.reconciliationRequired = reason; }
  return { manifest, report, out, save, run, check, unrun, capture, launch, get, finish, guard, retainLock };
}
