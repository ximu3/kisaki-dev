/** Declaration consumption only; no native operations are executed. */
import { getClientApiVersion } from './contract.js'
import type { Mpv, MpvControl } from './contract.js'
import { MpvError, MpvNativeError, MpvAbortError, MpvObservationError } from './errors.js'
import type { MpvCreationContext } from './errors.js'
import { MpvConversionError } from '../libmpv-explicit-values/contract.js'
import { MpvNotificationConversionError } from '../libmpv-notifications/contract.js'

declare const mpv: Mpv
declare const failure: unknown
declare const output: 'javascript' | 'native'
declare const consume: (value: unknown) => void
declare const report: (error: Error) => void

async function checkControl() {
  const version = await getClientApiVersion()
  consume([version.major, version.minor])
  mpv.unref().ref()
  const alive: boolean = mpv.hasRef()
  const clock: bigint = mpv.getTimeNs()
  consume([alive, clock, mpv.clientId, mpv.clientName])

  await using client = await mpv.createClient({ name: 'integration' })
  const control: MpvControl = client
  await control.setProperty('pause', true)
  const text: string = await control.getPropertyText('time-pos', { format: 'osd' })
  const bytes: Uint8Array<ArrayBuffer> = await control.getPropertyText('path', { output: 'native' })
  const dynamic: string | Uint8Array<ArrayBuffer> = await control.getPropertyText('path', {
    output
  })
  consume([text, bytes, dynamic])
  await control.loadConfigFile('C:/example/mpv.conf')

  // @ts-expect-error A client does not own core termination.
  await client.close()
  // @ts-expect-error Node keepalive belongs to the owning Mpv.
  client.unref()
  // @ts-expect-error Raw text output requires the actual mode option.
  const forgedBytes: Uint8Array<ArrayBuffer> = await control.getPropertyText('path')
  consume(forgedBytes)
  // @ts-expect-error Caller-supplied result generics cannot select output.
  await control.getPropertyText<Uint8Array<ArrayBuffer>>('path')
  // @ts-expect-error Dynamic output cannot promise only a string.
  const forgedText: string = await control.getPropertyText('path', { output })
  consume(forgedText)

  await using hook = await control.addHook('on_load', {
    async run(context) {
      const signal: AbortSignal = context.signal
      consume(signal)
      await control.setProperty('pause', true, { signal })
      // @ts-expect-error Native hook IDs are not exposed.
      consume(context.id)
      // @ts-expect-error Handler completion is the only public continuation mechanism.
      await context.continue()
    },
    error(reason) {
      const original: unknown = reason
      consume(original)
    }
  })
  await hook.dispose()
  // @ts-expect-error Registration requires an explicit failure receiver.
  await control.addHook('on_load', { run: () => undefined })
  // @ts-expect-error Hook handlers must accept arbitrary user rejection values.
  await control.addHook('on_load', { run: () => undefined, error: report })
  // @ts-expect-error Passive observers cannot accidentally become awaited hook handlers.
  await control.addHook('on_load', { next: consume, error: consume })

  if (failure instanceof MpvError) {
    consume([failure.operation, failure.submitted])
    const creation = failure.creation
    if (creation?.stage === 'options') {
      const index: number = creation.optionIndex
      consume(index)
    }
  }
  if (failure instanceof MpvNativeError) {
    const numeric: number = failure.code
    const symbolic: string | null = failure.nativeName
    consume([numeric, symbolic])
    // @ts-expect-error Numeric native errors are not binding error codes.
    const bindingCode: 'closed' = failure.code
    consume(bindingCode)
  }
  if (failure instanceof MpvAbortError) {
    const code: 'ABORT_ERR' = failure.code
    consume([code, failure.cause, failure.submitted])
  }
  if (failure instanceof MpvConversionError) {
    const common: MpvError = failure
    const submitted: true = failure.submitted
    consume([common, submitted, failure.getNativeValue()])
  }
  if (failure instanceof MpvNotificationConversionError) {
    const common: MpvError = failure
    if (failure.operation === 'createMpv') consume(failure.getNativeNotification())
    consume(common)
  }
  if (failure instanceof MpvObservationError) {
    consume(failure.reason)
    // @ts-expect-error Interruption does not invent a retained result.
    failure.getNativeValue()
  }
  // @ts-expect-error Option-setting context must identify the failing entry.
  const missingIndex: MpvCreationContext = { stage: 'options' }
  consume(missingIndex)
}

void checkControl
