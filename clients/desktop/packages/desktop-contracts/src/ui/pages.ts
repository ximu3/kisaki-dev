/** @fileoverview Defines stable page identities and owner-bound page registration and opening. */

import type { CallOptions, Registration } from '../operations'
import type { ExtensionUiIcon } from './icons'
import type {
  ExtensionViewDefinition,
  HostView,
  ViewMethods,
  ViewNotifications,
  ViewMethodsConstraint,
} from './views'
import { parseValue, id, parseExternalValue } from '../validation'
import * as v from 'valibot'
import { parseId } from '@kisaki3/extension-distribution/metadata'

/** Native page-catalog identity or an extension page's complete owner and local identity. */
export type PageRef =
  | { readonly type: 'native'; readonly id: string }
  | { readonly type: 'extension'; readonly extensionId: string; readonly pageId: string }

/** Page contribution with a stable local identity and icon within its registering extension. */
export interface ExtensionPageDefinition<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> extends ExtensionViewDefinition<M, N> {
  readonly id: string
  readonly icon: ExtensionUiIcon
}

/** Owner-bound page registration and opening. */
export interface ExtensionPagesApi {
  /**
   * Registers a stable page identity for the actual owner and returns its availability handle.
   *
   * Registration leaves the page unopened.
   */
  register<M extends ViewMethodsConstraint<M> = ViewMethods, N extends object = ViewNotifications>(
    input: ExtensionPageDefinition<M, N>,
    call?: CallOptions,
  ): Promise<Registration<PageRef & { readonly type: 'extension' }>>

  /**
   * Opens the caller's registered page or focuses its existing view.
   *
   * Reuse preserves the user's draft and does not repeat setup.
   */
  open<M extends ViewMethodsConstraint<M> = ViewMethods, N extends object = ViewNotifications>(
    input: { readonly pageId: string },
    call?: CallOptions,
  ): Promise<HostView<M, N>>
}

/**
 * Parses page identity syntax while preserving temporarily unavailable references.
 *
 * The host checks the current page directory.
 */
export function parsePageRef(input: unknown): PageRef {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('native'), id }),
      v.strictObject({
        type: v.literal('extension'),
        extensionId: v.pipe(
          v.unknown(),
          v.transform((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
        ),
        pageId: id,
      }),
    ]),
    input,
    'Invalid page reference',
  )
}
