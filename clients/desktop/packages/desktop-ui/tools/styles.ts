import { readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCli } from '@kisaki3/tooling/cli'

export async function assembleStyles(signal?: AbortSignal): Promise<void> {
  const project = join(import.meta.dirname, '..')
  const outDir = join(project, 'dist')
  signal?.throwIfAborted()
  const [base, appearance, components] = await Promise.all([
    readFile(join(project, 'src/styles.css'), 'utf8'),
    readFile(fileURLToPath(import.meta.resolve('@kisaki3/desktop-appearance/styles.css')), 'utf8'),
    readFile(join(outDir, 'components.css'), 'utf8'),
  ])
  const styles = base.replace("@import '@kisaki3/desktop-appearance/styles.css';", () => appearance)
  await writeFile(join(outDir, 'styles.css'), styles + '\n' + components)
  await rm(join(outDir, 'components.css'))

  const directory = dirname(fileURLToPath(import.meta.resolve('@unovis/ts')))
  const { version } = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
    version: string
  }
  const license = await readFile(join(directory, 'LICENSE'), 'utf8')
  await writeFile(
    join(outDir, 'THIRD-PARTY-NOTICES.txt'),
    `@unovis/ts ${version} — bundled declarations\n\n${license}`,
  )

  signal?.throwIfAborted()
}

if (import.meta.main) {
  await runCli(assembleStyles)
}
