// Test/visual harness only. Run without react-server so React DOM can render HTML.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL("../presenters.tsx", import.meta.url),
  "utf8",
);
const compiled = ts
  .transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  })
  .outputText.replaceAll(
    '"./presentation.ts"',
    JSON.stringify(new URL("../presentation.ts", import.meta.url).href),
  )
  .replaceAll(
    '"react/jsx-runtime"',
    JSON.stringify(pathToFileURL(require.resolve("react/jsx-runtime")).href),
  );
const presenters = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const requests = JSON.parse(readFileSync(0, "utf8"));
const rendered = requests.map(({ component, props, controllerSlot }) => {
  if (controllerSlot)
    props.children = createElement(
      "section",
      { "data-controller-slot": "existing" },
      createElement("h2", null, "Existing fresh-check controller"),
      createElement("p", null, "Controller-owned content"),
    );
  return renderToStaticMarkup(createElement(presenters[component], props));
});
process.stdout.write(JSON.stringify(rendered));
