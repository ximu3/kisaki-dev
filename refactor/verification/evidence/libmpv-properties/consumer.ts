/** Type consumption only; the real C API probe is recorded separately. */
import type { MpvControl } from '../libmpv-control/contract.js'
import type { MpvObserver } from '../libmpv-subscriptions/contract.js'
import type {
  MpvNode,
  MpvPropertyFormat,
  PropertyState
} from '../libmpv-explicit-values/contract.js'

declare const mpv: MpvControl
declare const output: 'javascript' | 'native'
declare const format: MpvPropertyFormat
declare const consume: (value: unknown) => void
declare const error: (reason: Error) => void

async function checkProperties() {
  const pause: boolean = await mpv.getProperty('pause')
  const nodePause: boolean = await mpv.getProperty('pause', { format: 'node' })
  const integer: bigint = await mpv.getProperty('volume', { format: 'int64' })
  const floating: number = await mpv.getProperty('volume', { format: 'double' })
  const native = await mpv.getProperty('volume', { format: 'int64', output: 'native' })
  const nativeTag: 'int64' = native.format
  const nativeValue: bigint = native.value
  const dynamic: boolean | bigint | number = await mpv.getProperty('pause', { format })
  const dynamicOutput: bigint | Extract<MpvNode, { format: 'int64' }> = await mpv.getProperty(
    'volume',
    { format: 'int64', output }
  )
  consume([pause, nodePause, integer, floating, nativeTag, nativeValue, dynamic, dynamicOutput])

  // @ts-expect-error Explicit integer coercion does not return a JavaScript number.
  const wrongInteger: number = await mpv.getProperty('volume', { format: 'int64' })
  consume(wrongInteger)
  // @ts-expect-error A format generic cannot select a format without its runtime option.
  await mpv.getProperty<'volume', 'int64'>('volume')
  // @ts-expect-error A format generic must match the actual request.
  await mpv.getProperty<'volume', 'int64'>('volume', { format: 'double' })
  // @ts-expect-error No-value hints only exist for observations.
  await mpv.getProperty('pause', { format: 'none' })
  // @ts-expect-error Text formatting uses the text entry point.
  await mpv.getProperty('pause', { format: 'string' })
  // @ts-expect-error Node storage formats are not all property request formats.
  await mpv.getProperty('user-data/value', { format: 'map' })
  // @ts-expect-error Dynamic output must retain both representations.
  const wrongOutput: bigint = await mpv.getProperty('volume', { format: 'int64', output })
  consume(wrongOutput)

  await mpv.observeProperty(
    'volume',
    {
      next(state) {
        if (state.status === 'available') {
          const value: bigint = state.value
          consume(value)
        }
      },
      error
    },
    { format: 'int64' }
  )
  await mpv.observeProperty(
    'pause',
    {
      next() {
        consume('refresh requested')
      },
      error
    },
    { format: 'none' }
  )
  const values: MpvObserver<PropertyState<boolean>> = { next: consume, error }
  // @ts-expect-error No-value observations cannot promise a property state.
  await mpv.observeProperty('pause', values, { format: 'none' })
  // @ts-expect-error A no-value hint has no output representation to select.
  await mpv.observeProperty('pause', { next: consume, error }, { format: 'none', output: 'native' })
  const wrongFormat: MpvObserver<PropertyState<number>> = { next: consume, error }
  // @ts-expect-error The observer cannot widen the selected native format.
  await mpv.observeProperty('volume', wrongFormat, { format: 'int64' })

  await mpv.observePropertyText('time-pos', {
    next(state) {
      if (state.status === 'available') {
        const value: string = state.value
        consume(value)
      }
    },
    error
  })
  const byteText: MpvObserver<PropertyState<Uint8Array<ArrayBuffer>>> = { next: consume, error }
  await mpv.observePropertyText('path', byteText, { output: 'native' })
  // @ts-expect-error Byte text requires the actual representation option.
  await mpv.observePropertyText('path', byteText)
  // @ts-expect-error Upstream does not support OSD-formatted property observations.
  await mpv.observePropertyText('time-pos', { next: consume, error }, { format: 'osd' })
}

void checkProperties
