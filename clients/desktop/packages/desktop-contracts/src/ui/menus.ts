/** @fileoverview Defines context-menu contributions, live action callbacks and complete menu value checks. */

import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ExecutionContext, Disposable, NonEmptyArray } from '../operations'
import type { EntryRef } from '../library/catalog'
import type { ExtensionUiIcon } from './icons'
import type { ToastMessage } from './feedback'
import * as v from 'valibot'
import { parseExternalValue, parseValue, id } from '../validation'
import { normalizeLocalizedText } from '@kisaki3/extension-distribution/metadata'
import { DesktopError } from '../errors'
import { parseExtensionUiIcon } from './icons'

export interface ExtensionMenuItemPresentation {
  readonly label: LocalizedText
  readonly icon?: ExtensionUiIcon
  readonly disabled?: boolean
}

/** Menu callbacks return completed operation feedback, with no handle for loading updates. */
export type ExtensionMenuFeedback =
  void | (ToastMessage & { readonly type: Exclude<ToastMessage['type'], 'loading'> })

/** Node-owned contributions retain live callbacks; each submenu owns its sibling radio groups. */
export type ExtensionMenuItem =
  | { readonly type: 'separator' }
  | (ExtensionMenuItemPresentation & {
      readonly type: 'action'
      readonly onSelect: (
        execution: ExecutionContext,
      ) => ExtensionMenuFeedback | Promise<ExtensionMenuFeedback>
    })
  | (ExtensionMenuItemPresentation & {
      readonly type: 'checkbox'
      readonly checked: boolean
      readonly onChange: (
        nextChecked: boolean,
        execution: ExecutionContext,
      ) => ExtensionMenuFeedback | Promise<ExtensionMenuFeedback>
    })
  | (ExtensionMenuItemPresentation & {
      readonly type: 'radio'
      readonly group: string
      readonly checked: boolean
      readonly onSelect: (
        execution: ExecutionContext,
      ) => ExtensionMenuFeedback | Promise<ExtensionMenuFeedback>
    })
  | (ExtensionMenuItemPresentation & {
      readonly type: 'submenu'
      readonly items: readonly ExtensionMenuItem[]
    })

export interface ExtensionMenuContextMap {
  readonly extension: object
  readonly entry: { readonly entries: NonEmptyArray<EntryRef> }
}

export interface ExtensionMenusApi {
  /** Construction uses fixed local targets and its own signal; selected callbacks outlive menu closure. */
  add<K extends keyof ExtensionMenuContextMap>(
    contextKind: K,
    getItems: (
      context: ExtensionMenuContextMap[K],
      call: ExecutionContext,
    ) => readonly ExtensionMenuItem[] | Promise<readonly ExtensionMenuItem[]>,
  ): Disposable
}

/** Validate live callback nodes and sibling radio groups without serializing callbacks or invoking business work. */
export function validateExtensionMenuItems(
  input: unknown,
  defaultLocale: string,
): readonly ExtensionMenuItem[] {
  const localized = v.pipe(
    v.unknown(),
    v.transform((value) =>
      parseExternalValue(
        (value) => normalizeLocalizedText(value, defaultLocale),
        value,
        'Invalid menu text',
      ),
    ),
  )
  const common = {
    label: localized,
    icon: v.exactOptional(v.pipe(v.unknown(), v.transform(parseExtensionUiIcon))),
    disabled: v.exactOptional(v.boolean()),
  }
  const nodes = parseValue(
    v.array(
      v.variant('type', [
        v.strictObject({ type: v.literal('separator') }),
        v.strictObject({ type: v.literal('action'), ...common, onSelect: v.function() }),
        v.strictObject({
          type: v.literal('checkbox'),
          ...common,
          checked: v.boolean(),
          onChange: v.function(),
        }),
        v.strictObject({
          type: v.literal('radio'),
          ...common,
          group: id,
          checked: v.boolean(),
          onSelect: v.function(),
        }),
        v.strictObject({
          type: v.literal('submenu'),
          ...common,
          items: v.pipe(
            v.unknown(),
            v.transform((value) => validateExtensionMenuItems(value, defaultLocale)),
          ),
        }),
      ]),
    ),
    input,
    'Invalid menu items',
  )

  const checked = new Set<string>()
  for (const node of nodes) {
    if (node.type === 'radio' && node.checked) {
      if (checked.has(node.group)) {
        throw new DesktopError('InvalidInput', 'A radio group has more than one selected item')
      }
      checked.add(node.group)
    }
  }

  return nodes as readonly ExtensionMenuItem[]
}
