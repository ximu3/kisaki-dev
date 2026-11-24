import * as v from 'valibot'
import { fromParser, parseExternalValue, parseValue } from '../../validation'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'
import { lucideIconNames, type LucideIconName } from './names.generated'

export type { LucideIconName } from './names.generated'

const name = v.picklist(lucideIconNames)

export function parseLucideIconName(input: unknown): LucideIconName {
  return parseValue(name, input, 'Invalid Lucide icon name')
}

export type ExtensionUiIcon =
  | { readonly type: 'lucide'; readonly name: LucideIconName }
  | { readonly type: 'file'; readonly path: string }

export function parseExtensionUiIcon(input: unknown): ExtensionUiIcon {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('lucide'), name }),
      v.strictObject({
        type: v.literal('file'),
        path: fromParser((value) =>
          parseExternalValue(parsePackagePath, value, 'Invalid icon path'),
        ),
      }),
    ]),
    input,
    'Invalid UI icon',
  )
}
