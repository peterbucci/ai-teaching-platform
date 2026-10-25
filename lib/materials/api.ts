import "server-only";
import { apiResponse } from "../api.ts";
import { EvidenceError } from "../evidence/store.ts";
import { MaterialExtractionError } from "./contracts.ts";
import { MaterialReviewError } from "./review.ts";

export function materialResponse(operation: () => Promise<unknown>) {
  return apiResponse(async () => {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof MaterialExtractionError ||
        error instanceof MaterialReviewError
      ) {
        throw new EvidenceError(
          error instanceof MaterialExtractionError && error.code === "pdf_busy"
            ? 503
            : 400,
          error.message,
        );
      }
      throw error;
    }
  });
}
