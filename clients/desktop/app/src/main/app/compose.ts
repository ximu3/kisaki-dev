import { releaseAll, rethrowAfterRelease } from '../infrastructure/release'
import { session } from 'electron'
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
import { createAppearance } from '../features/appearance'
import type { ApplicationOperations } from './database-worker'
import type { AppPaths } from './paths'
import { bindSettings } from './bindings'
import { developmentTranslation } from './development/translation'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { DesktopPlatform } from '@kisaki3/desktop-contracts/preferences'

/** Opens the chosen library before exposing any product operation to a document. */
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
      path: join(paths.data, 'library.sqlite'),
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
      /** Verifies the target volume and existing migration ledger before committing a new mode. */
      setDataMode: (input, signal) =>
        paths.setDataMode(
          input,
          async (root, existing) => {
            await assertLocalDataDirectory(root, native.files)
            if (existing) {
              await database.call('inspectLibrary', join(root, 'library.sqlite'))
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
    const interrupted = await attachments.interruptedStages().catch(async (cause) => {
      await log.record('attachment-cleanup-failed', cause)
      return []
    })
    const maintenance = new AbortController()
    let recovery: Promise<void> | undefined
    /** Reconciles the previous process's leftovers after the first window is ready. */
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

/** Main-owned application capabilities shared by window and lifecycle composition. */
export type Application = Awaited<ReturnType<typeof compose>>
