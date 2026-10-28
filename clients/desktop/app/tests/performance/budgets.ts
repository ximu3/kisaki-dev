/**
 * @fileoverview Defines representative product workloads and the budgets used by desktop
 * performance measurements.
 */

/** Design workloads, fixed before the corresponding implementation is measured. */
export const workloads = {
  library: {
    entries: 50_000,
    parts: 200_000,
    relations: 500_000,
    files: 100_000,
    activities: 500_000,
    dynamicCollections: 100,
  },
  stressMultiplier: 10,
  fixedSelection: [10_000, 100_000, 1_000_000],
  scanCandidates: [1_000, 10_000, 100_000],
  relatedObjects: [1_000, 10_000],
  completionRecords: [1, 100, 1_000, 100_000],
  reading: {
    imagePages: 10_000,
    chapters: 500,
    chapterUtf16Units: 1_000_000,
    stressChapterUtf16Units: 10_000_000,
  },
  video: ['1080p', '4K'],
} as const

/** Limits for interactive work and startup of the window and native-module workload. */
export const budgets = {
  samples: 20,
  backgroundInputP95Ms: 100,
  synchronousMainWorkMs: 50,
  // Measures windows and native-module readiness without a loaded library, business views or extensions.
  engineeringShellStartupP95Ms: 5_000,
} as const
