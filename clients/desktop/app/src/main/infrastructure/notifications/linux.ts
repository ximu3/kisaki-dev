import { rethrowAfterRelease } from '../release'
import { sessionBus, Variant, variantValue } from 'dbus-native'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { NotificationMessage } from '@kisaki3/desktop-contracts/ui'

export interface DesktopActivation {
  activate(this: void): void
  openUrl(this: void, url: string): void
  notification(this: void, value: unknown): void
}

export async function linuxNotifications(appId: string, receiver: DesktopActivation) {
  const bus = sessionBus({ reconnect: false })
  bus.connection.on('error', (cause: Error) =>
    console.error('Notification bus connection failed', cause),
  )
  const portal = {
    destination: 'org.freedesktop.portal.Desktop',
    path: '/org/freedesktop/portal/desktop',
  }
  async function claimName() {
    const names = await bus.listActivatableNames()
    if (!names.includes(appId)) {
      return false
    }
    const path = '/' + appId.replaceAll('.', '/')
    bus.exportInterface(
      {
        Activate: receiver.activate,
        Open(urls: string[]) {
          for (const url of urls) {
            receiver.openUrl(url)
          }
        },
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
    return (await bus.requestName(appId, 4)) === 1
  }
  const claimed = await claimName().catch((cause: unknown) =>
    rethrowAfterRelease(cause, () => bus.close()),
  )
  if (!claimed) {
    await bus.close()
    return null
  }

  let identified: Promise<unknown> | undefined
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
    close: () => bus.close(),
  }
}
