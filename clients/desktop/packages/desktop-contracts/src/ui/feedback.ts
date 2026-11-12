/** @fileoverview Defines transient Toast feedback and independent system notification delivery. */

import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { CallOptions } from '../operations'
import type { NativeViewTarget } from './navigation'
import * as v from 'valibot'
import { parseExternalValue, parseValue, nonemptyText } from '../validation'
import { normalizeLocalizedText } from '@kisaki3/extension-distribution/metadata'
import { parseNativeViewTarget } from './navigation'

/** Localized feedback content and status shown within the owning view. */
export interface ToastMessage {
  /** Loading represents an ongoing operation and suspends automatic dismissal. */
  readonly type: 'loading' | 'info' | 'success' | 'warning' | 'error'
  readonly title: LocalizedText
  readonly description?: LocalizedText
}

/** Owner-bound control of one transient feedback message. */
export interface ToastHandle {
  /**
   * Replaces a live message's complete content without reopening an ended message.
   *
   * Changing loading to a result starts the result's display duration unless persistence was
   * requested.
   */
  update(message: ToastMessage): void

  /** Closes the owned message while leaving the underlying business operation unchanged. */
  dismiss(): void
}

/** Transient feedback delivery within the actual view's lifetime. */
export interface ToastApi {
  /**
   * Shows feedback owned by the actual view and returns its control handle.
   *
   * Loading messages suspend automatic dismissal. Persistent messages survive updates until
   * dismissal or owner release. Neither falls back to system notifications.
   */
  show(message: ToastMessage, options?: { readonly persistent?: boolean }): ToastHandle
}

/** System notification text with an optional native destination opened on activation. */
export interface NotificationMessage {
  readonly title: string
  readonly body: string
  readonly open?: NativeViewTarget
}

/** Independent operating-system notification delivery. */
export interface NotificationsApi {
  /**
   * Requests operating-system notification delivery and reports acceptance or unavailability.
   *
   * Acceptance does not establish user visibility. Unavailability does not fall back to a Toast.
   */
  show(message: NotificationMessage, call?: CallOptions): Promise<'accepted' | 'unavailable'>
}

/**
 * Parses feedback content and normalizes static text using the contribution owner's default locale.
 */
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

/** Parses notification text and an optional native navigation intent. */
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
