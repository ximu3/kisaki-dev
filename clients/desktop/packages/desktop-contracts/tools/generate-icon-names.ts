/** @fileoverview Generates the pure host icon-name catalog from the pinned Lucide distribution. */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { lucideIconNames } from '@lucide/icons/dynamic'
import { runCli } from '@kisaki3/tooling/cli'

const destination = join(import.meta.dirname, '../src/ui/icons/names.generated.ts')

/** Renders a deterministic name catalog and its derived type without importing icon geometry at runtime. */
export function renderIconNames(): string {
  const names = lucideIconNames.toSorted().map((name) => `  ${JSON.stringify(name)},`)

  return `/** @fileoverview Generated from the pinned @lucide/icons catalog by generate:icon-names. */

/** Names supported by the host's fixed Lucide catalog, including its published aliases. */
export const lucideIconNames = Object.freeze([
${names.join('\n')}
] as const)

/** Icon name supported by the host's fixed Lucide catalog. */
export type LucideIconName = (typeof lucideIconNames)[number]
`
}

/** Checks that the tracked catalog matches the pinned upstream names before package construction. */
export async function checkIconNames(): Promise<void> {
  if ((await readFile(destination, 'utf8')) !== renderIconNames()) {
    throw new Error(
      'Lucide icon names are stale. Run pnpm generate:icon-names in desktop-contracts.',
    )
  }
}

/** Writes the complete name catalog from the pinned upstream distribution. */
export async function writeIconNames(signal?: AbortSignal): Promise<void> {
  const output = renderIconNames()
  signal?.throwIfAborted()
  await writeFile(destination, output)
}

if (import.meta.main) {
  await runCli(writeIconNames)
}
