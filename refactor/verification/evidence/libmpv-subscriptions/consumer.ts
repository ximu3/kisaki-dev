import type {
  MpvNode,
  PropertyState,
  ValueRepresentation
} from '../libmpv-explicit-values/contract.js'
import type { MpvObserver, MpvSubscriptions } from './contract.js'

declare const mpv: MpvSubscriptions
declare const output: ValueRepresentation
declare function report(error: Error): void

async function consume() {
  const controller = new AbortController()
  const subscription = await mpv.observeProperty(
    'time-pos',
    {
      next(state) {
        if (state.status === 'available') {
          const position: number = state.value
          void position
        }
      },
      error: report
    },
    { signal: controller.signal }
  )

  const rawObserver: MpvObserver<PropertyState<MpvNode>> = {
    next(state) {
      if (state.status === 'available' && state.value.format === 'int64') {
        const integer: bigint = state.value.value
        void integer
      }
    },
    error: report,
    complete() {}
  }
  await mpv.observeProperty('pause', rawObserver, { output: 'native' })
  await mpv.observeProperty(
    'pause',
    {
      next(state) {
        if (state.status === 'available') {
          const value: boolean | MpvNode = state.value
          void value
        }
      },
      error: report
    },
    { output }
  )
  await subscription.dispose()

  // @ts-expect-error Native output must be explicitly selected, not inferred from the callback.
  await mpv.observeProperty('pause', rawObserver)
  // @ts-expect-error A receiver must handle subscription failures.
  await mpv.observeProperty('pause', { next() {} })
  // @ts-expect-error A receiver must accept data notifications.
  await mpv.observeProperty('pause', { error: report })
  // @ts-expect-error Callback parameter types cannot widen a known property name.
  await mpv.observeProperty('pause', { next: (_state: PropertyState<number>) => {}, error: report })
  await mpv.observeProperty('pause', {
    // @ts-expect-error The unavailable branch cannot be excluded by a narrower callback.
    next: (_state: { status: 'available'; value: boolean }) => {},
    error: report
  })
  // @ts-expect-error Subscription state belongs to the library.
  subscription.closed = false
  // @ts-expect-error Cleanup is asynchronous.
  const synchronousCleanup: void = subscription.dispose()
  // @ts-expect-error Active callback references are readonly in the declared receiver.
  rawObserver.error = report
  // @ts-expect-error A property subscription has no input-value representation selector.
  await mpv.observeProperty('pause', { next() {}, error: report }, { input: 'native' })
  // @ts-expect-error An explicit type argument cannot replace the actual output option.
  await mpv.observeProperty<'pause', 'native'>('pause', rawObserver)
  void synchronousCleanup
}

// TypeScript permits async functions in a void callback position; runtime semantics must be documented.
const asyncReceiver: MpvObserver<PropertyState<number>> = {
  async next() {},
  error: report
}

void [consume, asyncReceiver]
