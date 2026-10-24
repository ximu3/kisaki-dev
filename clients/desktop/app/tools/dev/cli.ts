import { startDevelopmentSession } from './session'

try {
  const session = await startDevelopmentSession({
    onState(state, cause) {
      if (state === 'failed') console.error(cause)
    },
  })
  const stop = () => {
    void session.stop().catch((cause: unknown) => {
      console.error(cause)
      process.exitCode = 1
    })
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  await session.ready
  console.info('Desktop development session ready')
} catch (cause) {
  console.error(cause)
  process.exitCode = 1
}
