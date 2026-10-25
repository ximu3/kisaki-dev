import { copyFile, cp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DesktopTarget, RuntimeManifest } from '../../src/shared/runtime-manifest'
import { runtimeFiles, sourceIdentity } from '../build/identity'
import { buildProgram } from '../build/programs'
import { prepareResources } from '../resources/prepare'
import { buildNative } from '../native/build'
import { sha256 } from '../lib/sha256'
import { appRoot } from '../lib/paths'
import { withProjectOutputs } from '../../../../../tools/outputs'

/** A compiled development runtime and the source digests used for its Node programs. */
export interface GenerationOutput {
  buildId: string
  inputs: Map<string, string>
}

/**
 * Write a development runtime and return its source digests.
 * The session owns the directory, including cleanup after a failed or superseded build.
 */
export async function buildGeneration(
  target: DesktopTarget,
  directory: string,
): Promise<GenerationOutput> {
  return withProjectOutputs(
    appRoot,
    { write: [join(appRoot, 'out', 'resources', target), join(appRoot, 'out', 'native', target)] },
    async () => {
      const buildId = await sourceIdentity()
      const resources = await prepareResources(target)
      const native = await buildNative(target)

      await cp(resources, join(directory, 'resources'), { recursive: true })
      for (const file of ['kisaki-native.node', 'native.json']) {
        await copyFile(join(native, file), join(directory, 'resources', 'native', file))
      }

      const programs = ['main', 'preload', 'extension-host'] as const
      const results = await Promise.allSettled(
        programs.map((program) =>
          buildProgram(program, join(directory, program), buildId, 'development'),
        ),
      )
      const failures = results.filter((result) => result.status === 'rejected')
      if (failures.length) {
        throw new AggregateError(
          failures.map((result) => result.reason),
          'Development program compilation failed',
        )
      }

      const nextInputs = new Map<string, string>()
      for (const result of results) {
        if (result.status !== 'fulfilled') continue
        for (const path of result.value.modules) {
          nextInputs.set(path, sha256(await readFile(path)))
        }
      }

      await writeFile(join(directory, 'package.json'), '{"type":"module"}\n')
      const manifest: RuntimeManifest = {
        schemaVersion: 1,
        buildId,
        target,
        files: await runtimeFiles(directory),
      }
      await writeFile(join(directory, 'build.json'), JSON.stringify(manifest))

      return { buildId, inputs: nextInputs }
    },
  )
}

/** Report changed or unreadable inputs so the next build can compile or diagnose them. */
export async function programInputsChanged(inputs: ReadonlyMap<string, string>): Promise<boolean> {
  for (const [path, digest] of inputs) {
    try {
      if (sha256(await readFile(path)) !== digest) return true
    } catch {
      return true
    }
  }

  return false
}
