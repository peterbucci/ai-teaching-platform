// Demo: one shared validator, called the way renderer and generator code would call it.
// Run with: node --experimental-strip-types --conditions=react-server scripts/check-visual-demo.ts
import { validateVisualActivity } from "../lib/visual/validate.ts";
import {
  invalidConceptGraphs,
  validConceptGraph,
} from "../lib/visual/examples.ts";

function rendererSide(record: unknown) {
  const result = validateVisualActivity(record);
  if (!result.ok) return `renderer rejected: ${result.errors.join("; ")}`;
  return `renderer accepted: "${(result.activity as { title: string }).title}"`;
}

function generatorSide(record: unknown) {
  const result = validateVisualActivity(record);
  if (!result.ok) return `generator rejected: ${result.errors.join("; ")}`;
  return `generator accepted: "${(result.activity as { title: string }).title}"`;
}

console.log("Valid record:");
console.log(" ", rendererSide(validConceptGraph));
console.log(" ", generatorSide(validConceptGraph));

console.log("Invalid record (broken source commit):");
const invalid = invalidConceptGraphs.brokenSourceCommit;
console.log(" ", rendererSide(invalid));
console.log(" ", generatorSide(invalid));

const checks = [
  validateVisualActivity(validConceptGraph).ok === true,
  validateVisualActivity(invalid).ok === false,
];
if (!checks.every(Boolean)) {
  console.error("Demo check failed");
  process.exitCode = 1;
} else {
  console.log("Demo check passed");
}
