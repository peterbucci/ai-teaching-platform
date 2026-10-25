// Actual shared pane component/CSS with only Next's URL subscription mocked.
// node tests/teacher-pane-drawer-browser.mjs <fresh-output-directory>
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ??
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const root = process.cwd();
const out = resolve(process.argv[2]);
mkdirSync(out);
const read = (path) => readFileSync(resolve(root, path), "utf8");
const source = read("app/teacher/workspace-panes.tsx");
const model = read("app/teacher/workspace-panes-model.ts");
const css = read("app/teacher/workspace-shell.css");
const compile = (text) =>
  ts.transpileModule(
    text
      .replace(/^import[\s\S]*?;\r?\n/gm, "")
      .replace(/^export type \{[^}]*\} from [^;]*;\r?\n/gm, "")
      .replace(/\bexport\s+/g, ""),
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.None,
      },
    },
  ).outputText;
const modules = [
  ["react", "react/cjs/react.development.js"],
  ["react-dom", "react-dom/cjs/react-dom.development.js"],
  ["scheduler", "scheduler/cjs/scheduler.development.js"],
  ["react-dom/client", "react-dom/cjs/react-dom-client.development.js"],
].map(
  ([name, path]) =>
    `${JSON.stringify(name)}:function(module,exports,require){${read("node_modules/" + path)}\n}`,
);
const bundle = `const process={env:{NODE_ENV:'development'}};const modules={${modules.join(",")}},cache={};function require(name){if(cache[name])return cache[name].exports;const module=cache[name]={exports:{}};modules[name](module,module.exports,require);return module.exports}const React=require('react'),ReactDOM=require('react-dom/client');
const {useId,useLayoutEffect,useRef,useSyncExternalStore,useState}=React;
const notify=()=>dispatchEvent(new Event('urlchange'));
for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{original(...args);notify()}}
function useSearchParams(){const search=useSyncExternalStore(fn=>{addEventListener('urlchange',fn);addEventListener('popstate',fn);return()=>{removeEventListener('urlchange',fn);removeEventListener('popstate',fn)}},()=>location.search,()=>location.search);return new URLSearchParams(search)}
${compile(model)}\n${compile(source)}
function Slot({name}){const [value,setValue]=useState(name+' original');return React.createElement('label',null,name+' work',React.createElement('input',{'aria-label':name+' work',value,onChange:e=>setValue(e.target.value)}))}
const chosen=new URLSearchParams(location.search).get('drawer');
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(TeacherWorkspacePanes,{
...(chosen==='navigation'?{tabletDrawer:chosen}:{}),
navigation:{label:'Evidence',children:React.createElement(Slot,{name:'Evidence'})},
main:{label:'Activity',children:React.createElement(Slot,{name:'Activity'})},
context:{label:'Steps',children:React.createElement(Slot,{name:'Steps'})}})));
`;
const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:24px 28px 56px;font:14px system-ui}:root{--line:#ccc;--ink:#17302d;--green:#176d58}input{display:block;max-width:100%}${css}</style><div id="root"></div><script>${bundle}</script>`;
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(html);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE ??
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const report = {
  category:
    "Actual shared panes/CSS; mocked Next URL hook, no database or model calls",
  sources: Object.fromEntries(
    Object.entries({ source, model, css }).map(([key, value]) => [
      key,
      createHash("sha256").update(value).digest("hex"),
    ]),
  ),
  checks: [],
};
try {
  for (const drawer of ["context", "navigation"]) {
    const page = await browser.newPage({
      viewport: { width: 1024, height: 768 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${origin}/?drawer=${drawer}`);
    const drawerLabel = drawer === "context" ? "Steps" : "Evidence";
    const inlineLabel = drawer === "context" ? "Evidence" : "Steps";
    await page.getByLabel("Activity work").fill("unsaved activity");
    await page.getByLabel(inlineLabel + " work").fill("unsaved inline");
    assert.equal(
      await page.getByLabel(drawerLabel + " work").isVisible(),
      false,
    );
    const trigger = page.getByRole("button", { name: "Open " + drawerLabel });
    await trigger.click();
    await page.locator("dialog:modal").waitFor();
    await page.getByLabel(drawerLabel + " work").fill("unsaved drawer");
    // Native dialog may hand Tab to browser chrome (BODY in the document),
    // but must never focus the inert background or its editable fields.
    await page.getByLabel("Activity work").evaluate((el) => el.focus());
    assert.equal(
      await page
        .getByLabel("Activity work")
        .evaluate((el) => el === document.activeElement),
      false,
    );
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => ({
        tag: document.activeElement.tagName,
        modal: !!document.activeElement.closest("dialog:modal"),
      }));
      assert(focus.modal || focus.tag === "BODY", JSON.stringify(focus));
    }
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog:modal"));
    assert.equal(
      await trigger.evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(new URL(page.url()).searchParams.get("workspacePane"), "main");
    await trigger.click();
    assert.equal(
      await page.getByLabel(drawerLabel + " work").inputValue(),
      "unsaved drawer",
    );
    await page.goBack();
    await page.waitForFunction(() => !document.querySelector("dialog:modal"));
    await page.goForward();
    await page.locator("dialog:modal").waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForFunction(() => !document.querySelector("dialog:modal"));
    for (const name of ["Evidence", "Activity", "Steps"])
      assert.equal(await page.getByLabel(name + " work").isVisible(), true);
    const boxes = await Promise.all(
      ["Evidence", "Activity", "Steps"].map((name) =>
        page.getByLabel(name + " work").boundingBox(),
      ),
    );
    assert(
      boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x,
      "Desktop slot order",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("tab", { name: "Activity", exact: true }).click();
    assert.equal(
      await page.getByLabel("Activity work").inputValue(),
      "unsaved activity",
    );
    for (const name of ["Evidence", "Steps"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      assert.equal(
        await page.getByLabel(name + " work").inputValue(),
        name === drawerLabel ? "unsaved drawer" : "unsaved inline",
      );
      assert.equal(await page.getByLabel("Activity work").isVisible(), false);
    }
    await page.setViewportSize({ width: 320, height: 844 });
    await page.getByRole("tab", { name: drawerLabel, exact: true }).click();
    assert.equal(
      await page.getByLabel(drawerLabel + " work").isVisible(),
      true,
    );
    await page.reload();
    await page.getByLabel(drawerLabel + " work").waitFor();
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.locator("dialog:modal").waitFor();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog:modal"));
    assert.equal(await page.getByLabel("Activity work").isVisible(), true);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: resolve(out, drawer + "-tablet.png") });
    report.checks.push({
      drawer,
      status: "passed",
      cases: [
        "default/opt-in tablet columns",
        "modal focus trap",
        "Escape opener focus",
        "native Back/Forward",
        "desktop order",
        "phone panes 390/320",
        "unsaved values across breakpoint/pane changes",
        "reload + direct drawer close",
        "no page errors",
      ],
    });
    await page.close();
  }
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((done) => server.close(done));
}
console.log(JSON.stringify(report));
