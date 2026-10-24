import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appRoot, buildDirectory } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import type { DesktopBuild, DesktopTarget } from '../../src/shared/runtime-manifest'
import { replaceOutput } from '../lib/output'
import { buildNative } from '../native/build'
import { prepareResources } from '../resources/prepare'
import { runtimeFiles, sourceIdentity } from './identity'
import { buildProgram, programNames } from './programs'

/** Build a complete target from fixed inputs, publishing it only when all programs are ready. */
export async function buildDesktop(target: DesktopTarget): Promise<DesktopBuild> {
  if (target !== hostTarget()) {
    throw new Error('Desktop builds require the matching native target runner')
  }

  const output = buildDirectory(target)
  const manifest: { version: string; devDependencies: { electron: string } } = JSON.parse(
    await readFile(join(appRoot, 'package.json'), 'utf8'),
  )
  return replaceOutput(output, async (staging) => {
    const buildId = await sourceIdentity()
    const resources = await prepareResources(target)
    const native = await buildNative(target)
    await cp(resources, join(staging, 'resources'), { recursive: true })
    await mkdir(join(staging, 'resources', 'native'), { recursive: true })
    for (const file of ['kisaki-native.node', 'native.json']) {
      await copyFile(join(native, file), join(staging, 'resources', 'native', file))
    }

    const results = await Promise.allSettled(
      programNames.map((program) => buildProgram(program, join(staging, program), buildId)),
    )
    const failures = results.filter((result) => result.status === 'rejected')
    if (failures.length) {
      throw new AggregateError(
        failures.map((result) => result.reason),
        'Desktop program compilation failed',
      )
    }

    await writeFile(
      join(staging, 'package.json'),
      JSON.stringify(
        {
          name: '@kisaki3/desktop',
          version: manifest.version,
          type: 'module',
          main: 'main/entry.js',
          desktopName: 'me.kisaki.desktop',
          description: 'A local library for games, anime, comics and novels.',
          author: 'ximu3',
          license: 'AGPL-3.0-only',
        },
        null,
        2,
      ),
    )

    const files = await runtimeFiles(staging)
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
      if (!files[required]) throw new Error(`Desktop build is missing ${required}`)
    }

    const build: DesktopBuild = {
      schemaVersion: 1,
      buildId,
      target,
      version: manifest.version,
      electronVersion: manifest.devDependencies.electron,
      files,
    }
    if ((await sourceIdentity()) !== buildId) {
      throw new Error('Desktop inputs changed during the build; the previous output is retained')
    }

    await writeFile(join(staging, 'build.json'), JSON.stringify(build, null, 2))
    return build
  })
}
