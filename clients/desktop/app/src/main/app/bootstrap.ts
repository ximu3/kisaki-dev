import { app, session } from 'electron'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { loadNative } from '#native'
import { initializePaths } from './paths'
import type { ApplicationPaths } from './paths'
import { startExtensionHost } from './extension-host'
import type { ExtensionHostProcess } from './extension-host'
import { logFailure, logLifecycle } from '../infrastructure/log'
import type { WindowKind } from '../../shared/window-controls'
import type { RuntimeManifest } from '../../shared/runtime-manifest'
import type { DevelopmentReady } from '../../shared/development-session'
import { createNativeWindow } from '../infrastructure/windows/native-window'
import {
  registerApplicationScheme,
  serveApplicationAssets,
} from '../infrastructure/windows/protocol'

/** Load the native binding after checking its build identity, target and file digest. */
async function loadRuntime(paths: ApplicationPaths): Promise<RuntimeManifest> {
  const build: RuntimeManifest = JSON.parse(
    await readFile(join(paths.runtimeDirectory, 'build.json'), 'utf8'),
  )
  const platforms: Partial<Record<NodeJS.Platform, string>> = {
    win32: 'windows',
    darwin: 'macos',
    linux: 'linux',
  }
  const target = `${platforms[process.platform]}-${process.arch}`

  if (
    build.schemaVersion !== 1 ||
    build.buildId !== __KISAKI_BUILD_ID__ ||
    build.target !== target
  ) {
    throw new Error('Desktop runtime identity does not match the current program')
  }

  const nativeHash = createHash('sha256')
    .update(await readFile(paths.nativeModulePath))
    .digest('hex')
  if (nativeHash !== build.files['resources/native/kisaki-native.node']) {
    throw new Error('Desktop native resource hash mismatch')
  }

  loadNative(paths.nativeModulePath)
  return build
}

/** Wait for the shared host to stop before allowing Electron's quit sequence to finish. */
function registerShutdown(host: ExtensionHostProcess): void {
  let stopped = false
  let stopping: Promise<void> | undefined

  app.on('before-quit', (event) => {
    if (stopped) return

    event.preventDefault()
    if (stopping) return

    stopping = host.stop().then(
      () => {
        stopped = true
        logLifecycle('app', 'Shutdown complete')
        app.quit()
      },
      (cause: unknown) => {
        logFailure('app', cause)
        app.exit(1)
      },
    )
  })
}

/** Start the selected window and shared host, then signal readiness to the development session. */
export async function bootstrap(): Promise<void> {
  logLifecycle('app', 'Starting')
  registerApplicationScheme()
  app.setName(app.isPackaged ? 'Kisaki' : 'Kisaki Dev')

  if (process.platform === 'win32') {
    app.setAppUserModelId(app.isPackaged ? 'me.kisaki' : 'me.kisaki.dev')
  }
  if (process.platform === 'linux') {
    app.setDesktopName(app.isPackaged ? 'me.kisaki.desktop' : 'me.kisaki.dev.desktop')
  }

  // Electron fixes session paths at ready, so initialize them before the first await.
  const paths = initializePaths()
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  const build = await loadRuntime(paths)
  logLifecycle('app', 'Native resources loaded')
  await app.whenReady()
  logLifecycle('app', 'Electron ready')

  serveApplicationAssets(paths.runtimeDirectory, build.files)
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler(() => false)

  const host = await startExtensionHost(paths.runtimeDirectory)
  registerShutdown(host)

  const requestedKind = app.isPackaged ? 'main' : (process.env.KISAKI_WINDOW ?? 'main')
  if (!['main', 'reader', 'player', 'game-panel'].includes(requestedKind)) {
    throw new Error('Unknown development window')
  }

  const window = await createNativeWindow({
    runtime: paths.runtimeDirectory,
    title: app.getName(),
    kind: requestedKind as WindowKind,
    rendererUrl: app.isPackaged ? undefined : process.env.KISAKI_RENDERER_URL,
  })
  window.on('closed', () => app.quit())
  app.on('second-instance', () => {
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  logLifecycle('app', `Ready ${__KISAKI_BUILD_ID__}`)
  if (!app.isPackaged) {
    process.on('message', (message: unknown) => {
      if (
        message &&
        typeof message === 'object' &&
        'type' in message &&
        message.type === 'shutdown'
      ) {
        app.quit()
      }
    })
    process.on('disconnect', () => app.quit())

    const ready: DevelopmentReady = { type: 'ready', buildId: __KISAKI_BUILD_ID__ }
    process.send?.(ready)
  }
}
