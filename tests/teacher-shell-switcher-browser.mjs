// Opt-in browser regression. No application server, database, authentication,
// build, or new dependency is needed. Run only when the coordinator permits it.
// node tests/teacher-shell-switcher-browser.mjs --source <absolute-repo>
//   --output <fresh-absolute-directory> --browser <absolute-browser-executable>
//   --modules <absolute-node_modules-containing-playwright>
// Optional: --react-mode production|development|both (default: both).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index],
    value = process.argv[index + 1];
  assert.ok(
    ["--source", "--output", "--browser", "--modules", "--react-mode"].includes(
      key,
    ) && value,
    "Unknown or incomplete argument.",
  );
  assert.equal(args.has(key), false, "Duplicate argument: " + key);
  args.set(key, value);
}
for (const key of ["--source", "--output", "--browser", "--modules"]) {
  assert.ok(
    args.get(key) && isAbsolute(args.get(key)),
    "Explicit absolute " + key + " is required.",
  );
}
const sourceRoot = await realpath(args.get("--source"));
const output = resolve(args.get("--output"));
const outputRelative = relative(sourceRoot, output);
assert.ok(
  isAbsolute(outputRelative) || outputRelative.startsWith(".." + sep),
  "Evidence output must be outside the application source.",
);
const requestedMode = args.get("--react-mode") ?? "both";
assert.ok(["production", "development", "both"].includes(requestedMode));
const modes =
  requestedMode === "both" ? ["production", "development"] : [requestedMode];
