import { app, dialog, Menu, protocol, Tray } from 'electron'
import { join } from 'node:path'
import { releaseAll, rethrowAfterRelease } from './infrastructure/release'
import { createLifecycle } from './app/lifecycle'
import { createActivation } from './app/activation'
import { compose } from './app/compose'
import { selectPaths, launchArgument, type AppPaths } from './app/paths'
import { createWindow } from './app/window'
import { developmentControl } from './app/development'
import { windowKinds, type WindowKind } from '../shared/window-api/protocol'
import { applicationIdentities } from '@kisaki3/desktop-contracts/app'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Disposable } from '@kisaki3/desktop-contracts/operations'
import { loadNative } from '#native'
import { createNotifications } from './infrastructure/notifications'

/** Privileged scheme declarations must precede Electron readiness and session creation. */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'kisaki-app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
  {
    scheme: 'kisaki-resource',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
])
app.setName('Kisaki')

/** Normal process exit may proceed only after all application owners have finished. */
let released = false

/** Holds external requests only until the actual window navigation receiver is ready. */
const activation = createActivation((error) => {
  if (!(error instanceof DesktopError && error.code === 'Cancelled')) {
    dialog.showErrorBox('Kisaki', error instanceof Error ? error.message : String(error))
  }
})

/** Receives a plain second launch even while the first process is still starting in the background. */
let focusRequested = false

/** Restores the live window once startup has supplied it. */
let restore = () => {
  focusRequested = true
}

