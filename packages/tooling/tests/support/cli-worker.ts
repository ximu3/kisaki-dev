import { runCli } from '@kisaki3/tooling/cli'

const mode = process.argv[2]
await runCli(async (signal) => {
  process.emit(mode === 'terminate' ? 'SIGTERM' : 'SIGINT')
  if (mode === 'interrupt-then-terminate') {
    process.emit('SIGTERM')
  }
  if (mode === 'cleanup') {
    throw new AggregateError(
      [signal.reason, new Error('Synthetic cleanup failure')],
      'Cleanup failed',
    )
  }
  signal.throwIfAborted()
})
