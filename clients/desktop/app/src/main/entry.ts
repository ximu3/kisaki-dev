/** @fileoverview Starts the desktop application, delivers native entry requests and coordinates normal shutdown. */

import { app, dialog, Menu, protocol, Tray } from 'electron'
import { join } from 'node:path'
import { createLifecycle } from './app/lifecycle'
import { createActivation } from './app/activation'
import { compose } from './app/compose'
import { selectPaths, launchArgument, type AppPaths } from './app/paths'
import { createWindow } from './app/window'
import { developmentControl } from './app/development'
import { windowKinds, type WindowKind } from '../shared/window-api/protocol'

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
const activation = createActivation((error) =>
  dialog.showErrorBox('Kisaki', error instanceof Error ? error.message : String(error)),
)

/** Receives a plain second launch even while the first process is still starting in the background. */
let focusRequested = false

/** Restores the live window once startup has supplied it. */
let restore = () => {
  focusRequested = true
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
  } else {
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
  await app.whenReady()
  let view: Awaited<ReturnType<typeof createWindow>> | undefined
  const application = await compose(paths, async (target) => {
    if (!view) {
      throw new Error('The main window is unavailable')
    }
    show()
    await view.navigate(target)
  })
  let tray: Tray | undefined
  /** Restores and focuses the active native window. */
  const show = () => {
    if (view) {
      if (view.window.isMinimized()) {
        view.window.restore()
      }
      view.window.show()
      view.window.focus()
    }
  }
  const lifecycle = createLifecycle({
    /** Obtains the current document's close decision. */
    async confirm() {
      return view ? await view.canClose() : true
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
    /** Offers the actual waiting user a continuation or return to the app. */
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
    /** Releases the window, tray and application owners before SQLite closes. */
    async release() {
      await application.log.record('closing')
      await view?.dispose()
      tray?.destroy()
      await application.release()
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

  /** Shares a normal exit with development callers that need its actual disposition. */
  async function exit() {
    const result = await lifecycle.quit()
    if (result.outcome === 'failed') {
      throw new Error(result.error.message)
    }
    return result.outcome === 'exiting'
  }
  stop.resolve(exit)
  app.on('before-quit', (event) => {
    if (released) {
      return
    }
    event.preventDefault()
    void exit().catch((error) => dialog.showErrorBox('Kisaki', String(error)))
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
    view = await createWindow(application, expected as WindowKind, rendererUrl, lifecycle, () => {
      if (application.saved.general.closeMainWindow === 'background') {
        view?.window.hide()
      } else {
        void exit().catch((error) => dialog.showErrorBox('Kisaki', String(error)))
      }
    })
    await view.ready
    tray = new Tray(join(paths.resources, 'icons', 'icon.png'))
    tray.setToolTip('Kisaki')
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
                click: () => {
                  show()
                  void view!.navigate({ type: 'preferences' })
                },
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
    application.i18n.onChanged(menus)
    restore = show
    const initial = process.argv.find((arg) => /^kisaki(?:-dev)?:\/\//.test(arg))
    if (initial) {
      activation.receive(initial)
    }
    await activation.ready(async (request) => {
      if (
        request.scheme !== (paths.isolated ? 'kisaki-dev' : 'kisaki') ||
        request.type !== 'view' ||
        !['preferences', 'tasks'].includes(request.target.type)
      ) {
        throw new Error('This destination is unavailable')
      }
      await view!.navigate(request.target)
      show()
    })
    if (
      focusRequested ||
      (!process.argv.includes('--login') &&
        !(process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin))
    ) {
      show()
    }
    application.events.publisher('app.ready').emit({ readyAt: Date.now() })
    await application.log.record('ready')
    await ready?.()
  } catch (error) {
    if (released) {
      return
    }
    if (view) {
      await view.dispose()
    }
    tray?.destroy()
    await application.release()
    throw error
  }
}

try {
  const paths = selectPaths()
  if (process.platform === 'win32') {
    app.setAppUserModelId(paths.isolated ? 'me.kisaki.dev' : 'me.kisaki')
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
