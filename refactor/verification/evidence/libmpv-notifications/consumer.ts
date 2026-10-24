/** Declaration consumption only; no native operations are executed. */
import { MpvNotificationConversionError } from './contract.js'
import type {
  MpvEvent,
  MpvLogGap,
  MpvLogLevel,
  MpvLogRecord,
  MpvNativeEvent,
  MpvNativeLogRecord,
  MpvNotifications,
  ObserveEventsOptions
} from './contract.js'
import type { ValueRepresentation } from '../libmpv-explicit-values/contract.js'
import type { MpvObserver } from '../libmpv-subscriptions/contract.js'

declare const mpv: MpvNotifications
declare const consume: (value: unknown) => void
declare const handleError: (error: Error) => void
declare const output: ValueRepresentation
declare const signal: AbortSignal

declare const nativeEventObserver: MpvObserver<MpvNativeEvent>
declare const javascriptEventObserver: MpvObserver<MpvEvent>
declare const nativeLogObserver: MpvObserver<MpvNativeLogRecord>
declare const javascriptLogObserver: MpvObserver<MpvLogRecord>
declare const failure: Error

async function checkNotifications() {
  const events = await mpv.observeEvents(
    {
      next(event) {
        if (event.type === 'start-file') {
          const id: bigint = event.playlistEntryId
          consume(id)
          // @ts-expect-error Native 64-bit IDs do not become numbers.
          const numericId: number = event.playlistEntryId
          consume(numericId)
        } else if (event.type === 'end-file') {
          const code: number = event.errorCode
          const count: number = event.playlistInsertCount
          consume([code, count, event.reason, event.reasonCode, event.playlistInsertId])
          // @ts-expect-error C int fields are not mpv_node INT64 values.
          const widenedCode: bigint = event.errorCode
          consume(widenedCode)
        } else if (event.type === 'client-message') {
          const first: string | undefined = event.args[0]
          consume(first)
        } else {
          // @ts-expect-error Payload-free events do not claim a current playlist ID.
          consume(event.playlistEntryId)
        }
      },
      error: handleError
    },
    { events: ['start-file', 'end-file', 'client-message'], signal }
  )
  await events.dispose()

  await mpv.observeEvents(
    {
      next(event) {
        if (event.type === 'client-message') {
          const bytes: Uint8Array<ArrayBuffer> | undefined = event.args[0]
          consume(bytes)
          // @ts-expect-error Native strings remain bytes even when valid UTF-8.
          const text: string | undefined = event.args[0]
          consume(text)
        }
      },
      error: handleError
    },
    { output: 'native', events: ['client-message'] }
  )

  await mpv.observeEvents({ next: consume, error: handleError }, { events: [] })
  await mpv.observeEvents({ next: consume, error: handleError }, { events: ['idle', 'tick'] })

  // @ts-expect-error A receiver type cannot select native output without the option.
  await mpv.observeEvents(nativeEventObserver)
  // @ts-expect-error Event output cannot be selected with a caller-supplied type argument.
  await mpv.observeEvents<MpvNativeEvent>(nativeEventObserver)
  // @ts-expect-error Dynamic output cannot promise only JavaScript text.
  await mpv.observeEvents(javascriptEventObserver, { output })
  // @ts-expect-error Unknown event names do not bypass the supported catalogue.
  const invalidSelection: ObserveEventsOptions = { events: ['file-ready'] }
  consume(invalidSelection)

  await mpv.observeEvents(
    {
      next(event) {
        if (event.type === 'client-message') {
          const first: string | Uint8Array<ArrayBuffer> | undefined = event.args[0]
          consume(first)
        }
      },
      error: handleError
    },
    { output }
  )

  await mpv.observeLogs(
    {
      next(record) {
        if (record.type === 'gap') {
          const count: bigint | null = record.droppedCount
          consume([count, record.sources])
          // @ts-expect-error Loss notices are not ordinary diagnostic text.
          consume(record.text)
        } else {
          const level: MpvLogLevel = record.level
          const text: string = record.text
          consume([level, text, record.prefix, record.levelCode])
        }
      },
      error: handleError
    },
    { level: 'terminal-default' }
  )

  await mpv.observeLogs(
    {
      next(record) {
        if (record.type === 'log-message') {
          const prefix: Uint8Array<ArrayBuffer> = record.prefix
          const text: Uint8Array<ArrayBuffer> = record.text
          consume([prefix, text])
        }
      },
      error: handleError
    },
    { output: 'native', level: 'trace' }
  )

  // @ts-expect-error A native log receiver also requires the actual output option.
  await mpv.observeLogs(nativeLogObserver)
  // @ts-expect-error Dynamic output includes native text bytes.
  await mpv.observeLogs(javascriptLogObserver, { output })
  // @ts-expect-error terminal-default is a selection mode, not a message level.
  const modeAsLevel: MpvLogLevel = 'terminal-default'
  consume(modeAsLevel)
  // @ts-expect-error Native loss does not provide an exact message count.
  const guessedNativeLoss: MpvLogGap = { type: 'gap', sources: ['mpv'], droppedCount: 3n }
  consume(guessedNativeLoss)
  // @ts-expect-error A loss notice must identify at least one source.
  const emptyGap: MpvLogGap = { type: 'gap', sources: [], droppedCount: null }
  consume(emptyGap)
  // @ts-expect-error Stopping is represented by disposal, not a no-level subscriber.
  await mpv.observeLogs({ next: consume, error: handleError }, { level: 'no' })

  if (failure instanceof MpvNotificationConversionError) {
    const snapshot = failure.getNativeNotification()
    if (snapshot.type === 'log-message') {
      consume(snapshot.text.byteLength)
    } else if (snapshot.type === 'client-message') {
      consume(snapshot.args[0]?.byteLength)
    }
    // @ts-expect-error A notification snapshot does not change the node-value error API.
    failure.getNativeValue()
  }
}

void checkNotifications
