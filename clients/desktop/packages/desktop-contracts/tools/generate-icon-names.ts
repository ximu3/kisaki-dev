import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { lucideIconNames } from '@lucide/icons/dynamic'
import { runCli } from '@kisaki3/tooling/cli'

const destination = join(import.meta.dirname, '../src/ui/icons/names.generated.ts')

export function renderIconNames(): string {
  const names = lucideIconNames.toSorted().map((name) => `  ${JSON.stringify(name)},`)

  return `// Generated from the pinned @lucide/icons catalog by generate:icon-names.

export const lucideIconNames = Object.freeze([
${names.join('\n')}
] as const)

export type LucideIconName = (typeof lucideIconNames)[number]
`
}

export async function checkIconNames(): Promise<void> {
  if ((await readFile(destination, 'utf8')) !== renderIconNames()) {
    throw new Error(
      'Lucide icon names are stale. Run pnpm exec vp run @kisaki3/desktop-contracts#generate:icon-names.',
    )
  }
}

export async function writeIconNames(signal?: AbortSignal): Promise<void> {
  const output = renderIconNames()
  signal?.throwIfAborted()
  await writeFile(destination, output)
}

if (import.meta.main) {
  await runCli(process.argv.includes('--check') ? checkIconNames : writeIconNames)
}
