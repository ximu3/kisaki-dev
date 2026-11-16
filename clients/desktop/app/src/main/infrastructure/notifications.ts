/** @fileoverview Owns system notification delivery and routes clicks to the application's native navigation. */

import { Notification } from 'electron'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseNotificationMessage,
  type NotificationsApi,
  type NativeViewTarget,
} from '@kisaki3/desktop-contracts/ui'

/** Keeps notification callbacks alive through OS delivery and releases outstanding instances at exit. */
export function createNotifications(open: (target: NativeViewTarget) => Promise<void>) {
  const active = new Set<Notification>()
  const api: NotificationsApi = {
    /** Delivers a validated native notification and retains its click destination. */
    async show(input, options) {
      options?.signal?.throwIfAborted()
      const message = parseNotificationMessage(input)
      if (!Notification.isSupported()) {
        return 'unavailable'
      }
      const item = new Notification({ title: message.title, body: message.body })
      active.add(item)
      const submitted = Promise.withResolvers<'accepted'>()
      item.once('show', () => submitted.resolve('accepted'))
      item.once('click', () => {
        if (message.open) {
          void open(message.open).catch(console.error)
        }
      })
      item.once('close', () => {
        active.delete(item)
        submitted.reject(
          new DesktopError('ConnectionClosed', 'The notification was closed before delivery'),
        )
      })
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
    /** Releases native notification instances when the app exits. */
    close(this: void) {
      for (const item of active) {
        item.close()
      }
      active.clear()
    },
  }
}
