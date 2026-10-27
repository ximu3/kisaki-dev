import { startDevelopmentSession } from './session'
import type { DevelopmentSession } from './session'

const startup = new AbortController()
let session: DevelopmentSession | undefined
let ready = false
let forceOffered = false

/** Startup can abort; a running application first gets its normal, cancellable quit request. */
function interrupt(signal: NodeJS.Signals): void {
  if (!ready || !session) {
    startup.abort(new Error('Development startup interrupted'))
    process.exitCode = signal === 'SIGINT' ? 130 : 143
    return
  }
  const operation = forceOffered ? session.terminate() : session.stop()
  void operation.then(
    (result) => {
      if (result === 'cancelled') console.info('Application exit cancelled; development continues')
    },
    (cause: unknown) => {
      console.error(cause)
      forceOffered = true
      console.error("Press Ctrl+C again to terminate this development session's application")
    },
  )
}

const onInterrupt = () => interrupt('SIGINT')
const onTerminate = () => interrupt('SIGTERM')
process.on('SIGINT', onInterrupt)
process.on('SIGTERM', onTerminate)
try {
  session = await startDevelopmentSession({
    signal: startup.signal,
    onState(state, cause) {
      if (state === 'failed') console.error(cause)
    },
  })
  await session.ready
  ready = true
  console.info('Desktop development session ready')
  await session.closed
} catch (cause) {
  if (!startup.signal.aborted) {
    console.error(cause)
    process.exitCode = 1
  }
} finally {
  if (!ready) await session?.stop()
  process.off('SIGINT', onInterrupt)
  process.off('SIGTERM', onTerminate)
}
