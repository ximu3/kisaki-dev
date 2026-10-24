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

/** Existing design limits plus an absolute budget for the new W00 engineering shell. */
export const budgets = {
  samples: 20,
  backgroundInputP95Ms: 100,
  synchronousMainWorkMs: 50,
  // The W00 shell has no equivalent old-product workload; this is not a library startup budget.
  engineeringShellStartupP95Ms: 5_000,
} as const
