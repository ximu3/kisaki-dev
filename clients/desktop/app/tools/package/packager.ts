/**
 * @fileoverview Verifies a prepared desktop runtime, packages its target carriers and
 * records the resulting artifact identities.
 */

import { copyFile, cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseDocument } from 'yaml'
import { appRoot, buildDirectory, repositoryRoot } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import { runtimeFiles, buildInputIdentity } from '../build/identity'
import type { DesktopBuild, DesktopTarget } from '../../src/shared/runtime-manifest'
import type { DistributionKind, DistributionManifest } from '../../src/shared/distribution'
import { sha256 } from '../lib/sha256'
import { replaceOutput } from '@kisaki3/tooling/output'
import { runPnpm } from '@kisaki3/tooling/process'

/** Identifies the candidate files by their desktop build and SHA-256 digests. */
export interface ArtifactReceipt {
  target: DesktopTarget
  version: string
  buildId: string
  testOnly: boolean
  /** File names relative to the directory containing this receipt. */
  files: { path: string; sha256: string }[]
}

interface PackagingContext {
  build: DesktopBuild
  staging: string
  output: string
  testOnly: boolean
}

/**
 * Package the prepared host target, returning the completed artifact receipt path.
 * Adopt the output after all formats and the receipt are written, then release the staging files.
 */
export async function packageDesktop(
  target: DesktopTarget,
  testOnly = false,
  signal?: AbortSignal,
): Promise<string> {
  if (target !== hostTarget()) throw new Error('Package on the corresponding native target runner')

  const runtime = buildDirectory(target)
  const desktop: DesktopBuild = JSON.parse(await readFile(join(runtime, 'build.json'), 'utf8'))
  if (
    desktop.schemaVersion !== 1 ||
    desktop.target !== target ||
    desktop.buildId !== (await buildInputIdentity({ signal }))
  ) {
    throw new Error('Desktop packaging requires a build matching the current target and inputs')
  }
  const actual = await runtimeFiles(runtime)
  if (Object.keys(actual).length !== Object.keys(desktop.files).length) {
    throw new Error('Desktop runtime file set changed before packaging')
  }
  for (const [file, digest] of Object.entries(desktop.files)) {
    if (actual[file] !== digest) {
      throw new Error(`Desktop build changed before packaging: ${file}`)
    }
  }

  const output = join(appRoot, 'dist', target)
  const staging = await mkdtemp(join(appRoot, 'out', 'package-'))
  try {
    await cp(runtime, staging, { recursive: true })
    await copyFile(join(repositoryRoot, 'LICENSE'), join(staging, 'LICENSE'))

    await replaceOutput(
      appRoot,
      output,
      async (candidate) => {
        const context = { build: desktop, staging, output: candidate, testOnly }
        const configPath = await writeBuilderConfig(context)

        if (target.startsWith('windows-')) {
          await packageCarrier(context, configPath, 'zip', '--win', ['zip'], signal)
          await packageCarrier(context, configPath, 'nsis', '--win', ['nsis'], signal)
        } else if (target.startsWith('macos-')) {
          await packageCarrier(context, configPath, 'app', '--mac', ['dmg', 'zip'], signal)
        } else {
          await packageCarrier(context, configPath, 'deb', '--linux', ['deb'], signal)
          await packageCarrier(context, configPath, 'rpm', '--linux', ['rpm'], signal)
          await packageCarrier(context, configPath, 'appimage', '--linux', ['AppImage'], signal)
        }

        await writeArtifactReceipt(context)
      },
      signal,
    )

    return join(output, 'artifacts.json')
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

/** Write the target's builder configuration, including resources and signing requirements. */
async function writeBuilderConfig(context: PackagingContext): Promise<string> {
  const { build, staging, output, testOnly } = context
  const config = parseDocument(await readFile(join(appRoot, 'electron-builder.yml'), 'utf8'))

  config.set('electronVersion', build.electronVersion)
  config.set('directories', {
    app: staging,
    output,
    buildResources: join(appRoot, 'packaging'),
  })
  config.set('extraResources', [{ from: join(staging, 'resources'), to: 'resources' }])
  config.setIn(['win', 'icon'], join(staging, 'resources', 'icons', 'icon.ico'))
  config.setIn(['mac', 'icon'], join(staging, 'resources', 'icons', 'icon.png'))
  config.setIn(['linux', 'icon'], join(staging, 'resources', 'icons', 'icon.png'))
  config.set('artifactName', `Kisaki-${build.version}-${build.target}.\${ext}`)

  if (testOnly) {
    config.setIn(['mac', 'identity'], null)
    config.setIn(['mac', 'forceCodeSigning'], false)
  } else if (build.target.startsWith('macos-')) {
    const identity = process.env.KISAKI_MAC_SIGNING_IDENTITY
    if (!identity) throw new Error('The project macOS signing identity is required')

    config.setIn(['mac', 'identity'], identity)
  }

  const configPath = join(staging, 'electron-builder.yml')
  await writeFile(configPath, config.toString())
  return configPath
}

/** Write the ASAR carrier identity and wait for electron-builder to finish the requested formats. */
async function packageCarrier(
  context: PackagingContext,
  configPath: string,
  kind: DistributionKind,
  platform: string,
  formats: string[],
  signal?: AbortSignal,
): Promise<void> {
  const { build, staging, testOnly } = context
  const distribution: DistributionManifest = { kind, target: build.target, testOnly }
  await writeFile(join(staging, 'distribution.json'), JSON.stringify(distribution))

  const env: NodeJS.ProcessEnv = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
  if (build.target.startsWith('windows-')) {
    for (const key of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD']) {
      delete env[key]
    }
  }

  // electron-builder 26.15.3's API types reference a missing Snap type; use its public CLI.
  await runPnpm(
    [
      'exec',
      'electron-builder',
      '--config',
      configPath,
      platform,
      ...formats,
      build.target.endsWith('arm64') ? '--arm64' : '--x64',
      '--publish',
      'never',
    ],
    { cwd: appRoot, env, signal },
  )
}

/** Record completed installers, archives and update metadata in the candidate directory. */
async function writeArtifactReceipt(context: PackagingContext): Promise<void> {
  const names = (await readdir(context.output)).filter(
    (name) =>
      /^Kisaki-.*\.(exe|zip|dmg|deb|rpm|AppImage|blockmap)$/.test(name) ||
      /^(latest|dev|beta|rc)(?:-[a-z0-9_-]+)?\.yml$/.test(name),
  )
  if (names.length === 0) throw new Error('The packager produced no final files')

  const files: ArtifactReceipt['files'] = []
  for (const path of names) {
    const bytes = await readFile(join(context.output, path))
    files.push({ path, sha256: sha256(bytes) })
  }

  const receipt: ArtifactReceipt = {
    target: context.build.target,
    version: context.build.version,
    buildId: context.build.buildId,
    testOnly: context.testOnly,
    files,
  }
  await writeFile(join(context.output, 'artifacts.json'), JSON.stringify(receipt, null, 2))
}
