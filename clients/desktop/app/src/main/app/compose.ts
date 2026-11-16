/** @fileoverview Creates the runtime owners in dependency order and retains them through accepted work and final release. */

import { session } from 'electron'
import { join } from 'node:path'
import { loadNative } from '#native'
import { assertLocalDataDirectory } from '../infrastructure/files'
import { openDatabaseExecutor } from '../infrastructure/database'
import { createEvents } from '../infrastructure/events'
import { createPreferences } from '../features/preferences'
import { getPreferenceDefaults } from '../features/preferences/defaults'
import { createTasks } from '../features/tasks'
import { createI18n } from '../infrastructure/i18n'
import { createNotifications } from '../infrastructure/notifications'
import { systemIntegration } from '../infrastructure/system'
import { createRuntimeLog } from '../infrastructure/log'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { createNetwork } from '../infrastructure/network'
import { createResources } from '../infrastructure/resources'
import { createAttachments } from '../infrastructure/attachments'
import { createImages } from '../infrastructure/images'
import { createFonts } from '../features/fonts'
import { createAppearance } from '../features/appearance'
import type { ApplicationOperations } from './database-worker'
import type { AppPaths } from './paths'
import { bindSettings } from './bindings'
import type { DesktopPlatform } from '@kisaki3/desktop-contracts/preferences'

/** Opens the chosen library before exposing any product operation to a document. */
export async function compose(paths: AppPaths, open: (target: NativeViewTarget) => Promise<void>) {
  const nativePath = join(paths.resources, 'native', 'kisaki-native.node')
  const native = loadNative(nativePath)
  await assertLocalDataDirectory(paths.data, native.files)
  const log = await createRuntimeLog(paths.data)
  await log.record('opening')
  const defaults = getPreferenceDefaults(process.platform as DesktopPlatform, [])
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
  const teardown: Array<() => void | Promise<void>> = [() => log.record('closed'), database.close]
  /** Releases all acquired resources even when an individual cleanup fails. */
  async function release() {
    const failures: unknown[] = []
    for (const dispose of teardown.splice(0).reverse()) {
      try {
        await dispose()
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, 'Application cleanup failed')
    }
  }
  try {
    const events = createEvents()
    const system = systemIntegration({
      ...paths,
      /** Verifies the target volume and existing migration ledger before committing a new mode. */
      setDataMode: (input) =>
        paths.setDataMode(input, async (root, existing) => {
          await assertLocalDataDirectory(root, native.files)
          if (existing) {
            await database.call('inspectLibrary', join(root, 'library.sqlite'))
          }
        }),
    })
    const notifications = createNotifications(open)
    teardown.push(notifications.close)
    const i18n = createI18n()
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
    )
    const images = createImages(paths.resources, attachments, resources)
    const fonts = createFonts(paths.resources, attachments, resources, database.call)
    const appearance = createAppearance(fonts, database.call)
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
    await attachments.cleanInterruptedStages()
    await attachments.cleanup()

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
      images,
      fonts,
      appearance,
      presentationDeadline: bindings.presentationDeadline,
      /** Reads the latest preference snapshot adopted in this process. */
      get saved() {
        return bindings.saved
      },
      onUpdated: bindings.onUpdated,
      /** Waits for queued preference and collation adoption. */
      settled: bindings.settled,
      release,
    }
  } catch (error) {
    await log.record('failed', error)
    try {
      await release()
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'Application startup and cleanup failed')
    }
    throw error
  }
}

/** Main-owned application capabilities shared by window and lifecycle composition. */
export type Application = Awaited<ReturnType<typeof compose>>
