/** @fileoverview Records and checks the prepared desktop build across CI packaging. */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { runCli } from '@kisaki3/tooling/cli'
import type { DesktopBuild, DesktopTarget } from '../../src/shared/runtime-manifest'
import { appRoot, buildDirectory, repositoryRoot } from '../../tools/lib/paths'
import { parseTarget } from '../../tools/lib/targets'
import { sha256 } from '../../tools/lib/sha256'
import type { ArtifactReceipt } from '../../tools/package/packager'

/** The input identity, bytes and modification time observed for a prepared build manifest. */
interface BuildManifestState {
  buildId: string
  manifestSha256: string
  /** Manifest modification time in milliseconds since the Unix epoch. */
  mtimeMs: number
}

/** Read the target manifest's identity, bytes and modification time without changing its output. */
async function readManifestState(target: DesktopTarget): Promise<BuildManifestState> {
  const manifestPath = join(buildDirectory(target), 'build.json')
  const bytes = await readFile(manifestPath)
  const manifest: DesktopBuild = JSON.parse(bytes.toString('utf8'))
  const attributes = await stat(manifestPath)

  return {
    buildId: manifest.buildId,
    manifestSha256: sha256(bytes),
    mtimeMs: attributes.mtimeMs,
  }
}

await runCli(async () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { target: { type: 'string' } },
  })
  const operation = positionals[0]
  if (
    positionals.length !== 1 ||
    (operation !== 'record' && operation !== 'check') ||
    !values.target
  ) {
    throw new Error('Usage: build-reuse <record|check> --target <desktop-target>')
  }

  const target = parseTarget(values.target)
  const reportDirectory = join(repositoryRoot, 'test-results', 'verification')
  const recordPath = join(reportDirectory, 'tested-build.json')
  const currentBuild = await readManifestState(target)

  if (operation === 'record') {
    await mkdir(reportDirectory, { recursive: true })
    await writeFile(recordPath, JSON.stringify(currentBuild, null, 2))
    return
  }

  const testedBuild: BuildManifestState = JSON.parse(await readFile(recordPath, 'utf8'))
  const packagedArtifacts: ArtifactReceipt = JSON.parse(
    await readFile(join(appRoot, 'dist', target, 'artifacts.json'), 'utf8'),
  )
  if (
    testedBuild.manifestSha256 !== currentBuild.manifestSha256 ||
    testedBuild.mtimeMs !== currentBuild.mtimeMs ||
    testedBuild.buildId !== packagedArtifacts.buildId
  ) {
    throw new Error('The tested build was replaced or not packaged')
  }

  await writeFile(
    join(reportDirectory, 'build-reuse.json'),
    JSON.stringify(
      { ...testedBuild, reused: true, candidateFiles: packagedArtifacts.files.length },
      null,
      2,
    ),
  )
})
