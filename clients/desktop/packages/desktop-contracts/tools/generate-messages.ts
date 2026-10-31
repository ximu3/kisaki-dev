/** @fileoverview Generates the public native message-call types from the actual English ICU catalog. */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runCli } from '@kisaki3/tooling/cli'
import { parseArgs } from 'node:util'
import { format, resolveConfig } from 'prettier'
import { compileMessageContract, renderMessageDeclarations } from '../src/i18n/catalog'
import { englishMessages } from '../src/i18n/english'

/** Replace the generated source after the entire English catalog has compiled successfully. */
export async function generateMessages(check = false): Promise<void> {
  const destination = fileURLToPath(new URL('../src/i18n/messages.generated.ts', import.meta.url))
  const declarations = await format(
    renderMessageDeclarations(compileMessageContract(englishMessages)),
    { ...(await resolveConfig(destination)), filepath: destination },
  )
  if (check) {
    if ((await readFile(destination, 'utf8')) !== declarations) {
      throw new Error('Message declarations are stale. Run pnpm generate:messages.')
    }
    return
  }
  await writeFile(destination, declarations)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } })
  await runCli(() => generateMessages(values.check))
}
