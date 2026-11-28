import { releaseAll, rethrowAfterRelease } from '../infrastructure/release'
import { powerMonitor, session } from 'electron'
import { join } from 'node:path'
import type { NativeCapabilities } from '#native'
import { assertLocalDataDirectory } from '../infrastructure/files'
import { openDatabaseExecutor } from '../infrastructure/database'
import { createEvents } from '../infrastructure/events'
import { createPreferences } from '../features/preferences'
import { getPreferenceDefaults } from '../features/preferences/defaults'
import { createTasks } from '../features/tasks'
import { createI18n } from '../infrastructure/i18n'
import type { createNotifications } from '../infrastructure/notifications'
import { systemIntegration } from '../infrastructure/system'
import { createRuntimeLog } from '../infrastructure/log'
import { createNetwork } from '../infrastructure/network'
import { createResources } from '../infrastructure/resources'
import { createAttachments } from '../infrastructure/attachments'
import { createImages } from '../infrastructure/images'
import { createFonts } from '../features/fonts'
import { createLibrary } from '../features/library'
import { createUseTargets } from '../infrastructure/use-targets'
import { createAppearance } from '../features/appearance'
import type { ApplicationOperations } from './database-worker'
import { databasePath, type AppPaths } from './paths'
import { bindSettings } from './bindings'
import { developmentTranslation } from './development/translation'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { DesktopPlatform } from '@kisaki3/desktop-contracts/preferences'

export async function compose(
  paths: AppPaths,
  native: NativeCapabilities,
  notifications: ReturnType<typeof createNotifications>,
  developing: boolean,
) {
  const nativePath = join(paths.resources, 'native', 'kisaki-native.node')
  await assertLocalDataDirectory(paths.data, native.files)
  const log = await createRuntimeLog(paths.data)
  await log.record('opening')
  const translation = developing ? developmentTranslation : undefined
  const defaults = getPreferenceDefaults(process.platform as DesktopPlatform, [], translation?.ref)
  const database = await openDatabaseExecutor<ApplicationOperations>(
    new URL('./database.js', import.meta.url),
    {
      path: databasePath(paths.data),
      nativeBinding: join(paths.resources, 'native', 'better-sqlite3.node'),
      collationExtension: nativePath,
      migrationsDirectory: join(paths.resources, 'drizzle'),
      defaults,
    },
  ).catch(async (error) => {
    await log.record('failed', error)
    throw error
  })
  void log.record('storage-open')
  const teardown: Array<() => void | Promise<void>> = [() => log.record('closed'), database.close]
  async function release() {
    await releaseAll(teardown.splice(0).reverse())
  }
  try {
    const events = createEvents()
    const system = systemIntegration({
      ...paths,
      setDataMode: (input, signal) =>
        paths.setDataMode(
          input,
          async (root, existing) => {
            await assertLocalDataDirectory(root, native.files)
            if (existing) {
              await database.call('inspectLibrary', databasePath(root))
            }
          },
          signal,
        ),
    })
    teardown.push(notifications.close)
    const i18n = createI18n(translation)
    const preferences = createPreferences(database.call, defaults, () => i18n.t)
    const tasks = await createTasks(database.call, events.publisher('tasks.finished'))
    const network = createNetwork(
      session.fromPartition('kisaki-host'),
      preferences.readProxyCredentials,
    )
    teardown.push(network.close)
    const resources = createResources()
    const attachments = createAttachments(
      paths.data,
      native.files,
      resources,
      network,
      database.call,
      (cause) => void log.record('attachment-cleanup-failed', cause),
    )
    const images = createImages(paths.resources, attachments, resources)
    const fonts = createFonts(
      paths.resources,
      attachments,
      resources,
      database.call,
      native.listFontFamilies,
    )
    const appearance = createAppearance(fonts, database.call, (ref) => resources.file(ref).sha256)
    teardown.push(appearance.close)
    const bindings = await bindSettings(
      preferences,
      defaults,
      i18n,
      appearance,
      network,
      (locale) => database.adoptLocale(locale),
    )
    teardown.push(bindings.dispose)
    const useTargets = createUseTargets()
    const library = createLibrary(
      database.call,
      attachments,
      events.publisher('library.changed'),
      () => bindings.saved.library.showNsfw,
      () => ({ locale: i18n.current.locale, t: i18n.t }),
      native.files,
      paths.resources,
      new URL('./file-rules.js', import.meta.url),
      useTargets.change,
      () => bindings.saved.usage,
    )
    const watch = library.holdings.watch((cause) => void log.record('holdings-watch-failed', cause))
    let sensitive = bindings.saved.library.showNsfw
    function monitor() {
      watch.setEnabled(bindings.saved.library.autoRefreshHoldings)
      if (sensitive !== bindings.saved.library.showNsfw) {
        sensitive = bindings.saved.library.showNsfw
        library.visibilityChanged()
      }
    }
    const observed = [
      bindings.onUpdated(monitor),
      library.holdings.onAutomaticEnabled(watch.matchFile),
      library.holdings.onLocationsChanged(() => void watch.sync()),
      library.holdings.onRulesChanged((rule) => {
        if (rule.definition) {
          watch.rulesChanged(rule.type, rule.id)
        }
      }),
      events.on('library.changed', (event) => watch.libraryChanged(event.changes)),
      useTargets.onReleased((target) => {
        if (target.type === 'file') {
          watch.fileReleased(target.kind, target.id)
        }
      }),
    ]
    const resume = () => watch.resume()
    powerMonitor.on('resume', resume)
    monitor()
    teardown.push(async () => {
      powerMonitor.off('resume', resume)
      for (const subscription of observed) {
        await subscription.dispose()
      }
      await watch.close()
    })
    const interrupted = await attachments.interruptedStages().catch(async (cause) => {
      await log.record('attachment-cleanup-failed', cause)
      return []
    })
    const maintenance = new AbortController()
    let recovery: Promise<void> | undefined
    function recoverAttachments() {
      recovery = (async () => {
        await attachments.cleanInterruptedStages(interrupted, maintenance.signal)
        const result = await attachments.cleanup({ signal: maintenance.signal })
        for (const issue of result.issues) {
          await log.record('attachment-cleanup-failed', issue.error)
        }
      })().catch(async (cause) => {
        const stopped =
          maintenance.signal.aborted &&
          (cause === maintenance.signal.reason ||
            (cause instanceof DesktopError && cause.code === 'Cancelled'))
        if (!stopped) {
          await log.record('attachment-cleanup-failed', cause)
        }
      })
    }
    teardown.push(async () => {
      maintenance.abort()
      await releaseAll([() => recovery, () => attachments.drain()])
    })

    return {
      paths,
      log,
      events,
      system,
      notifications,
      preferences,
      tasks,
      i18n,
      network,
      resources,
      attachments,
      recoverAttachments,
      library,
      useTargets,
      images,
      fonts,
      appearance,
      presentationDeadline: bindings.presentationDeadline,
      get saved() {
        return bindings.saved
      },
      onUpdated: bindings.onUpdated,
      settled: bindings.settled,
      release,
    }
  } catch (error) {
    return rethrowAfterRelease(error, () =>
      releaseAll([() => log.record('failed', error), release]),
    )
  }
}

export type Application = Awaited<ReturnType<typeof compose>>
