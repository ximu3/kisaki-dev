import { startDevelopmentSession } from '../../tools/dev/session'
import type { DevelopmentSession } from '../../tools/dev/session'

let session: DevelopmentSession | undefined
try {
  session = await startDevelopmentSession({
    onState(state, error) {
      process.send?.({
        state,
        current: session?.current,
        rendererUrl: session?.rendererUrl,
        error: error instanceof Error ? error.message : undefined,
      })
    },
  })
  process.on('message', (message: unknown) => {
    if (message && typeof message === 'object' && 'type' in message && message.type === 'stop') {
      void session!.stop().then(() => {
        process.disconnect?.()
      })
    }
  })
  process.on('disconnect', () => {
    void session!.stop()
  })
} catch (cause) {
  console.error(cause)
  process.exitCode = 1
}
