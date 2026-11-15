/** @fileoverview Shares the development renderer's entry-recovery event with its documents. */

/** A failed document sends its HTML revision. A reply asks that document to load the edited source. */
export const entryRecoveryEvent = 'kisaki:renderer-entry-recovery'
