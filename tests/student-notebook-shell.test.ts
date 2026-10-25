import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

// The repository runner uses react-server conditions. Render client components
// in an isolated ordinary React process, using the installed TS compiler only.
// No app route, database, provider, new test dependency or global loader needed.
function render(expression: string): string {
  const script = `
    const fs = require('node:fs');
    const path = require('node:path');
    const ts = require('typescript');
    const React = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    const cache = new Map();
    function load(filename) {
      if (cache.has(filename)) return cache.get(filename).exports;
      const module = { exports: {} };
      cache.set(filename, module);
      const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 }
      }).outputText;
      const localRequire = (name) => name.endsWith('.module.css')
        ? new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
        : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name)) : require(name);
      new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
      return module.exports;
    }
    const { NotebookShell, N0NotebookShell, notebookNavigationLink, NotebookPage, NotebookState, NotebookPageNavigation } = load(path.resolve('app/study/notebook/shell/index.ts'));
    const h = React.createElement;
    const destinations = [
      { id: 'learning', label: 'My learning', href: '/study/assignments', current: true },
      { id: 'notebook', label: 'Notebook', href: '/study/history' },
      { id: 'reading', label: 'Reading', href: '/study/reading' }
    ];
    global.fetch = () => { throw new Error('Shell rendering must not request anything'); };
    process.stdout.write(renderToStaticMarkup(${expression}));
  `;
  const result = spawnSync(
    process.execPath,
    ["--input-type=commonjs", "-e", script],
    { cwd: root, encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("all notebook surfaces share one navigation and one unchanged learning slot", () => {
  for (const title of [
    "My learning",
    "Active practice",
    "Saved work",
    "Reading",
    "Teacher review",
  ]) {
    const html = render(`h(NotebookShell, {
      title: ${JSON.stringify(title)}, destinations,
      pages: { title: 'Pages', groups: [] },
      context: { title: 'Reading', content: h('p', null, 'Authorized context') }
    }, h('section', { 'data-study-session': 'existing-owner' }, h('textarea', { 'aria-label': 'Existing composer' })))`);
    assert.equal((html.match(/data-study-session=/g) ?? []).length, 1, title);
    assert.equal((html.match(/<textarea/g) ?? []).length, 1, title);
    assert.equal(
      (html.match(/aria-label="Student navigation"/g) ?? []).length,
      1,
      title,
    );
    assert.equal(
      (html.match(/aria-label="Notebook pages"/g) ?? []).length,
      1,
      title,
    );
    assert.ok(html.includes("Authorized context"));
  }
});

test("critical notices are outside the pane layout and no composer is invented", () => {
  const html = render(`h(NotebookShell, {
    title: 'Practice', destinations,
    notices: h('div', { role: 'alert' }, 'Save unconfirmed', h('button', null, 'Check status'))
  }, h('p', null, 'Existing learning content'))`);
  assert.match(html, /role="alert"/);
  assert.ok(html.indexOf("Save unconfirmed") < html.indexOf('class="layout"'));
  assert.equal((html.match(/<textarea|<input|<form/g) ?? []).length, 0);
});

test("links retain historical session and passage anchors; missing groups invent no page counts", () => {
  const href =
    "/study/assignments/authorized?tab=study&session=historical#question-original";
  const html = render(`h(NotebookPageNavigation, { groups: [
    { id: 'empty', label: 'Not loaded', pages: [] },
    { id: 'history', label: 'Earlier work', pages: [
      { id: 'first', label: 'Original answer', detail: 'Pending evaluation', href: ${JSON.stringify(href)}, current: true },
      { id: 'second', label: 'Same words, different attempt', href: '/study/history#question-another' }
    ] }
  ] })`);
  assert.ok(html.includes(href.replaceAll("&", "&amp;")));
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.equal((html.match(/<li>/g) ?? []).length, 2);
  assert.ok(!html.includes("Not loaded"));
  assert.ok(html.includes("Pending evaluation"));
  assert.ok(!html.includes("correct"));
});

test("empty and unavailable states retain explicit recovery without claiming work is saved", () => {
  for (const kind of ["empty", "unavailable", "loading", "pending"]) {
    const html = render(
      `h(NotebookState, { kind: '${kind}', title: 'Reading ${kind}', action: h('a', { href: '/study/assignments' }, 'Back to My learning') }, h('p', null, 'No source is available for this selection.'))`,
    );
    assert.ok(html.includes('href="/study/assignments"'));
    assert.equal(html.includes('aria-busy="true"'), kind === "loading");
    assert.ok(!html.includes("saved"));
    assert.ok(!html.includes("<input"));
  }
});

test("N0 slots mount once, preserve custom navigation, and keep composer extraction optional", () => {
  const html = render(`h(N0NotebookShell, {
    navigation: { section: 'records', route: {kind:'history'}, onNavigate: () => { throw Error('Render cannot navigate'); } },
    slots: {
      header: h('span', {'data-slot':'header'}, 'Custom header'),
      navigation: h('nav', {'data-slot':'navigation'}, 'Owner navigation'),
      index: h('a', {'data-slot':'index', href:'#original'}, 'Original page'),
      page: h('section', {'data-slot':'page'}, 'Original content'),
      context: h('p', {'data-slot':'context'}, 'Authorized context'),
      composer: h('textarea', {'data-slot':'composer'}),
      notice: h('p', {'data-slot':'notice'}, 'Pending receipt')
    }
  })`);
  for (const slot of [
    "header",
    "navigation",
    "index",
    "page",
    "context",
    "composer",
    "notice",
  ]) {
    assert.equal(
      (html.match(new RegExp(`data-slot="${slot}"`, "g")) ?? []).length,
      1,
      slot,
    );
  }
  assert.equal((html.match(/<textarea/g) ?? []).length, 1);
  assert.ok(
    !html.includes('aria-label="Student navigation"'),
    "custom navigation replaces the default",
  );
});

test("N0 navigation emits only explicit ordinary-click intent and leaves new-tab clicks native", () => {
  const html = render(`(() => {
    const calls = [];
    const destination = {kind:'history'};
    const link = notebookNavigationLink({section:'learning',route:{kind:'learning'},onNavigate: value => calls.push(value)}, destination);
    let prevented = 0;
    const event = {button:0,defaultPrevented:false,preventDefault:()=>prevented++};
    for (const modifier of ['ctrlKey','metaKey','shiftKey','altKey']) link.onClick({...event,[modifier]:true});
    link.onClick({...event,button:1});
    link.onClick({...event,defaultPrevented:true});
    if (calls.length || prevented) throw Error('Modified click was intercepted');
    link.onClick(event);
    if (calls.length !== 1 || calls[0] !== destination || prevented !== 1) throw Error('Ordinary click not routed exactly once');
    return h('p',null,link.href);
  })()`);
  assert.ok(html.includes("/study/history"));
});

test("original long text is rendered verbatim as text, not interpreted markup", () => {
  const original =
    "<script>do not execute</script> " +
    "Long original student reasoning. ".repeat(300);
  const html = render(
    `h(NotebookPage, { label: 'Original response', marker: '2', current: true }, h('p', null, ${JSON.stringify(original)}))`,
  );
  assert.ok(html.includes("&lt;script&gt;do not execute&lt;/script&gt;"));
  assert.equal(
    (html.match(/Long original student reasoning\./g) ?? []).length,
    300,
  );
  assert.ok(!html.includes("<script>"));
});
