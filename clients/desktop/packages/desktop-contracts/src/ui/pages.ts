/** @fileoverview Defines stable navigation identity independently of routes, view instances and current availability. */

import * as v from 'valibot'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { id, parseExternalValue, parseValue } from '../validation'

/** Native IDs name the actual application page catalog; extension pages keep the complete owner/local identity. */
export type PageRef =
  | { readonly type: 'native'; readonly id: string }
  | { readonly type: 'extension'; readonly extensionId: string; readonly pageId: string }

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

/** Append newly registered pages without disturbing saved positions or removing unavailable ones. */
export function reconcilePageOrder(
  saved: readonly PageRef[],
  available: readonly PageRef[],
): readonly PageRef[] {
  const key = (page: PageRef) =>
    JSON.stringify(
      page.type === 'native' ? ['native', page.id] : ['extension', page.extensionId, page.pageId],
    )
  const seen = new Set(saved.map(key))
  return [
    ...saved,
    ...available.filter((page) => {
      const identity = key(page)
      if (seen.has(identity)) {
        return false
      }
      seen.add(identity)
      return true
    }),
  ]
}
