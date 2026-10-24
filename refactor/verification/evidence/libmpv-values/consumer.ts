import {
  MpvByteString,
  MpvMapEntries,
  type MpvMap,
  type MpvObject,
  type MpvText,
  type MpvValue,
  type ScreenshotRawResult
} from './contract.js'

declare function consume(value: MpvValue): void
declare const screenshot: ScreenshotRawResult

const nativeString = new MpvByteString(new Uint8Array([0x66, 0x80]))
const nativeBytes = new Uint8Array([0, 0xff])
const entries = new MpvMapEntries([
  ['artist', 'A'],
  ['artist', 'B'],
  [nativeString, nativeBytes]
])

consume(nativeString)
consume(nativeBytes)
consume(entries)
consume({ kind: 'map', entries: [['ordinary', true]] })
consume({ nested: [true, 12n, 1.5, null, entries] })

const width: bigint = screenshot.w
const pixels: Uint8Array = screenshot.data
pixels[0] = 0
void width

function inspectMap(value: MpvMap): MpvValue | undefined {
  if (value instanceof MpvMapEntries) {
    for (const [key, entry] of value.entries) {
      const text: MpvText = key
      if (text instanceof MpvByteString) {
        const copy: Uint8Array = text.toBytes()
        void copy
      }
      consume(entry)
    }
    return undefined
  }
  const record: MpvObject = value
  return record['title']
}
void inspectMap

// @ts-expect-error Native string bytes and binary data have different meanings.
const binary: Uint8Array = nativeString
// @ts-expect-error A byte array cannot silently become a native string.
const text: MpvText = nativeBytes
// @ts-expect-error Runtime value identity cannot be replaced by a matching object shape.
const fakeText: MpvByteString = { toBytes: () => nativeBytes }
// @ts-expect-error A normal map containing an entries field is not an entries value.
const fakeMap: MpvMapEntries = { entries: [] }
// @ts-expect-error Map keys use native string values.
new MpvMapEntries([[42, true]])
// @ts-expect-error Undefined is outside the native value domain.
consume(undefined)
// @ts-expect-error Callbacks are not native values.
consume(() => true)
// @ts-expect-error Arbitrary class instances are not native values.
consume(new Date())
// @ts-expect-error Scalar type does not depend on the current integer magnitude.
const numericWidth: number = screenshot.w
// @ts-expect-error Result structure is readonly.
screenshot.w = 4n
// @ts-expect-error Entries retain readonly tuple and array access.
entries.entries.push(['artist', 'C'])

void [binary, text, fakeText, fakeMap, numericWidth]
