/** @fileoverview Defines transient Toast feedback and independent system notification delivery. */

import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { CallOptions } from '../operations'
import type { NativeViewTarget } from './navigation'
import * as v from 'valibot'
import { parseExternalValue, parseValue, nonemptyText } from '../validation'
import { normalizeLocalizedText } from '@kisaki3/extension-distribution/metadata'
import { parseNativeViewTarget } from './navigation'

export interface ToastMessage {
  /** Loading represents an ongoing operation and suspends automatic dismissal. */
  readonly type: 'loading' | 'info' | 'success' | 'warning' | 'error'
  readonly title: LocalizedText
  readonly description?: LocalizedText
}

export interface ToastHandle {
  /**
   * Replace a live prompt's complete message without reopening an ended prompt. Changing from
   * loading to a result starts the result's display duration unless persistent was requested.
   */
  update(message: ToastMessage): void

  /**
   * Close this owned prompt without canceling or resolving the underlying business operation.
   */
  dismiss(): void
}

export interface ToastApi {
  /**
   * Show feedback owned by the actual view. Loading prompts do not time out; persistent prompts
   * remain across message updates until dismissal or owner release. Neither falls back to system
   * notifications.
   */
  show(message: ToastMessage, options?: { readonly persistent?: boolean }): ToastHandle
}

export interface NotificationMessage {
  readonly title: string
  readonly body: string
  readonly open?: NativeViewTarget
}

export interface NotificationsApi {
  /** accepted means OS delivery acceptance only; unavailable never silently falls back to a Toast. */
  show(message: NotificationMessage, call?: CallOptions): Promise<'accepted' | 'unavailable'>
}

/** Static text follows the contribution owner's default locale and never interprets application message keys. */
export function parseToastMessage(input: unknown, defaultLocale: string): ToastMessage {
  const localized = v.pipe(
    v.unknown(),
    v.transform((value) =>
      parseExternalValue(
        (value) => normalizeLocalizedText(value, defaultLocale),
        value,
        'Invalid UI text',
      ),
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

/** A notification contains only safe display text and an optional existing native navigation intent. */
export function parseNotificationMessage(input: unknown): NotificationMessage {
  return parseValue(
    v.strictObject({
      title: nonemptyText,
      body: nonemptyText,
      open: v.exactOptional(v.pipe(v.unknown(), v.transform(parseNativeViewTarget))),
    }),
    input,
    'Invalid notification message',
  )
}
