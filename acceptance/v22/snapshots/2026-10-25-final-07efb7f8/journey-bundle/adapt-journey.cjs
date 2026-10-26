const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const original='C:/Users/sb128/.codex/worktrees/workbench-verification-report/LearningPlatform/acceptance/v22/runner-final';
const out='C:/Users/sb128/.codex/visualizations/2026/10/25/01a173d6-e789-7233-92d2-b0b55d4559ed/journey-bundle';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const identities={
 '462cfb1b31d9108cec70d18b6553bd45048d2eed':'07efb7f821339538800f150f57b298eb2e606be3',
 '03cca1fed3900a122e689c4a512afadd9052e5af':'948b9a6005a056c97f10d181c589b5352d6221f3',
 'lp-v22-shell5':'lp-v22-final-01a173d6',
 'http://localhost:3350':'http://localhost:3396'
};
const files=['guarded-container-fixture.mjs','intervention-continuation-fixture.mjs','intervention-continuation-browser.mjs','shell-accessibility-browser.mjs','guarded-container-fixture.test.mjs','intervention-action.test.mjs'];
const manifest={preparedAt:new Date().toISOString(),sourcePR:122,sourcePRHead:'a82b90864b9d87153ba88128eb2282ac60f6dbeb',applicationCommit:identities['462cfb1b31d9108cec70d18b6553bd45048d2eed'],applicationTree:identities['03cca1fed3900a122e689c4a512afadd9052e5af'],origin:'http://localhost:3396',project:'lp-v22-final-01a173d6',runtimeExecuted:false,paidCalls:0,changes:[],files:[]};
function replaceRequired(text,find,replacement,label){if(!text.includes(find))throw Error('Missing source anchor '+label);manifest.changes.push(label);return text.replace(find,replacement)}
for(const file of files){const bytes=fs.readFileSync(path.join(original,file));let text=bytes.toString('utf8');for(const [a,b] of Object.entries(identities))text=text.split(a).join(b);
 if(file==='guarded-container-fixture.mjs'){
  text=replaceRequired(text,'    "student-regression",\n    "density-prepare",\n    "density-approve",\n    "density-publish",\n    "density-assignment",','', 'Narrow fixture adapter to prepare/evaluate-followup; unrelated fixture scripts not copied');
 }
 if(file==='intervention-continuation-browser.mjs'){
  const eol=text.includes('\r\n')?'\r\n':'\n';
  const helper=`async function selectInterventionPane(page, name) {
  if (page !== teacher || !new URL(page.url()).pathname.startsWith('/teacher/interventions')) return;
  const width = page.viewportSize().width;
  if (width <= 800) {
    const tab = page.getByRole('tab', { name, exact: true });
    await tab.click();
    assert.equal(await tab.getAttribute('aria-selected'), 'true');
  } else if (width <= 1240) {
    const dialog = page.locator('dialog.tw-panes-context');
    if (name === 'Steps' && !(await dialog.evaluate(element => element.open)))
      await page.getByRole('button', { name: 'Open Steps', exact: true }).click();
    if (name !== 'Steps' && await dialog.evaluate(element => element.open))
      await dialog.getByRole('button', { name: 'Close Steps', exact: true }).click();
  }
}
`.replaceAll('\n',eol);
  text=replaceRequired(text,'async function capture(page, name, allSizes = false, focus = null) {',helper+'async function capture(page, name, allSizes = false, focus = null) {','Select actual shared panes before viewport capture');
  text=replaceRequired(text,'    await page.setViewportSize({ width, height });','    await page.setViewportSize({ width, height });'+eol+'    await selectInterventionPane(page, focus || /followup|approved|delivered/.test(name) ? "Steps" : "Activity");','Expose correct responsive pane without altering screenshots');
  text=replaceRequired(text,'  await bounded("reload teacher comparison", () => teacher.reload());','  await bounded("reload teacher comparison", () => teacher.reload());'+eol+'  await selectInterventionPane(teacher, "Steps");','Linked follow-up resides in Steps');
  text=replaceRequired(text,'    const boxes = teacher.locator(','    await selectInterventionPane(teacher, "Steps");'+eol+'    await teacher.locator("details.lp-intervention-recipient-selection > summary").click();'+eol+'    const boxes = teacher.locator(','Open current recipient disclosure before authorized selection');
  const old=['      .getByRole("heading", {','        name: "Ready for your delivery decision",','        exact: true,','      })'].join(eol);
  text=replaceRequired(text,old,'      .getByText("Approved · awaiting delivery", { exact: true })','Current approved-but-undelivered status replaces removed old heading');
  text=replaceRequired(text,'    await evidence.locator("summary").click();','    await selectInterventionPane(teacher, "Evidence");'+eol+'    await evidence.locator("summary").click();','Explicit evidence pane before original inspection');
  text=replaceRequired(text,'    await teacher'+eol+'      .getByRole("button", { name: "Edit activity", exact: true })','    await selectInterventionPane(teacher, "Activity");'+eol+'    await teacher'+eol+'      .getByRole("button", { name: "Edit activity", exact: true })','Explicit Activity pane for editing');
 }
 const adapted=Buffer.from(text);fs.writeFileSync(path.join(out,file),adapted,{flag:'wx'});manifest.files.push({file,source:path.join(original,file),sourceSha256:hash(bytes),adaptedSha256:hash(adapted)});
}
const safetyPath=path.join(original,'..','safety.mjs'),safety=fs.readFileSync(safetyPath);if(hash(safety)!=='af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485')throw Error('Unexpected reviewed safety hash');fs.writeFileSync(path.join(out,'safety.mjs'),safety,{flag:'wx'});manifest.files.push({file:'safety.mjs',source:safetyPath,sourceSha256:hash(safety),adaptedSha256:hash(safety),unchanged:true});
fs.writeFileSync(path.join(out,'COPY_PROVENANCE.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({files:manifest.files.length,changes:manifest.changes,source:manifest.applicationCommit,tree:manifest.applicationTree}));

