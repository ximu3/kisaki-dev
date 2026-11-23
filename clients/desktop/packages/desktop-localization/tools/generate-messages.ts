import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runCli } from '@kisaki3/tooling/cli'
import { englishMessages } from '../src/en/index'
import { getMessageContracts, type MessageArgumentKind } from '../src/messages'
import type { MessageCatalog } from '@kisaki3/desktop-contracts/i18n'

const argumentTypes: Record<MessageArgumentKind, string> = {
  string: 'string',
  number: 'number',
  timestamp: 'number',
  date: 'Date',
}

/**
 * Renders deterministic declarations from source ICU argument contracts.
 *
 * Complete key/argument tuples preserve the correlation required for each translation call.
 */
export function renderMessageTypes(source: MessageCatalog): string {
  const contracts = getMessageContracts(source)
  const lines = Object.entries(contracts).map(([key, parameters]) => {
    const fields = Object.entries(parameters)
      .map(
        ([name, kinds]) =>
          `readonly ${JSON.stringify(name)}: ${kinds.map((kind) => argumentTypes[kind]).join(' | ')}`,
      )
      .join('; ')

    return `  readonly ${JSON.stringify(key)}: ${fields ? `{ ${fields} }` : 'never'}`
  })

  return `/** @fileoverview Generated from en/index.ts by generate:messages. Do not edit the call contract independently. */

/** Argument objects keyed by English messages; argument-free calls use the never type. */
export interface MessageArguments {
${lines.join('\n')}
}

/** Key of one message in the English authoring baseline. */
export type MessageKey = keyof MessageArguments

/** Keys that need no argument object, including dynamically selected labels. */
type PlainMessageKey = { [K in MessageKey]: MessageArguments[K] extends never ? K : never }[MessageKey]

/** Correlated key and argument tuples for one complete translation call. */
export type TranslationCall = [key: PlainMessageKey] | { [K in Exclude<MessageKey, PlainMessageKey>]: [key: K, values: MessageArguments[K]] }[Exclude<MessageKey, PlainMessageKey>]

/** Typed message formatter returning plain text with literal markup. */
export type Translate = (...args: TranslationCall) => string
`
}

/**
 * Checks the tracked generated declarations against the English catalog.
 *
 * Stale output rejects the build; this check leaves the source file unchanged.
 */
export async function checkMessageTypes(): Promise<void> {
  const path = join(import.meta.dirname, '../src/contracts.generated.ts')
  const output = renderMessageTypes(englishMessages)
  if ((await readFile(path, 'utf8')).replaceAll('\r\n', '\n') !== output) {
    throw new Error(
      'Message types are stale. Run pnpm exec vp run @kisaki3/desktop-localization#generate:messages.',
    )
  }
}

/**
 * Regenerates the call contract after the complete English catalog has been validated.
 *
 * Checks cancellation before writing the generated source.
 */
export async function writeMessageTypes(signal?: AbortSignal): Promise<void> {
  const output = renderMessageTypes(englishMessages)
  signal?.throwIfAborted()

  await writeFile(join(import.meta.dirname, '../src/contracts.generated.ts'), output)
}

if (import.meta.main) {
  await runCli(process.argv.includes('--check') ? checkMessageTypes : writeMessageTypes)
}
