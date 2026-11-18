/** @fileoverview Defines English lifecycle and type labels for managed tasks. */

/** Canonical English labels for observable task phases and terminal outcomes. */
export const taskMessages = {
  queued: 'Queued',
  running: 'Running',
  pausing: 'Pausing',
  paused: 'Paused',
  cancelling: 'Cancelling',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  interrupted: 'Interrupted',
  types: {
    directoryScan: 'Directory scan',
    libraryScan: 'Library scan',
    libraryRefresh: 'Refresh library',
  },
  unrecognizedType: 'Other task type ({type})',
} as const
