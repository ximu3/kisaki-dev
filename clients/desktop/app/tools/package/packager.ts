import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { observeDmg } from './dmg-diagnostics'
import { parseDocument } from 'yaml'
import desktop from '../../package.json' with { type: 'json' }
import { appRoot, buildDirectory, repositoryRoot } from '../lib/paths'
import { hostTarget, type DesktopTarget } from '../lib/targets'
import { runtimeFiles, type DesktopBuild } from '../build/manifest'
import type { DistributionKind, DistributionManifest } from './distribution'
import { applicationIdentities } from '@kisaki3/desktop-contracts/app'
import { sha256 } from '../lib/sha256'
import { removeOutputs } from '@kisaki3/tooling/output'
import { runPnpm } from '@kisaki3/tooling/process'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'

export interface ArtifactReceipt {
  target: DesktopTarget
  version: string
  buildId: string
  testOnly: boolean
  files: { path: string; sha256: string }[]
}

interface PackagingContext {
  build: DesktopBuild
  staging: string
  output: string
  testOnly: boolean
}

export async function packageDesktop(
  target: DesktopTarget,
  options: { testOnly?: boolean; smokeOnly?: boolean; signal?: AbortSignal } = {},
): Promise<string> {
  const { testOnly = false, signal } = options
  const installers = !testOnly || !options.smokeOnly
  if (target !== hostTarget()) {
    throw new Error('Package on the corresponding native target runner')
  }

  const runtime = buildDirectory(target)
  const manifest = await readFile(join(runtime, 'build.json'), 'utf8')
  const desktop = JSON.parse(manifest) as DesktopBuild
  if (desktop.schemaVersion !== 1 || desktop.target !== target) {
    throw new Error('Desktop packaging requires a build matching the selected target')
  }

  const output = join(appRoot, 'dist', target)
  const staging = await mkdtemp(join(appRoot, 'out', 'package-'))
  const cleanup = () => rm(staging, { recursive: true, force: true })

  try {
    await cp(runtime, staging, { recursive: true, dereference: true })
    await verifyStagedRuntime(staging, manifest, desktop.files)
    await copyFile(join(repositoryRoot, 'LICENSE'), join(staging, 'LICENSE'))

    await removeOutputs(appRoot, [output], signal)
    await mkdir(output, { recursive: true })
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

async function verifyStagedRuntime(
  staging: string,
  manifest: string,
  expected: DesktopBuild['files'],
) {
  if ((await readFile(join(staging, 'build.json'), 'utf8')) !== manifest) {
    throw new Error('Desktop build manifest changed before packaging')
  }

  const actual = await runtimeFiles(staging)
  if (Object.keys(actual).length !== Object.keys(expected).length) {
    throw new Error('Desktop runtime file set changed before packaging')
  }
  for (const [file, digest] of Object.entries(expected)) {
    if (actual[file] !== digest) {
      throw new Error(`Desktop build changed before packaging: ${file}`)
    }
  }
}

async function writeBuilderConfig(context: PackagingContext): Promise<string> {
  const { build, staging, output, testOnly } = context
  const config = parseDocument(await readFile(join(appRoot, 'electron-builder.yml'), 'utf8'))

  config.set('electronVersion', build.electronVersion)
  const identity = applicationIdentities[testOnly ? 'development' : 'production']
  config.set('appId', identity.appId)
  config.set('productName', identity.name)
  if (build.target.startsWith('linux-')) {
    config.set('extraMetadata', { desktopName: identity.appId + '.desktop' })
    config.setIn(['linux', 'executableName'], identity.linuxPackageName)
    config.setIn(['deb', 'packageName'], identity.linuxPackageName)
    config.setIn(['rpm', 'packageName'], identity.linuxPackageName)
  }
  config.set('protocols', [{ name: identity.name, schemes: [identity.scheme] }])
  config.set('directories', {
    app: staging,
    output,
  })

  config.set('extraResources', [{ from: join(staging, 'resources'), to: 'resources' }])
  config.setIn(['win', 'icon'], join(staging, 'resources', 'icons', 'icon.ico'))
  config.setIn(['mac', 'icon'], join(staging, 'resources', 'icons', 'icon.png'))
  config.setIn(['mac', 'minimumSystemVersion'], desktop.config.macosDeploymentTarget)
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

  const stopObservation =
    formats.includes('dmg') && process.env.KISAKI_DMG_DIAGNOSTICS === '1'
      ? observeDmg(context.output, join(appRoot, 'test-results', 'packaging', 'dmg.log'))
      : undefined
  let packaged = false
  try {
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
    packaged = true
  } finally {
    await stopObservation?.(packaged)
  }
}

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
