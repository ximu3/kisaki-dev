/**
 * @fileoverview Builds Solid components, declarations and compiled utility styles before
 * adopting the complete UI package output.
 */

import { build, type TsdownBundle } from 'tsdown'
import { readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { findPackageJSON } from 'node:module'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { replaceOutput } from '@kisaki3/tooling/output'
import { runCli } from '@kisaki3/tooling/cli'
import { runPnpm } from '@kisaki3/tooling/process'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Preserve the installed notices for declarations and CSS actually copied into this package. */
async function writeThirdPartyNotices(
  bundles: readonly TsdownBundle[],
  output: string,
): Promise<void> {
  const manifests = new Set<string>()
  for (const bundle of bundles) {
    for (const chunk of bundle.chunks) {
      if (chunk.type !== 'chunk') {
        continue
      }
      for (const id of chunk.moduleIds) {
        if (!isAbsolute(id) || !id.split(/[\\/]/).includes('node_modules')) {
          continue
        }
        const manifest = findPackageJSON(pathToFileURL(id))
        if (!manifest) {
          throw new Error(`Bundled dependency has no package manifest: ${id}`)
        }
        manifests.add(await realpath(manifest))
      }
    }
  }

  // Tailwind's theme and utility CSS are compiled by its CLI, outside the JavaScript bundle report.
  const tailwind = findPackageJSON('tailwindcss', import.meta.url)
  if (!tailwind) {
    throw new Error('Tailwind package manifest is unavailable')
  }
  manifests.add(await realpath(tailwind))

  const sections: { name: string; text: string }[] = []
  for (const manifest of manifests) {
    const { name, version } = JSON.parse(await readFile(manifest, 'utf8')) as {
      name: string
      version: string
    }
    const directory = dirname(manifest)
    const files = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /^(licen[cs]e|notice)(?:\.|$)/i.test(entry.name))
      .map((entry) => entry.name)
      .sort()
    if (files.length === 0) {
      throw new Error(`Bundled dependency has no license or notice text: ${name}`)
    }
    const notices = await Promise.all(
      files.map(async (file) => `${file}\n\n${await readFile(join(directory, file), 'utf8')}`),
    )
    sections.push({ name: `${name}@${version}`, text: notices.join('\n\n') })
  }

  sections.sort((left, right) => left.name.localeCompare(right.name, 'en'))
  await writeFile(
    join(output, 'THIRD_PARTY_NOTICES.txt'),
    [
      'Third-party declaration and CSS sources included in @kisaki3/ui.\nOriginal notices are reproduced below.',
      ...sections.map(
        (section) => `${section.name}\n${'='.repeat(section.name.length)}\n\n${section.text}`,
      ),
    ].join('\n\n'),
  )
}

/** Build complete code, declarations and styles before replacing the package output. */
export async function buildPackage(signal?: AbortSignal): Promise<void> {
  await replaceOutput(
    root,
    'dist',
    async (candidate) => {
      const result = await build({
        config: join(root, 'tsdown.config.ts'),
        outDir: candidate,
        clean: true,
      })

      await runPnpm(
        [
          'exec',
          'tailwindcss',
          '-i',
          'src/styles.css',
          '-o',
          join(candidate, 'styles.css'),
          '--minify',
        ],
        { cwd: root, signal },
      )

      await writeThirdPartyNotices(result.bundles, candidate)
    },
    signal,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli((signal) => buildPackage(signal))
}
