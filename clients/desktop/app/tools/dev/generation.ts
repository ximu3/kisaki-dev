/**
 * @fileoverview Builds private main, preload and extension-host generations and records
 * their compiler inputs.
 */

import { copyFile, cp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DesktopTarget, RuntimeManifest } from '../lib/runtime-manifest'
import { runtimeFiles, buildInputIdentity } from '../build/identity'
import { buildProgram } from '../build/programs'
import { prepareResources } from '../resources/prepare'
import { buildNative } from '../native/build'
import { sha256 } from '../lib/sha256'
import { appRoot } from '../lib/paths'

/** Build identity and source-file digests for one compiled development generation. */
export interface GenerationOutput {
  buildId: string
  inputs: Map<string, string>
}

/**
 * Builds a development runtime from programs, resources and native bindings.
 *
 * Writes into the supplied session-owned directory and returns its input digests. Waits for all
 * compilers before rejecting; the session owns adoption and cleanup of failed or superseded
 * generations.
 */
export async function buildGeneration(
  sourceRoot: string,
  target: DesktopTarget,
  directory: string,
  signal?: AbortSignal,
): Promise<GenerationOutput> {
  signal?.throwIfAborted()

  const buildId = await buildInputIdentity({ signal })
  const resources = await prepareResources(target, signal)
  const native = await buildNative(target, false, signal)

  await cp(resources, join(directory, 'resources'), { recursive: true })
  for (const file of ['kisaki-native.node', 'native.json']) {
    await copyFile(join(native, file), join(directory, 'resources', 'native', file))
  }

  const programs = ['main', 'preload', 'extension-host'] as const
  const results = await Promise.allSettled(
    programs.map((program) =>
      buildProgram(sourceRoot, program, join(directory, program), buildId, 'development'),
    ),
  )
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length) {
    throw new AggregateError(
      failures.map((result): unknown => result.reason),
      'Development program compilation failed',
    )
  }

  const nextInputs = new Map<string, string>()
  for (const result of results) {
    if (result.status !== 'fulfilled') {
      continue
    }

    for (const path of result.value.modules) {
      nextInputs.set(path, sha256(await readFile(path)))
    }
  }

  await writeFile(join(directory, 'package.json'), '{"type":"module"}\n')
  const manifest: RuntimeManifest = {
    schemaVersion: 1,
    buildId,
    version: (
      JSON.parse(await readFile(join(appRoot, 'package.json'), 'utf8')) as { version: string }
    ).version,
    target,
    files: await runtimeFiles(directory),
  }
  await writeFile(join(directory, 'build.json'), JSON.stringify(manifest))

  return { buildId, inputs: nextInputs }
}

/** Reports whether a recorded source file has changed or become unreadable. */
export async function programInputsChanged(inputs: ReadonlyMap<string, string>): Promise<boolean> {
  for (const [path, digest] of inputs) {
    try {
      if (sha256(await readFile(path)) !== digest) {
        return true
      }
    } catch {
      return true
    }
  }

  return false
}
