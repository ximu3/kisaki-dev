/**
 * @fileoverview Verifies that Node program builds resolve package entries and retain
 * external runtime built-ins.
 */

import { expect, test } from 'vitest'
import { build, normalizePath } from 'vite'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { programConfig } from '../../../tools/build/programs'

test.each(['main', 'extension-host'] as const)(
  '%s bundles Node package entries and leaves runtime built-ins external',
  async (program) => {
    const directory = await mkdtemp(join(tmpdir(), 'kisaki-node-build-'))
    try {
      const conditional = join(directory, 'node_modules', 'conditional-fixture')
      const legacy = join(directory, 'node_modules', 'legacy-fixture')
      for (const root of [conditional, legacy]) {
        await mkdir(root, { recursive: true })
        await writeFile(join(root, 'node.js'), "export const value = 'node'\n")
        await writeFile(join(root, 'browser.js'), "export const value = 'browser'\n")
      }
      await writeFile(
        join(conditional, 'package.json'),
        JSON.stringify({
          name: 'conditional-fixture',
          type: 'module',
          exports: { '.': { browser: './browser.js', node: './node.js' } },
        }),
      )
      await writeFile(
        join(legacy, 'package.json'),
        JSON.stringify({
          name: 'legacy-fixture',
          type: 'module',
          main: './node.js',
          browser: './browser.js',
        }),
      )
      const entry = join(directory, 'entry.ts')
      await writeFile(
        entry,
        [
          "export { value as conditional } from 'conditional-fixture'",
          "export { value as legacy } from 'legacy-fixture'",
          "export { readFile } from 'node:fs'",
          "export { sep } from 'path'",
        ].join('\n'),
      )

      const config = programConfig(program, join(directory, 'output'), 'fixture', 'production')
      const result = await build({
        ...config,
        logLevel: 'silent',
        build: { ...config.build, write: false, lib: { entry } },
      })
      const chunks = (Array.isArray(result) ? result : [result]).flatMap((bundle) => {
        if (!('output' in bundle)) throw new Error('Expected a finite build')
        return bundle.output.filter((output) => output.type === 'chunk')
      })
      const inputs = chunks.flatMap((chunk) => Object.keys(chunk.modules).map(normalizePath))
      const imports = chunks.flatMap((chunk) => chunk.imports)

      for (const root of [conditional, legacy]) {
        expect(inputs).toContain(normalizePath(join(root, 'node.js')))
        expect(inputs).not.toContain(normalizePath(join(root, 'browser.js')))
      }
      expect(imports).toContain('node:fs')
      expect(imports).toContain('path')
      expect(imports).not.toContain('conditional-fixture')
      expect(imports).not.toContain('legacy-fixture')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
)
