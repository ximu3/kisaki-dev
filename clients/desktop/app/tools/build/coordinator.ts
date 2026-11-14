/**
 * @fileoverview Assembles a finite desktop runtime from complete program, resource and
 * native outputs and records the completed build manifest.
 */

import { randomUUID } from 'node:crypto'
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import electronManifest from 'electron/package.json' with { type: 'json' }
import { appRoot, buildDirectory } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import type { DesktopBuild } from './manifest'
import type { DesktopTarget } from '../lib/targets'
import { removeOutputs } from '@kisaki3/tooling/output'
import { runtimeFiles } from './manifest'
import { buildProgram, programNames } from './programs'

/**
 * Assembles a complete desktop runtime from prepared resources and native bindings.
 *
 * Requires the target's own runner. Waits for all program compilers, verifies required outputs and
 * the completed file set, then writes and returns the build manifest. Failed or cancelled
 * builds are not consumable.
 */
export async function buildDesktop(
  sourceRoot: string,
  target: DesktopTarget,
  signal?: AbortSignal,
): Promise<DesktopBuild> {
  if (target !== hostTarget()) {
    throw new Error('Desktop builds require the matching native target runner')
  }

  const output = buildDirectory(target)

  await removeOutputs(appRoot, [output], signal)
  await mkdir(output, { recursive: true })

  const buildId = randomUUID()
  const manifest = JSON.parse(await readFile(join(appRoot, 'package.json'), 'utf8')) as {
    name: string
    version: string
    type: string
    description: string
    homepage: string
    author: { name: string; email: string }
    license: string
  }

  const resources = join(appRoot, 'out', 'resources', target)
  const native = join(appRoot, 'out', 'native', target)

  await cp(resources, join(output, 'resources'), { recursive: true })
  await mkdir(join(output, 'resources', 'native'), { recursive: true })
  await copyFile(
    join(native, 'kisaki-native.node'),
    join(output, 'resources', 'native', 'kisaki-native.node'),
  )

  // Wait for every compiler before reporting completion or failure.
  const results = await Promise.allSettled(
    programNames.map((program) =>
      buildProgram(sourceRoot, program, join(output, program), buildId),
    ),
  )
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length) {
    throw new AggregateError(
      failures.map((result): unknown => result.reason),
      'Desktop program compilation failed',
    )
  }

  await writeFile(
    join(output, 'package.json'),
    JSON.stringify(
      {
        name: manifest.name,
        version: manifest.version,
        type: manifest.type,
        main: 'main/entry.js',
        desktopName: 'me.kisaki.desktop',
        description: manifest.description,
        homepage: manifest.homepage,
        author: manifest.author,
        license: manifest.license,
      },
      null,
      2,
    ),
  )

  const files = await runtimeFiles(output)
  for (const required of [
    'main/entry.js',
    'extension-host/entry.js',
    'preload/main.cjs',
    'preload/reader.cjs',
    'preload/player.cjs',
    'preload/game-panel.cjs',
    'renderer/main/index.html',
    'renderer/reader/index.html',
    'renderer/player/index.html',
    'renderer/game-panel/index.html',
    'resources/native/kisaki-native.node',
    'resources/native/better-sqlite3.node',
  ]) {
    if (!files[required]) {
      throw new Error(`Desktop build is missing ${required}`)
    }
  }

  const build: DesktopBuild = {
    schemaVersion: 1,
    buildId,
    target,
    version: manifest.version,
    electronVersion: electronManifest.version,
    files,
  }
  signal?.throwIfAborted()

  await writeFile(join(output, 'build.json'), JSON.stringify(build, null, 2))

  return build
}
