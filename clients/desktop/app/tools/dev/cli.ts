import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { runCli } from '@kisaki3/tooling/cli'
import { startSourceSession } from './application'

await runCli(async (signal) => {
  const { values } = parseArgs({ options: { profile: { type: 'string' } } })
  const session = await startSourceSession({
    signal,
    ...(values.profile && { profile: resolve(values.profile) }),
    onState(state, error) {
      if (error) {
        console.error(error)
      } else {
        console.info(state)
      }
    },
  })
  await session.ready
  const stop = () => {
    void session.stop().catch(console.error)
  }
  signal.addEventListener('abort', stop, { once: true })
  try {
    if (signal.aborted) {
      stop()
    }
    await session.closed
  } finally {
    signal.removeEventListener('abort', stop)
  }
})
