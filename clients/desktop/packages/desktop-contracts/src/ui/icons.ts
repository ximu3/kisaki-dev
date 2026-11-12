/** @fileoverview Defines contribution-owned icon values independently of components and rendering. */

import * as v from 'valibot'
import { parseExternalValue, parseValue, nonemptyText } from '../validation'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'

/** Icon files are package-relative to the actual contribution owner; component/render callbacks are not accepted. */
export type ExtensionUiIcon =
  { readonly type: 'mdi'; readonly name: string } | { readonly type: 'file'; readonly path: string }

/** MDI name existence is verified against the host's fixed catalog, independently of pure syntax. */
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
