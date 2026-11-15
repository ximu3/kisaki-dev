/** @fileoverview Exercises CLI cancellation and a simultaneous cleanup failure in an owned child. */

import { runCli } from '@kisaki3/tooling/cli'

await runCli(async (signal) => {
  process.emit('SIGINT')
  if (process.argv[2] === 'cleanup') {
    throw new AggregateError(
      [signal.reason, new Error('Synthetic cleanup failure')],
      'Cleanup failed',
    )
  }
  signal.throwIfAborted()
})
