import type {
  NativeMpv,
  NativeProperty,
  NativeValue,
  PropertyState,
  SelectedMpv,
  SnapshotMpv
} from './comparison.js'

declare const selected: SelectedMpv
declare const native: NativeMpv
declare const snapshot: SnapshotMpv
declare const output: 'javascript' | 'native'

async function compare() {
  const ordinaryPause: boolean = await selected.getProperty('pause')
  const rawPause: NativeProperty<'pause'> = await selected.getProperty('pause', {
    output: 'native'
  })
  const conditionalPause: boolean | NativeProperty<'pause'> = await selected.getProperty('pause', {
    output
  })
  const nativePause: boolean = (await native.getProperty('pause')).value
  const snapshotPause: boolean = (await snapshot.getProperty('pause')).toJavaScript()
  const screenshotWidth: bigint = (await selected.command(['screenshot-raw'])).w

  await selected.setProperty('pause', true)
  await selected.setProperty(
    'pause',
    { format: 'string', bytes: new Uint8Array([0x79, 0x65, 0x73]) },
    { input: 'native' }
  )

  // @ts-expect-error Native output is not a directly returned boolean.
  const incorrectBoolean: boolean = await selected.getProperty('pause', { output: 'native' })
  // @ts-expect-error A dynamic output selection requires a union at the use site.
  const conditionalBoolean: boolean = await selected.getProperty('pause', { output })
  // @ts-expect-error Wrong ordinary input cannot widen a known property to bypass checking.
  await selected.setProperty('pause', 1)
  // @ts-expect-error A native-looking object is still ordinary data unless input is explicit.
  await selected.setProperty('pause', { format: 'flag', value: true })
  // @ts-expect-error Native input requires a native value node.
  await selected.setProperty('pause', true, { input: 'native' })
  // @ts-expect-error An unknown output representation is not accepted.
  await selected.getProperty('pause', { output: 'automatic' })
  // @ts-expect-error A raw string node stores bytes, not a decoded string.
  const incorrectText: NativeValue = { format: 'string', value: 'text' }
  // @ts-expect-error Native keys are byte strings in this candidate representation.
  const incorrectMap: NativeValue = { format: 'map', entries: [['key', { format: 'none' }]] }

  void [ordinaryPause, rawPause, conditionalPause, nativePause, snapshotPause, screenshotWidth]
  void [incorrectBoolean, conditionalBoolean, incorrectText, incorrectMap]
}

function inspectObservation(state: PropertyState<NativeValue>) {
  if (state.status === 'available') {
    if (state.value.format === 'none') return 'Available native NONE'
    return state.value.format
  }
  // @ts-expect-error Native unavailability does not invent a reason field.
  return state.reason
}

void compare
void inspectObservation
