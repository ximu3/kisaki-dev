/**
 * @fileoverview Verifies a prepared desktop runtime, packages its target carriers and
 * records the resulting artifact identities.
 */

import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseDocument } from 'yaml'
import { appRoot, buildDirectory, repositoryRoot } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import { runtimeFiles } from '../build/files'
import type { DesktopBuild, DesktopTarget } from '../lib/runtime-manifest'
import type { DistributionKind, DistributionManifest } from '../lib/distribution'
import { sha256 } from '../lib/sha256'
import { removeOutputs } from '@kisaki3/tooling/output'
import { runPnpm } from '@kisaki3/tooling/process'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'

/** Target and build identity with digests of completed desktop packaging outputs. */
export interface ArtifactReceipt {
  target: DesktopTarget
  version: string
  buildId: string
  testOnly: boolean
  /** File names relative to the directory containing this receipt. */
  files: { path: string; sha256: string }[]
}

/** Verified runtime and owned working directories for one packaging operation. */
interface PackagingContext {
  build: DesktopBuild
  /** Temporary runtime copy consumed by electron-builder. */
  staging: string
  /** Disposable directory receiving installers, archives and their completion receipt. */
  output: string
  testOnly: boolean
}

/**
 * Packages a verified runtime on its matching target runner and returns the artifact receipt path.
 *
 * Checks the target and runtime byte inventory before packaging. Ordinary fixture runs build the
 * smoke carrier; installer checks and release builds produce every target format. The receipt
 * records completed files before temporary staging cleanup.
 */
export async function packageDesktop(
  target: DesktopTarget,
  options: { testOnly?: boolean; installers?: boolean; signal?: AbortSignal } = {},
): Promise<string> {
  const { testOnly = false, signal } = options
  const installers = !testOnly || options.installers
  if (target !== hostTarget()) {
    throw new Error('Package on the corresponding native target runner')
  }

  const runtime = buildDirectory(target)
  const desktop = JSON.parse(await readFile(join(runtime, 'build.json'), 'utf8')) as DesktopBuild
  if (desktop.schemaVersion !== 1 || desktop.target !== target) {
    throw new Error('Desktop packaging requires a build matching the selected target')
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
  await removeOutputs(appRoot, [output], signal)
  await mkdir(output, { recursive: true })
  const staging = await mkdtemp(join(appRoot, 'out', 'package-'))
  /** Removes the temporary runtime copy used by the packager. */
  const cleanup = () => rm(staging, { recursive: true, force: true })

  try {
    await cp(runtime, staging, { recursive: true })
    await copyFile(join(repositoryRoot, 'LICENSE'), join(staging, 'LICENSE'))

    const context = { build: desktop, staging, output, testOnly }
    const configPath = await writeBuilderConfig(context)

    if (target.startsWith('windows-')) {
      await packageCarrier(context, configPath, 'zip', '--win', ['zip'], signal)
      if (installers) {
        await packageCarrier(context, configPath, 'nsis', '--win', ['nsis'], signal)
      }
    } else if (target.startsWith('macos-')) {
      await packageCarrier(
        context,
        configPath,
        'app',
        '--mac',
        installers ? ['dmg', 'zip'] : ['zip'],
        signal,
      )
    } else {
      if (installers) {
        await packageCarrier(context, configPath, 'deb', '--linux', ['deb'], signal)
        await packageCarrier(context, configPath, 'rpm', '--linux', ['rpm'], signal)
      }
      await packageCarrier(context, configPath, 'appimage', '--linux', ['AppImage'], signal)
    }

    await writeArtifactReceipt(context)
  } catch (cause) {
    return rethrowAfterCleanup(cause, cleanup, 'Desktop packaging and cleanup failed')
  }

  await cleanup()

  return join(output, 'artifacts.json')
}

/**
 * Writes builder configuration for the verified runtime and packaging output directory.
 *
 * Production macOS packaging requires the project's signing identity; test-only packaging disables
 * macOS signing.
 */
async function writeBuilderConfig(context: PackagingContext): Promise<string> {
  const { build, staging, output, testOnly } = context
  const config = parseDocument(await readFile(join(appRoot, 'electron-builder.yml'), 'utf8'))

  config.set('electronVersion', build.electronVersion)
  config.set('directories', {
    app: staging,
    output,
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
    if (!identity) {
      throw new Error('The project macOS signing identity is required')
    }

    config.setIn(['mac', 'identity'], identity)
  }

  const configPath = join(staging, 'electron-builder.yml')
  await writeFile(configPath, config.toString())

  return configPath
}

/**
 * Writes carrier identity and builds the requested installer or archive formats.
 *
 * Uses explicit project signing policy, disables publication and waits for electron-builder to
 * exit.
 */
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

/**
 * Hashes completed carrier and update files and writes the completion receipt.
 *
 * Rejects output with no recognized final files.
 */
async function writeArtifactReceipt(context: PackagingContext): Promise<void> {
  const names = (await readdir(context.output)).filter(
    (name) =>
      /^Kisaki-.*\.(exe|zip|dmg|deb|rpm|AppImage|blockmap)$/.test(name) ||
      /^(latest|dev|beta|rc)(?:-[a-z0-9_-]+)?\.yml$/.test(name),
  )
  if (names.length === 0) {
    throw new Error('The packager produced no final files')
  }

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
