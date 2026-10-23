import type { OrchestrationFailure } from "./contracts.ts";

/** A typed service failure contains no provider or student text. */
export class OrchestrationError extends Error {
  readonly reason: OrchestrationFailure;
  readonly reconcile: boolean;
  constructor(reason: OrchestrationFailure, reconcile = false) {
    super(reason);
    this.name = "OrchestrationError";
    this.reason = reason;
    this.reconcile = reconcile;
  }
}
