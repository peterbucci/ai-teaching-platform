import ts from "../../../node_modules/typescript/lib/typescript.js";
export default function interventionTsxLoader(source) {
  return ts.transpileModule(source, {
    fileName: this.resourcePath.endsWith(".txt")
      ? "fixture.tsx"
      : this.resourcePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
}
