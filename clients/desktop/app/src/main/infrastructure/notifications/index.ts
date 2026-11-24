import { Notification } from 'electron'
import { randomUUID } from 'node:crypto'
import type { NativeCapabilities } from '#native'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseNotificationMessage, type NotificationsApi } from '@kisaki3/desktop-contracts/ui'
import { notificationTarget } from './target'
import type { linuxNotifications, DesktopActivation } from './linux'

export function createNotifications(
  appId: string,
  receiver: DesktopActivation,
  native?: Pick<NativeCapabilities, 'postNotification' | 'setNotificationReceiver'>,
) {
  function connectNative() {
    try {
      return !!native?.setNotificationReceiver(appId, receiver.notification)
    } catch (cause) {
      console.error('System notification activation is unavailable', cause)
      return false
    }
  }
  let attached = process.platform === 'darwin' && connectNative()
  let portal: Awaited<ReturnType<typeof linuxNotifications>> = null
  let portalFailed = false
  const active = new Map<Notification, () => void>()
  let closed = false

  const api: NotificationsApi = {
    async show(input, options) {
      options?.signal?.throwIfAborted()
      if (closed) {
        throw new DesktopError('ConnectionClosed', 'The notification service has closed')
      }
      const message = parseNotificationMessage(input)
      const identifier = message.open ? notificationTarget(appId, message.open) : randomUUID()

      if (process.platform !== 'linux') {
        if (!attached || !native) {
          return 'unavailable'
        }
        const accepted = await native.postNotification(
          appId,
          identifier,
          message.title,
          message.body,
        )
        return accepted ? 'accepted' : 'unavailable'
      }
      if (portal) {
        return portal.show(message, identifier, options?.signal)
      }
      if (portalFailed) {
        return 'unavailable'
      }

      // An unregistered Linux carrier can receive libnotify actions during its own lifetime.
      if (!Notification.isSupported()) {
        return 'unavailable'
      }
      const item = new Notification({ title: message.title, body: message.body })
      const submitted = Promise.withResolvers<'accepted'>()
      const end = () => {
        active.delete(item)
        submitted.reject(
          new DesktopError('ConnectionClosed', 'The notification was closed before delivery'),
        )
      }
      active.set(item, end)
      item.once('show', () => submitted.resolve('accepted'))
      item.once('click', () => {
        active.delete(item)
        if (message.open) {
          receiver.notification(identifier)
        }
      })
      item.once('close', end)
      item.once('failed', (_event, reason) => {
        active.delete(item)
        submitted.reject(
          new DesktopError('OperationFailed', 'The system notification could not be delivered', {
            cause: new Error(reason),
          }),
        )
      })
      try {
        item.show()
        return await submitted.promise
      } catch (error) {
        active.delete(item)
        throw error
      }
    },
  }
  return {
    ...api,
    async ready(packaged: boolean) {
      if (process.platform === 'win32') {
        attached = connectNative()
      } else if (process.platform === 'linux' && packaged && process.env.DBUS_SESSION_BUS_ADDRESS) {
        const { linuxNotifications } = await import('./linux')
        try {
          portal = await linuxNotifications(appId, receiver)
        } catch (cause) {
          portalFailed = true
          console.error('Desktop notification activation is unavailable', cause)
        }
      }
    },
    async close(this: void) {
      if (closed) {
        return
      }
      closed = true
      if (attached) {
        native?.setNotificationReceiver(appId, null)
      }
      for (const [item, end] of active) {
        end()
        item.close()
      }
      await portal?.close()
    },
  }
}
