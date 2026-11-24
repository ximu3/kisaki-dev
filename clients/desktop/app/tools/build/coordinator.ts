import { randomUUID } from 'node:crypto'
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import electronManifest from 'electron/package.json' with { type: 'json' }
import { removeOutputs } from '@kisaki3/tooling/output'
import { appRoot, buildDirectory } from '../lib/paths'
import { hostTarget, type DesktopTarget } from '../lib/targets'
import { runtimeFiles, type DesktopBuild } from './manifest'
import { buildProgram, sourcePrograms } from './programs'

export async function buildDesktop(
  sourceRoot: string,
  target: DesktopTarget,
  signal?: AbortSignal,
): Promise<DesktopBuild> {
  if (target !== hostTarget()) {
    throw new Error('Desktop builds require the matching native target runner')
  }

  const programs = sourcePrograms(sourceRoot)
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

  // On failure, the output stays owned until every compiler has finished writing.
  const results = await Promise.allSettled(
    programs.map((program) => buildProgram(sourceRoot, program, join(output, program), buildId)),
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
    'main/database.js',
    ...(programs.includes('extension-host') ? ['extension-host/entry.js'] : []),
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
