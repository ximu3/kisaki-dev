/** Declaration consumption only; this function is never invoked. */
import { createMpv } from './contract.js'
import type { MpvValue } from '../libmpv-explicit-values/contract.js'
import type { MpvObserver } from '../libmpv-subscriptions/contract.js'
import type { MpvNativeLogRecord } from '../libmpv-notifications/contract.js'

declare const consume: (value: unknown) => void
declare const report: (error: Error) => void
declare const output: 'javascript' | 'native'
declare const nativeObserver: MpvObserver<MpvNativeLogRecord>
declare const unknownName: string
declare const arbitraryValue: MpvValue
declare const signal: AbortSignal

async function checkCreation() {
  const defaults = await createMpv()
  await defaults.close()

  const mpv = await createMpv({
    options: [
      ['pause', true],
      ['volume', 80],
      ['volume', 40],
      [unknownName, arbitraryValue]
    ],
    videoOutput: { width: 1280, height: 720 },
    initializationLogs: {
      observer: {
        next(record) {
          if (record.type === 'log-message') {
            const text: string = record.text
            consume(text)
            // @ts-expect-error Default diagnostic output is text.
            const bytes: Uint8Array<ArrayBuffer> = record.text
            consume(bytes)
          }
        },
        error: report
      }
    },
    signal
  })
  await mpv.close()

  await createMpv({
    input: 'native',
    options: [
      ['pause', { format: 'flag', value: true }],
      [new Uint8Array([0x78]), { format: 'string', value: new Uint8Array([0xff]) }]
    ],
    initializationLogs: {
      output: 'native',
      level: 'terminal-default',
      observer: nativeObserver
    }
  })

  await createMpv({
    initializationLogs: {
      output,
      observer: {
        next(record) {
          if (record.type === 'log-message') {
            const text: string | Uint8Array<ArrayBuffer> = record.text
            consume(text)
          }
        },
        error: report
      }
    }
  })

  await createMpv({
    options: [['pause', true]],
    initializationLogs: {
      output: 'native',
      observer: {
        next(record) {
          if (record.type === 'log-message') {
            const bytes: Uint8Array<ArrayBuffer> = record.text
            consume(bytes)
          }
        },
        error: report
      }
    }
  })

  await createMpv({
    input: 'native',
    options: [['pause', { format: 'flag', value: true }]],
    initializationLogs: {
      observer: {
        next(record) {
          if (record.type === 'log-message') {
            const text: string = record.text
            consume(text)
          }
        },
        error: report
      }
    }
  })

  await createMpv({
    input: 'native',
    initializationLogs: {
      output,
      observer: {
        next(record) {
          if (record.type === 'log-message') {
            const text: string | Uint8Array<ArrayBuffer> = record.text
            consume(text)
            // @ts-expect-error Dynamic log output cannot promise a text-only result.
            const onlyText: string = record.text
            consume(onlyText)
          }
        },
        error: report
      }
    }
  })

  // @ts-expect-error Known boolean options cannot fall through to an unknown-name overload.
  await createMpv({ options: [['pause', 1]] })
  // @ts-expect-error Known floating-point options retain their intended input type.
  await createMpv({ options: [['volume', 80n]] })
  const repeatedOptions = [
    ['pause', true],
    ['pause', 'yes']
  ] as const
  // @ts-expect-error Every ordered entry is checked independently.
  await createMpv({ options: repeatedOptions })
  // @ts-expect-error Native option values require actual nodes.
  await createMpv({ input: 'native', options: [['pause', true]] })
  // @ts-expect-error A native logger requires the actual log output option.
  await createMpv({ initializationLogs: { observer: nativeObserver } })
  // @ts-expect-error An options object is not the ordered option sequence.
  await createMpv({ options: { pause: true } })
  // @ts-expect-error False is not an implicit disable-video policy.
  await createMpv({ videoOutput: false })
  // @ts-expect-error Dynamic log output cannot promise only raw bytes.
  await createMpv({ initializationLogs: { output, observer: nativeObserver } })
}

void checkCreation
