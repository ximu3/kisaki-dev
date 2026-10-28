/** @fileoverview Verifies that repeated preload builds consume the current Vite entry configuration. */

import { expect, test, vi } from 'vitest'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildProgram } from '../../../tools/build/programs'

const paths = vi.hoisted(() => ({ appRoot: '' }))
// Relocate owned inputs while retaining Vite's actual configuration loader and compiler.
vi.mock('../../../tools/lib/paths', () => paths)

test('preload entry changes take effect in a later build within the same process', async () => {
  paths.appRoot = await mkdtemp(join(tmpdir(), 'kisaki-preload-config-'))
  try {
    await mkdir(join(paths.appRoot, 'src/preload'), { recursive: true })
    await mkdir(join(paths.appRoot, 'config/vite'), { recursive: true })
    const entries = Object.fromEntries(
      ['main', 'reader', 'player', 'game-panel'].map((name) => [name, `src/preload/${name}.ts`]),
    )
    for (const [name, entry] of Object.entries(entries)) {
      await writeFile(join(paths.appRoot, entry), `export const value = '${name}'\n`)
    }
    await writeFile(
      join(paths.appRoot, 'src/preload/changed.ts'),
      "export const value = 'changed'\n",
    )
    const configuration = join(paths.appRoot, 'config/vite/vite.config.preload.ts')
    const config = {
      build: {
        minify: false,
        lib: { entry: entries, formats: ['cjs'] },
        rolldownOptions: { output: { codeSplitting: false } },
      },
    }
    await writeFile(configuration, `export default ${JSON.stringify(config)}\n`)

    const first = join(paths.appRoot, 'out/first')
    await buildProgram('preload', first, 'first')
    const require = createRequire(join(paths.appRoot, 'package.json'))
    expect(require(join(first, 'main.cjs')).value).toBe('main')

    entries.main = 'src/preload/changed.ts'
    await writeFile(configuration, `export default ${JSON.stringify(config)}\n`)
    const second = join(paths.appRoot, 'out/second')
    await buildProgram('preload', second, 'second')

    expect(require(join(second, 'main.cjs')).value).toBe('changed')
    for (const name of ['reader', 'player', 'game-panel']) {
      expect(require(join(second, `${name}.cjs`)).value).toBe(name)
    }
  } finally {
    await rm(paths.appRoot, { recursive: true, force: true })
  }
})
