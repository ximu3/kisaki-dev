/** @fileoverview Defines stable page identities and owner-bound page registration and opening. */

import type { CallOptions, Registration } from '../operations'
import type { UiIcon } from './icons'
import type {
  ViewDefinition,
  HostView,
  ViewMethods,
  ViewNotifications,
  ViewMethodsConstraint,
} from './views'
import { parseValue, id, parseExternalValue } from '../validation'
import * as v from 'valibot'
import { parseId } from '@kisaki3/extension-distribution/metadata'

/** Native IDs name the actual application page catalog; extension pages keep the complete owner/local identity. */
export type PageRef =
  | { readonly type: 'native'; readonly id: string }
  | { readonly type: 'extension'; readonly extensionId: string; readonly pageId: string }

export interface PageDefinition<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> extends ViewDefinition<M, N> {
  readonly id: string
  readonly icon: UiIcon
}

export interface PagesApi {
  /**
   * Register a stable page identity for the actual extension owner without opening it; the
   * returned handle controls future availability.
   */
  register<M extends ViewMethodsConstraint<M> = ViewMethods, N extends object = ViewNotifications>(
    input: PageDefinition<M, N>,
    call?: CallOptions,
  ): Promise<Registration<PageRef & { readonly type: 'extension' }>>

  /** Reuse/focus the caller's open page without repeating setup or replacing the user's draft. */
  open<M extends ViewMethodsConstraint<M> = ViewMethods, N extends object = ViewNotifications>(
    input: { readonly pageId: string },
    call?: CallOptions,
  ): Promise<HostView<M, N>>
}

/** Validate identity syntax only; the host checks the current directory and preserves temporarily unavailable references. */
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
