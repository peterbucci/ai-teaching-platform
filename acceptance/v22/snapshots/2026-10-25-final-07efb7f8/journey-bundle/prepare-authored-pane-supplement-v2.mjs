// Offline copy: correct label extraction only; preserve the executed helper.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const source=new URL('./authored-pane-retention-supplement.mjs',import.meta.url);
const target=new URL('./authored-pane-retention-supplement-v2.mjs',import.meta.url);
assert.equal(existsSync(target),false);
let text=readFileSync(source,'utf8');
const before="const association=await input.evaluate(e=>({label:e.closest('label')?.textContent.trim(),article:e.closest('article')?.getAttribute('aria-labelledby')}));";
const after="const association=await input.evaluate(e=>{const label=e.closest('label')?.cloneNode(true);label?.querySelectorAll('textarea').forEach(field=>field.remove());return {label:label?.textContent.trim(),article:e.closest('article')?.getAttribute('aria-labelledby')};});";
assert.equal(text.split(before).length,2,'Unique label assertion extraction expected');
text=text.replace(before,after);
text=text.replace("helper:'authoring-mobile-pane-retention-only'","helper:'authoring-mobile-pane-retention-only-v2'");
text=text.replace("report.harnessSha256=hash(readFileSync(new URL(import.meta.url)));", "report.harnessSha256=hash(readFileSync(new URL(import.meta.url)));\nreport.labelExtractionCorrection={priorRun:'authored-pane-retention-03',reason:'A textarea retains its initial value as a text child. Compare the label after excluding the textarea child, preserving exact field identity and all retention/persistence assertions. Prior run stopped before editing.'};");
writeFileSync(target,text);console.log(target.pathname);
