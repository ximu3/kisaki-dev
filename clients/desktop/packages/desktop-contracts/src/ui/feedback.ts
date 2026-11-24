import type { CallOptions } from '../operations'
import * as v from 'valibot'
import { fromParser, parseExternalValue, parseValue, nonemptyText } from '../validation'
import {
  normalizeLocalizedText,
  type LocalizedText,
} from '@kisaki3/extension-distribution/metadata'
import { parseNativeViewTarget, type NativeViewTarget } from './navigation'

export interface ToastMessage {
  readonly type: 'loading' | 'info' | 'success' | 'warning' | 'error'
  readonly title: LocalizedText
  readonly description?: LocalizedText
}

export interface ToastHandle {
  update(message: ToastMessage): void

  dismiss(): void
}

export interface ToastApi {
  show(message: ToastMessage, options?: { readonly persistent?: boolean }): ToastHandle
}

export interface NotificationMessage {
  readonly title: string
  readonly body: string
  readonly open?: NativeViewTarget
}

export interface NotificationsApi {
  show(message: NotificationMessage, call?: CallOptions): Promise<'accepted' | 'unavailable'>
}

export function parseToastMessage(input: unknown, defaultLocale: string): ToastMessage {
  const localized = fromParser((value) =>
    parseExternalValue(
      (value) => normalizeLocalizedText(value, defaultLocale),
      value,
      'Invalid UI text',
    ),
  )
  return parseValue(
    v.strictObject({
      type: v.picklist(['loading', 'info', 'success', 'warning', 'error']),
      title: localized,
      description: v.exactOptional(localized),
    }),
    input,
    'Invalid Toast message',
  )
}

export function parseNotificationMessage(input: unknown): NotificationMessage {
  return parseValue(
    v.strictObject({
      title: nonemptyText,
      body: nonemptyText,
      open: v.exactOptional(fromParser(parseNativeViewTarget)),
    }),
    input,
    'Invalid notification message',
  )
}
