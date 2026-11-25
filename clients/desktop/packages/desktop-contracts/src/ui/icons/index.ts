import * as v from 'valibot'
import { fromParser, parseExternalValue, parseValue } from '../../validation'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'
import { mdiIconNames, type MdiIconName } from './names.generated'

export type { MdiIconName } from './names.generated'

const names = new Set<string>(mdiIconNames)
const name = v.custom<MdiIconName>((input) => typeof input === 'string' && names.has(input))

export function parseMdiIconName(input: unknown): MdiIconName {
  return parseValue(name, input, 'Invalid MDI icon name')
}

export type ExtensionUiIcon =
  | { readonly type: 'mdi'; readonly name: MdiIconName }
  | { readonly type: 'file'; readonly path: string }

export function parseExtensionUiIcon(input: unknown): ExtensionUiIcon {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('mdi'), name }),
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
