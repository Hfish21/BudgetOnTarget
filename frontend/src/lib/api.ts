import { localApi } from "@/lib/local-engine";

/**
 * The single seam every component calls through.
 *
 * BudgetOnTarget runs entirely in the browser, so every call is served by the
 * local engine reading the in-memory store loaded from a `.budget` file. This
 * module exists to keep components decoupled from that fact — if a hosted
 * backend ever returns, it swaps in here and nothing else changes.
 */
export const api = localApi;
