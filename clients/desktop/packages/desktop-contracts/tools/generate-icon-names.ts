import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { icons } from '@iconify-json/mdi'
import { runCli } from '@kisaki3/tooling/cli'

const destination = join(import.meta.dirname, '../src/ui/icons/names.generated.ts')

export function renderIconNames(): string {
  const names = [...Object.keys(icons.icons), ...Object.keys(icons.aliases ?? {})]
    .sort()
    .map((name) => `  ${JSON.stringify(name)},`)

  return `// Generated from the pinned @iconify-json/mdi catalog by generate:icon-names.

export const mdiIconNames = Object.freeze([
${names.join('\n')}
] as const)

export type MdiIconName = (typeof mdiIconNames)[number]
`
}

export async function checkIconNames(): Promise<void> {
  if ((await readFile(destination, 'utf8')) !== renderIconNames()) {
    throw new Error(
      'MDI icon names are stale. Run pnpm exec vp run @kisaki3/desktop-contracts#generate:icon-names.',
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
