/** @fileoverview Fixes the engineering carrier startup workload and its measurement budget. */

/** Twenty fresh processes; the workload contains windows and native modules without product data. */
export const budgets = {
  samples: 20,
  carrierStartupP95Ms: 5_000,
} as const