const require = createRequire(import.meta.url);
const ts = require(join(sourceRoot, "node_modules", "typescript"));
const { chromium } = require(join(args.get("--modules"), "playwright"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const source = await readFile(
  join(sourceRoot, "app/teacher/navigation.tsx"),
  "utf8",
);
const css = await readFile(
  join(sourceRoot, "app/teacher/workspace-shell.css"),
  "utf8",
);
const reactVersion = JSON.parse(
  await readFile(join(sourceRoot, "node_modules/react/package.json"), "utf8"),
).version;
const compiled = ts.transpileModule(
  source.replace(/^import[\s\S]*?;\r?\n/gm, "").replace(/\bexport\s+/g, ""),
  {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

async function reactBundle(mode) {
  const files = [
    ["react", `react/cjs/react.${mode}.js`],
    ["react-dom", `react-dom/cjs/react-dom.${mode}.js`],
    ["scheduler", `scheduler/cjs/scheduler.${mode}.js`],
    ["react-dom/client", `react-dom/cjs/react-dom-client.${mode}.js`],
  ];
  const modules = await Promise.all(
    files.map(
      async ([name, path]) =>
        `${JSON.stringify(name)}:function(module,exports,require){${await readFile(join(sourceRoot, "node_modules", path), "utf8")}\n}`,
    ),
  );
  return `(()=>{const process={env:{NODE_ENV:${JSON.stringify(mode)}}};const modules={${modules.join(",")}};const cache={};function require(name){if(cache[name])return cache[name].exports;const module=cache[name]={exports:{}};modules[name](module,module.exports,require);return module.exports}window.React=require("react");window.ReactDOM=require("react-dom/client")})()`;
}

const fixtureCSS = `*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,sans-serif;color:#17302d}button,input{font:inherit}button{background:white;cursor:pointer}a{color:inherit;text-decoration:none}h1{margin:0 0 16px}input{display:block;max-width:440px;width:100%;padding:10px}output{display:block;margin-top:16px}:root{--ink:#17302d;--green:#176d58;--muted:#61766c;--line:#d8e5de;--mint:#eaf6ef}${css}`;
const fixture = `
const {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore}=React;
window.fixtureState={pageEscapes:0,registrations:0,activePageHandlers:0,nativeCancels:0,cancelDefaultPrevented:null};
function usePathname(){return location.pathname}
function useSearchParams(){return new URLSearchParams(location.search)}
function Link(props){return React.createElement('a',props)}
function Icon(){return React.createElement('span',{'aria-hidden':true},'·')}
function AccountMenu(){return React.createElement('button',{'aria-label':'Fictional account'},'JR')}
function WorkspaceNavigationRestoration(){return null}
function WorkspaceAssignmentStatus(){return React.createElement('span',null,'Fixed fictional lesson')}
const assignments=[{id:'30000000-0000-4000-8000-000000000001',title:'Fictional latency investigation',class_name:'Fictional Class A',version:'v1',availability:'active'}];
function useWorkspaceAssignments(){return assignments}
function resolveWorkspaceSelection(){return{assignment:assignments[0],context:{assignment:assignments[0].id,origin:'synthetic_fixture'}}}
function workspaceAuthoringMode(){return undefined}
function workspaceDestination(){return'Progress'}
function workspaceNavigationHref(path,context,view){if(path==='/teacher/assignments'&&!view)return path;const query=new URLSearchParams({assignment:context.assignment,origin:context.origin});if(view)query.set('view',view);return path+'?'+query}
function switchedAssignmentHref(assignment,origin){return workspaceNavigationHref('/teacher/assignments',{assignment,origin},'progress')}
${compiled}
function PageOwnedPane(){
  const[pane,setPane]=useState('details');
  const[work,setWork]=useState('Fictional unfinished detail');
  useEffect(()=>{
    // Deliberately broad native document bubble listener. The shared modal must
    // contain Escape even when a page does not scope its own handler correctly.
    const escape=event=>{
      if(event.key!=='Escape')return;
      window.fixtureState.pageEscapes++;
      event.preventDefault();
      const url=new URL(location.href);url.searchParams.set('pane','grid');
      history.replaceState(history.state,'',url);
      setPane('grid');
    };
    document.addEventListener('keydown',escape);
    window.fixtureState.registrations++;window.fixtureState.activePageHandlers++;
    window.fixtureReady=true;
    return()=>{document.removeEventListener('keydown',escape);window.fixtureState.activePageHandlers--;window.fixtureReady=false};
  },[]);
  return React.createElement(React.Fragment,null,
    React.createElement('h1',null,'Page-owned Progress fixture'),
    React.createElement('label',null,'Page-owned detail',React.createElement('input',{'aria-label':'Page-owned detail',value:work,onChange:event=>setWork(event.target.value)})),
    React.createElement('output',{'data-testid':'page-pane'},pane));
}
// Next delegates React events from document. A div root would conceal the
// same-node document-listener propagation defect this regression must catch.
ReactDOM.createRoot(document).render(React.createElement(React.StrictMode,null,
  React.createElement('html',{lang:'en'},
    React.createElement('head',null,
      React.createElement('meta',{charSet:'utf-8'}),
      React.createElement('meta',{name:'viewport',content:'width=device-width,initial-scale=1'}),
      React.createElement('title',null,'Shared switcher Escape regression'),
      React.createElement('style',null,${JSON.stringify(fixtureCSS)})),
    React.createElement('body',null,React.createElement(TeacherWorkspace,{section:'Progress'},React.createElement(PageOwnedPane))))));
`;

const bundles = new Map();
for (const mode of modes)
  bundles.set(`/react-${mode}.js`, await reactBundle(mode));
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  response.setHeader("Cache-Control", "no-store");
  if (bundles.has(url.pathname)) {
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.end(bundles.get(url.pathname));
    return;
  }
  if (url.pathname === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.end(fixture);
    return;
  }
  if (url.pathname !== "/teacher/assignments") {
    response.statusCode = 404;
    response.end();
    return;
  }
  const mode = url.searchParams.get("reactMode");
  if (!modes.includes(mode)) {
    response.statusCode = 400;
    response.end();
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(
    `<!doctype html><html><head><meta charset="utf-8"></head><body><script src="/react-${mode}.js"></script><script src="/fixture.js"></script></body></html>`,
  );
});

await mkdir(output); // Existing evidence must never be overwritten.
const specifications = modes.flatMap((mode) =>
  [
    [1440, 1000],
    [1024, 768],
    [390, 844],
  ].map(([width, height]) => ({
    mode,
    width,
    height,
    name: `${mode}-${width}x${height}`,
  })),
);
const report = {
  category:
    "Actual shared TeacherWorkspace and CSS, isolated page-owned broad Escape fixture; Next hooks, data and ancillary components mocked",
  reactVersion,
  reactRoot: "document",
  strictMode: true,
  sourceHashes: {
    "app/teacher/navigation.tsx": hash(source),
    "app/teacher/workspace-shell.css": hash(css),
  },
  harnessSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  startedAt: new Date().toISOString(),
  status: "running",
  expectedCases: specifications.length,
  cases: [],
  errors: [],
  limitations: [
    "Component regression, not application or database verification",
    "No document capture listener is modeled; the conflicting page listener deliberately runs in document bubble phase",
  ],
};
let browser;
try {
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath: args.get("--browser"),
  });
  for (const specification of specifications) {
    const { mode, width, height, name } = specification;
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.on("pageerror", (error) =>
      report.errors.push({ case: name, message: error.message }),
    );
    try {
      await page.goto(
        `${origin}/teacher/assignments?assignment=30000000-0000-4000-8000-000000000001&view=progress&pane=details&reactMode=${mode}`,
      );
      await page.waitForFunction(
        () =>
          window.fixtureReady && window.fixtureState.activePageHandlers === 1,
      );
      const input = page.getByLabel("Page-owned detail", { exact: true });
      await input.fill("Local fictional work remains unchanged");
      const urlBefore = page.url();
      const opener = page.locator(
        ".tw-assignment-switch:visible,.tw-scope-switch:visible",
      );
      assert.equal(await opener.count(), 1);
      await opener.click();
      const dialog = page.locator("#teacher-workspace-switcher");
      await page.waitForFunction(() =>
        document.querySelector("#teacher-workspace-switcher").matches(":modal"),
      );
      await dialog.evaluate((element) =>
        element.addEventListener(
          "cancel",
          (event) => {
            window.fixtureState.nativeCancels++;
            window.fixtureState.cancelDefaultPrevented = event.defaultPrevented;
          },
          { once: true },
        ),
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => !document.querySelector("#teacher-workspace-switcher").open,
      );
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-controls") ===
          "teacher-workspace-switcher",
      );
      assert.equal(
        await opener.evaluate((element) => document.activeElement === element),
        true,
      );
      assert.equal(
        page.url(),
        urlBefore,
        "Modal Escape cannot change the page URL",
      );
      assert.equal(
        await page.getByTestId("page-pane").textContent(),
        "details",
        "Modal Escape cannot change the page pane",
      );
      assert.equal(
        await input.inputValue(),
        "Local fictional work remains unchanged",
      );
      const modalEscape = await page.evaluate(() => ({
        ...window.fixtureState,
      }));
      assert.equal(
        modalEscape.pageEscapes,
        0,
        "The broad page document handler must not run",
      );
      assert.equal(
        modalEscape.nativeCancels,
        1,
        "Native dialog cancellation must remain active",
      );
      assert.equal(modalEscape.cancelDefaultPrevented, false);
      assert.equal(modalEscape.activePageHandlers, 1);
      if (mode === "development")
        assert.ok(
          modalEscape.registrations >= 2,
          "Development StrictMode must replay the page effect",
        );

      await input.focus();
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          window.fixtureState.pageEscapes === 1 &&
          document.querySelector('[data-testid="page-pane"]').textContent ===
            "grid",
      );
      assert.equal(
        new URL(page.url()).searchParams.get("pane"),
        "grid",
        "Page Escape outside the dialog remains page-owned",
      );
      assert.equal(
        await input.inputValue(),
        "Local fictional work remains unchanged",
      );
      assert.equal(await dialog.evaluate((element) => element.open), false);
      report.cases.push({
        ...specification,
        status: "pass",
        urlBefore,
        urlAfterPageEscape: page.url(),
        modalEscape,
        outsideEscape: await page.evaluate(() => ({ ...window.fixtureState })),
        assertions: [
          "Native dialog closes",
          "Opener regains focus",
          "URL and page pane unchanged by modal Escape",
          "Broad page handler receives no modal Escape",
          "Escape outside modal still reaches page handler",
        ],
      });
    } catch (error) {
      const failure = {
        ...specification,
        status: "fail",
        error: String(error),
      };
      try {
        failure.observed = await page.evaluate(() => ({
          state: window.fixtureState,
          url: location.href,
          dialogOpen: document.querySelector("#teacher-workspace-switcher")
            ?.open,
          activeTag: document.activeElement?.tagName,
        }));
        await page.screenshot({ path: join(output, name + "-failure.png") });
      } catch {}
      report.cases.push(failure);
    } finally {
      await context.close();
    }
  }
} catch (error) {
  report.fatal = String(error);
} finally {
  if (browser)
    await browser
      .close()
      .catch((error) => report.errors.push({ closing: String(error) }));
  server.closeAllConnections();
  if (server.listening) await new Promise((done) => server.close(done));
  for (const specification of specifications)
    if (!report.cases.some((item) => item.name === specification.name))
      report.cases.push({
        ...specification,
        status: "unrun",
        reason: "Fixture setup did not complete",
      });
  report.finishedAt = new Date().toISOString();
  report.status =
    !report.fatal &&
    report.errors.length === 0 &&
    report.cases.every((item) => item.status === "pass")
      ? "pass"
      : "fail";
  await writeFile(
    join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify({
    status: report.status,
    cases: report.cases.length,
    failed: report.cases
      .filter((item) => item.status !== "pass")
      .map((item) => item.name),
    report: join(output, "report.json"),
  }),
);
if (report.status !== "pass") process.exitCode = 1;
