/** @fileoverview Defines contribution-owned icon values independently of components and rendering. */

import * as v from 'valibot'
import { parseExternalValue, parseValue, nonemptyText } from '../validation'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'

/**
 * Contribution icon identified by a built-in name or a file relative to the actual owner's package.
 */
export type ExtensionUiIcon =
  { readonly type: 'mdi'; readonly name: string } | { readonly type: 'file'; readonly path: string }

/**
 * Parses an icon value and validates package-relative file paths.
 *
 * The host checks built-in name existence against its fixed catalog.
 */
export function parseExtensionUiIcon(input: unknown): ExtensionUiIcon {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('mdi'), name: nonemptyText }),
      v.strictObject({
        type: v.literal('file'),
        path: v.pipe(
          v.unknown(),
          v.transform((value) => parseExternalValue(parsePackagePath, value, 'Invalid icon path')),
        ),
      }),
    ]),
    input,
    'Invalid UI icon',
  )
}
