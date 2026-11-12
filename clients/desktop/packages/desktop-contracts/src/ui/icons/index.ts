/** @fileoverview Validates shared Lucide names and contribution-owned file icon references. */

import * as v from 'valibot'
import { parseExternalValue, parseValue } from '../../validation'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'
import { lucideIconNames } from './names.generated'
import type { LucideIconName } from './names.generated'

export type { LucideIconName } from './names.generated'

const name = v.picklist(lucideIconNames)

/** Parses a name from the host's fixed Lucide catalog, including supported upstream aliases. */
export function parseLucideIconName(input: unknown): LucideIconName {
  return parseValue(name, input, 'Invalid Lucide icon name')
}

/**
 * Contribution icon identified by a built-in name or a file relative to the actual owner's package.
 */
export type ExtensionUiIcon =
  | { readonly type: 'lucide'; readonly name: LucideIconName }
  | { readonly type: 'file'; readonly path: string }

/**
 * Parses a supported Lucide name or validates a package-relative icon path.
 *
 * The host checks file availability and resource ownership.
 */
export function parseExtensionUiIcon(input: unknown): ExtensionUiIcon {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('lucide'), name }),
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
