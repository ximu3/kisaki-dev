/** @fileoverview Exports the installed Linux application's actions and submits persistent notifications to its desktop portal. */

import { sessionBus, Variant, variantValue } from 'dbus-native'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { NotificationMessage } from '@kisaki3/desktop-contracts/ui'

/** Native desktop activations that the running or newly started instance can receive. */
export interface DesktopActivation {
  /** Shows the current window after an ordinary application launch. */
  activate(this: void): void
  /** Delivers external URLs through the normal link receiver. */
  openUrl(this: void, url: string): void
  /** Restores the target carried by an OS-owned notification. */
  notification(this: void, value: unknown): void
}

/** Connects a carrier whose application ID has an activatable service registered on this session bus. */
export async function linuxNotifications(appId: string, receiver: DesktopActivation) {
  const bus = sessionBus({ reconnect: false })
  bus.connection.on('error', (cause: Error) =>
    console.error('Notification bus connection failed', cause),
  )
  const portal = {
    destination: 'org.freedesktop.portal.Desktop',
    path: '/org/freedesktop/portal/desktop',
  }
  try {
    const names = await bus.listActivatableNames()
    if (!names.includes(appId)) {
      await bus.close()
      return null
    }
    const path = '/' + appId.replaceAll('.', '/')
    bus.exportInterface(
      {
        /** Handles an ordinary desktop launch without changing the current destination. */
        Activate: receiver.activate,
        /** Routes each URL supplied by the desktop through the application parser. */
        Open(urls: string[]) {
          for (const url of urls) {
            receiver.openUrl(url)
          }
        },
        /** Consumes the single string parameter of the exported notification action. */
        ActivateAction(action: string, parameters: unknown[]) {
          if (action !== 'open-notification' || parameters.length !== 1) {
            throw new Error('Unknown desktop action')
          }
          receiver.notification(variantValue(parameters[0]))
        },
      },
      path,
      {
        name: 'org.freedesktop.Application',
        methods: {
          Activate: ['a{sv}', '', ['platform_data'], []],
          Open: ['asa{sv}', '', ['uris', 'platform_data'], []],
          ActivateAction: ['sava{sv}', '', ['action_name', 'parameter', 'platform_data'], []],
        },
      },
    )
    // DO_NOT_QUEUE leaves an existing instance in control of its own registered identity.
    if ((await bus.requestName(appId, 4)) !== 1) {
      await bus.close()
      return null
    }
  } catch (error) {
    await bus.close()
    throw error
  }

  let identified: Promise<unknown> | undefined
  /** Identifies the unsandboxed app on portals with a host registry. Older portals infer the app ID. */
  async function identify() {
    try {
      await bus.invoke({
        ...portal,
        interface: 'org.freedesktop.host.portal.Registry',
        member: 'Register',
        signature: 'sa{sv}',
        body: [appId, []],
      })
    } catch (cause) {
      const name = (cause as { dbusName?: string }).dbusName
      if (
        name !== 'org.freedesktop.DBus.Error.UnknownMethod' &&
        name !== 'org.freedesktop.DBus.Error.UnknownInterface'
      ) {
        throw cause
      }
    }
  }

  return {
    /** Submits the payload as the portal's default action parameter for warm and cold delivery. */
    async show(
      message: NotificationMessage,
      token: string,
      signal?: AbortSignal,
    ): Promise<'accepted'> {
      await (identified ??= identify().catch((cause: unknown) => {
        identified = undefined
        throw cause
      }))
      signal?.throwIfAborted()
      const fields = [
        ['title', new Variant('s', message.title)],
        ['body', new Variant('s', message.body)],
        ...(message.open
          ? [
              ['default-action', new Variant('s', 'app.open-notification')],
              ['default-action-target', new Variant('s', token)],
            ]
          : []),
      ]
      try {
        await bus.invoke({
          ...portal,
          interface: 'org.freedesktop.portal.Notification',
          member: 'AddNotification',
          signature: 'sa{sv}',
          body: [token, fields],
        })
        return 'accepted'
      } catch (cause) {
        throw new DesktopError(
          'OperationFailed',
          'The desktop portal could not accept the notification',
          { cause },
        )
      }
    },
    /** Releases the application name and actions while leaving delivered notifications with the OS. */
    close: () => bus.close(),
  }
}
