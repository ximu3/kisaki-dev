/** @fileoverview Defines English status labels for managed tasks. */

/** Canonical English labels for observable task phases and terminal outcomes. */
export const taskMessages = {
  running: 'Running',
  pausing: 'Pausing',
  paused: 'Paused',
  cancelling: 'Cancelling',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  interrupted: 'Interrupted',
} as const
