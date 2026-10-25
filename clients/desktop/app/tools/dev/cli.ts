import { runCli } from '../../../../../tools/outputs'
import { startDevelopmentSession } from './session'

await runCli(async (signal) => {
  const session = await startDevelopmentSession({
    signal,
    onState(state, cause) {
      if (state === 'failed') console.error(cause)
    },
  })
  try {
    await session.ready
    console.info('Desktop development session ready')
    await session.closed
  } finally {
    await session.stop()
  }
})
