// N0 owns this barrel. Leaves import these contracts; no leaf/controller exports
// here until a reviewed sequential integration. Type-only domain imports stay so.
export type * from "./contracts.ts";
export {
  NotebookRouteStateSchema,
  notebookHref,
  parseNotebookHref,
} from "./route-state.ts";
export type { NotebookRouteState } from "./route-state.ts";
export {
  notebookQuestionHref,
  notebookSavedWork,
  notebookReadingContext,
  notebookReviewCard,
} from "./adapters.ts";
