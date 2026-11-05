/** @fileoverview Generates correlated desktop call types from the sole English ICU catalog. */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runCli } from '@kisaki3/tooling/cli'
import { englishMessages } from '../src/en/index'
import { getMessageContracts } from '../src/messages'
import type { MessageCatalog } from '@kisaki3/desktop-contracts/i18n'

/** Render deterministic declarations; a union of complete call tuples preserves key/argument correlation. */
export function renderMessageTypes(source: MessageCatalog): string {
  const contracts = getMessageContracts(source)
  const lines = Object.entries(contracts).map(([key, parameters]) => {
    const fields = Object.entries(parameters)
      .map(
        ([name, kinds]) =>
          `readonly ${JSON.stringify(name)}: ${kinds.map((kind) => (kind === 'date' ? 'Date' : kind)).join(' | ')}`,
      )
      .join('; ')

    return `  readonly ${JSON.stringify(key)}: ${fields ? `{ ${fields} }` : 'never'}`
  })

  return `/** @fileoverview Generated from en/index.ts by generate:messages. Do not edit the call contract independently. */

export interface MessageArguments {
${lines.join('\n')}
}
export type MessageKey = keyof MessageArguments
export type TranslationCall = { [K in MessageKey]: MessageArguments[K] extends never ? [key: K] : [key: K, values: MessageArguments[K]] }[MessageKey]
/** Format one typed message call as plain text; tags are literal. */
export type Translate = (...args: TranslationCall) => string
`
}

/** Reject stale generated declarations without modifying the checked-in source during a normal build. */
export async function checkMessageTypes(): Promise<void> {
  const path = join(import.meta.dirname, '../src/contracts.generated.ts')
  const output = renderMessageTypes(englishMessages)
  if ((await readFile(path, 'utf8')).replaceAll('\r\n', '\n') !== output) {
    throw new Error('Message types are stale; run generate:messages')
  }
}

/** Replace the generated call contract only after the entire English catalog parses consistently. */
export async function writeMessageTypes(signal?: AbortSignal): Promise<void> {
  const output = renderMessageTypes(englishMessages)
  signal?.throwIfAborted()

  await writeFile(join(import.meta.dirname, '../src/contracts.generated.ts'), output)
}

if (import.meta.main) {
  await runCli(writeMessageTypes)
}
