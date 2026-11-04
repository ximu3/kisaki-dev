/** @fileoverview Projects saved task histories without resuming interrupted work. */

import type { TaskRun } from '@kisaki3/desktop-contracts/tasks'
import { isTaskTerminal } from '@kisaki3/desktop-contracts/tasks'

/** A nonterminal persisted row with no runtime owner is an unconfirmed interrupted history, not resumed work. */
export function projectTaskHistory<Result, Input>(
  run: TaskRun<Result, Input>,
  hasExecution: boolean,
): TaskRun<Result, Input> {
  return !hasExecution && !isTaskTerminal(run.status)
    ? { ...run, status: 'interrupted', finishedAt: null }
    : run
}
