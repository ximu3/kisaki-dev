import {
  MpvConversionError,
  type MpvNode,
  type MpvValue,
  type MpvValueCalls,
  type PropertyState,
  type ValueRepresentation
} from './contract.js'

declare const mpv: MpvValueCalls
declare const output: ValueRepresentation
declare function consume(value: MpvValue): void

const commandNode = {
  format: 'array',
  value: [{ format: 'string', value: new TextEncoder().encode('screenshot-raw') }]
} as const satisfies MpvNode

const duplicates = {
  format: 'map',
  value: [
    [new Uint8Array([0x61]), { format: 'int64', value: 1n }],
    [new Uint8Array([0x61]), { format: 'int64', value: 2n }]
  ]
} as const satisfies MpvNode

async function consumeCalls() {
  const ordinary: boolean = await mpv.getProperty('pause')
  const raw: MpvNode = await mpv.getProperty('pause', { output: 'native' })
  const conditional: boolean | MpvNode = await mpv.getProperty('pause', { output })
  const byteName = new Uint8Array([...new TextEncoder().encode('user-data/'), 0x80])
  const namedRaw: MpvNode = await mpv.getProperty(byteName, { output: 'native' })
  await mpv.setProperty(byteName, true)
  if (raw.format === 'flag') {
    const actual: boolean = raw.value
    void actual
  }

  await mpv.setProperty('pause', true)
  await mpv.setProperty('user-data/value', duplicates, { input: 'native' })
  await mpv.setProperty('user-data/value', { format: 'string', value: [1n] })
  consume(Buffer.from([1, 2]))

  const ordinaryResult: MpvValue = await mpv.command(['screenshot-raw'])
  const rawResult: MpvNode = await mpv.command(['screenshot-raw'], { output: 'native' })
  const rawInputOrdinaryResult: MpvValue = await mpv.command(commandNode, { input: 'native' })
  const rawInputRawResult: MpvNode = await mpv.command(commandNode, {
    input: 'native',
    output: 'native'
  })

  // @ts-expect-error Native output requires inspection of its actual format.
  const assumedValue = raw.value
  // @ts-expect-error A native reply is not the decoded property value.
  const assumedBoolean: boolean = raw
  // @ts-expect-error A dynamic representation cannot be treated as a fixed one.
  const conditionalBoolean: boolean = await mpv.getProperty('pause', { output })
  // @ts-expect-error A normal parameter error cannot widen a known property.
  await mpv.setProperty('pause', 1)
  // @ts-expect-error Primitive JavaScript input is not a native node.
  await mpv.setProperty('pause', true, { input: 'native' })
  // @ts-expect-error A read has no input-value representation selector.
  await mpv.getProperty('pause', { input: 'native' })
  // @ts-expect-error A write has no output-value representation selector.
  await mpv.setProperty('pause', true, { output: 'native' })
  // @ts-expect-error A raw command root requires explicit input selection.
  await mpv.command(commandNode)
  // @ts-expect-error Native command input has an array or map root.
  await mpv.command({ format: 'flag', value: true }, { input: 'native' })
  // @ts-expect-error Positional JavaScript input does not become a native node automatically.
  await mpv.command(['screenshot-raw'], { input: 'native' })
  // @ts-expect-error A byte name does not imply a known property or a native output selector.
  const assumedNamedBoolean: boolean = await mpv.getProperty(byteName)
  // @ts-expect-error A type argument cannot select a representation absent at runtime.
  const forcedRaw: MpvNode = await mpv.getProperty<'pause', 'native'>('pause')
  // @ts-expect-error Command result representation must also come from actual options.
  const forcedCommand: MpvNode = await mpv.command<'native'>(['screenshot-raw'])

  void [
    ordinary,
    conditional,
    namedRaw,
    ordinaryResult,
    rawResult,
    rawInputOrdinaryResult,
    rawInputRawResult
  ]
  void [
    assumedValue,
    assumedBoolean,
    conditionalBoolean,
    assumedNamedBoolean,
    forcedRaw,
    forcedCommand
  ]
}

function inspectFailure(error: unknown): MpvNode | undefined {
  if (error instanceof MpvConversionError) {
    const source: 'binding' = error.source
    const reason: 'invalidUtf8' | 'duplicateMapKey' | 'unexpectedShape' = error.reason
    void [source, reason]
    return error.getNativeValue()
  }
  return undefined
}

function inspectState(state: PropertyState<MpvNode>) {
  if (state.status === 'available' && state.value.format === 'none') return 'Available NONE'
  if (state.status === 'unavailable') {
    // @ts-expect-error The native unavailable notification has no reason code.
    return state.reason
  }
  return state.value.format
}

// @ts-expect-error Raw string contents are bytes.
const invalidText: MpvNode = { format: 'string', value: 'text' }
// @ts-expect-error Int64 is represented by bigint regardless of magnitude.
const invalidInteger: MpvNode = { format: 'int64', value: 1 }
// @ts-expect-error NONE has no artificial payload field.
const invalidNone: MpvNode = { format: 'none', value: null }
// @ts-expect-error Native map keys are byte strings.
const invalidKey: MpvNode = { format: 'map', value: [['key', { format: 'none' }]] }
// @ts-expect-error Shared buffers require an explicit stable copy by the caller.
consume(new Uint8Array(new SharedArrayBuffer(2)))

void [
  consumeCalls,
  inspectFailure,
  inspectState,
  invalidText,
  invalidInteger,
  invalidNone,
  invalidKey
]