/** System activation starts a receiver; the delivered action decides which window to reveal. */
function notificationLaunch(args: readonly string[]) {
  return args.includes('--gapplication-service') || args.some((arg) => /^[-/]embedding$/i.test(arg))
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  activation.receive(url)
})
app.on('activate', () => restore())
app.on('second-instance', (_event, args) => {
  const url = args.find((arg) => /^kisaki(?:-dev)?:\/\//.test(arg))
  if (url) {
    activation.receive(url)
  } else if (!notificationLaunch(args)) {
    restore()
  }
})
app.on('window-all-closed', () => {})

/** Reports initialization failures with their real cause and leaves the chosen library intact. */
function failed(error: unknown) {
  console.error(error)
  dialog.showErrorBox(
    'Kisaki',
    error instanceof Error ? error.message : 'The application could not start',
  )
  released = true
  app.exit(1)
}

/** Runs the real window and tray until a confirmed exit ends accepted work. */
async function run(paths: AppPaths) {
  const stop = Promise.withResolvers<() => Promise<boolean>>()
  const ready =
    !app.isPackaged && process.send
      ? developmentControl(async () => (await stop.promise)())
      : undefined
  const { appId } = applicationIdentities[paths.isolated ? 'development' : 'production']
  const native = loadNative(join(paths.resources, 'native', 'kisaki-native.node'))
  const notifications = createNotifications(
    appId,
    {
      /** Shows the window once its document is ready. */
      activate: () => restore(),
      /** Passes desktop URLs to the public link parser. */
      openUrl: activation.receive,
      /** Only this installation's validated navigation target can reach the window. */
      notification: (input) => activation.notification(appId, input),
    },
    native,
  )
  let view: Awaited<ReturnType<typeof createWindow>> | undefined
  let application: Awaited<ReturnType<typeof compose>>
  try {
    await app.whenReady()
    await notifications.ready(app.isPackaged)
    application = await compose(paths, native, notifications, !!ready)
  } catch (error) {
    return rethrowAfterRelease(error, notifications.close)
  }

  let tray: Tray | undefined
  let menuUpdates: Disposable | undefined

  function releaseApplication() {
    return releaseAll([
      () => menuUpdates?.dispose(),
      () => view?.dispose(),
      () => tray?.destroy(),
      application.release,
    ])
  }

  const lifecycle = createLifecycle({
    /** Obtains the current document's close decision. */
    async confirm(signal) {
      return view ? await view.canClose(signal) : true
    },
    /** Updates task and window admission together for this exit attempt. */
    accept(enabled) {
      activation.setAccepting(enabled)
      application.tasks.setAccepting(enabled)
      view?.setAccepting(enabled)
    },
    /** Waits for accepted task execution and document operations. */
    async drain() {
      await Promise.all([application.tasks.drain(), view?.drain()])
    },
    async waiting(signal) {
      const choice = await dialog.showMessageBox({
        type: 'question',
        message: application.i18n.t('runtime.exitPending'),
        buttons: [
          application.i18n.t('runtime.continueWaiting'),
          application.i18n.t('runtime.cancelExit'),
        ],
        defaultId: 0,
        cancelId: 1,
        signal,
      })
      return choice.response === 0 ? 'wait' : 'cancel'
    },
    async release() {
      await releaseAll([() => application.log.record('closing'), releaseApplication])
    },
    /** Reports a failed committed teardown after cleanup, then exits under the failed disposition. */
    fail(message) {
      released = true
      try {
        dialog.showErrorBox('Kisaki', message)
      } finally {
        setImmediate(() => app.exit(1))
      }
    },
    /** Schedules normal quit or relaunch after the exit decision is committed. */
    finish(restart) {
      released = true
      if (restart) {
        app.relaunch()
      }
      setImmediate(() => app.quit())
    },
  })

  stop.resolve(async () => {
    const result = await lifecycle.quit()
    if (result.outcome === 'failed') {
      throw new DesktopError(result.error.code, result.error.message)
    }
    return result.outcome === 'exiting'
  })

  /** Native quit and restart entries share one result presentation per exit attempt. */
  let nativeExit: Promise<void> | undefined
  function requestExit(intent: 'quit' | 'restart') {
    nativeExit ??= lifecycle[intent]()
      .then((result) => {
        if (result.outcome === 'failed' && !released) {
          dialog.showErrorBox('Kisaki', result.error.message)
        }
      })
      .finally(() => {
        nativeExit = undefined
      })
  }

  app.on('before-quit', (event) => {
    if (released) {
      return
    }
    event.preventDefault()
    requestExit('quit')
  })
  try {
    const expected = paths.isolated ? (launchArgument('window') ?? 'main') : 'main'
    if (!windowKinds.includes(expected as WindowKind)) {
      throw new Error('Unknown native window')
    }
    const rendererUrl = !app.isPackaged ? launchArgument('renderer-url') : undefined
    if (rendererUrl && !/^http:\/\/127\.0\.0\.1:\d+\/$/.test(rendererUrl)) {
      throw new Error('Invalid development server')
    }
    const initial = process.argv.find((arg) => /^kisaki(?:-dev)?:\/\//.test(arg))
    if (initial) {
      activation.receive(initial)
    }

    view = await createWindow(application, expected as WindowKind, rendererUrl, lifecycle, {
      close() {
        if (application.saved.general.closeMainWindow === 'background') {
          view?.window.hide()
        } else {
          requestExit('quit')
        }
      },
      restart: () => requestExit('restart'),
      ready: (navigate) =>
        activation.ready(async (request) => {
          if (
            request.type !== 'native' &&
            (request.scheme !== (paths.isolated ? 'kisaki-dev' : 'kisaki') ||
              request.type !== 'view' ||
              !['preferences', 'tasks'].includes(request.target.type))
          ) {
            throw new Error('This destination is unavailable')
          }
          await navigate(request.target)
        }),
      disconnected: activation.disconnected,
    })
    await view.firstReady

    tray = new Tray(join(paths.resources, 'icons', 'icon.png'))
    tray.setToolTip('Kisaki')
    const { show } = view
    tray.on('click', show)
    /** Builds the current-language tray and system menus for this process. */
    const menus = () => {
      tray!.setContextMenu(
        Menu.buildFromTemplate([
          { label: 'Kisaki', click: show },
          { type: 'separator' },
          {
            label: application.i18n.t('runtime.quit'),
            /** Starts normal application quit from the tray. */
            click: () => app.quit(),
          },
        ]),
      )
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: 'Kisaki',
            submenu: [
              {
                label: application.i18n.t('runtime.preferences'),
                /** Restores the main window and opens native preferences. */
                click: () => activation.open({ type: 'preferences' }),
              },
              { type: 'separator' },
              {
                label: application.i18n.t('runtime.quit'),
                accelerator: 'CommandOrControl+Q',
                /** Requests normal quit using the system menu. */
                click: () => app.quit(),
              },
            ],
          },
          { role: 'editMenu' },
          { role: 'windowMenu' },
        ]),
      )
    }
    menus()
    menuUpdates = application.i18n.onChanged(menus)
    restore = show
    if (
      focusRequested ||
      (!process.argv.includes('--login') &&
        !notificationLaunch(process.argv) &&
        !(process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin))
    ) {
      show()
    }
    application.events.publisher('app.ready').emit({ readyAt: Date.now() })
    await application.log.record('ready')
    application.recoverAttachments()
    await ready?.()
  } catch (error) {
    if (released) {
      return
    }
    return rethrowAfterRelease(error, releaseApplication)
  }
}

try {
  const paths = selectPaths()
  const identity = applicationIdentities[paths.isolated ? 'development' : 'production']
  if (process.platform === 'win32') {
    app.setAppUserModelId(identity.appId)
  } else if (process.platform === 'linux') {
    app.setDesktopName(identity.appId + '.desktop')
  }
  if (app.requestSingleInstanceLock()) {
    void run(paths).catch(failed)
  } else {
    released = true
    app.quit()
  }
} catch (error) {
  failed(error)
}
