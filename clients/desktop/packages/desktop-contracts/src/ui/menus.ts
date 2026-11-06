/** @fileoverview Defines context-menu contributions, live action callbacks and complete menu value checks. */

import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ExecutionContext, Disposable, NonEmptyArray } from '../operations'
import type { EntryRef } from '../library/catalog'
import type { UiIcon } from './icons'
import type { ToastMessage } from './feedback'
import * as v from 'valibot'
import { parseExternalValue, parseValue, id } from '../validation'
import { normalizeLocalizedText } from '@kisaki3/extension-distribution/metadata'
import { DesktopError } from '../errors'
import { parseUiIcon } from './icons'

export interface MenuItemPresentation {
  readonly label: LocalizedText
  readonly icon?: UiIcon
  readonly disabled?: boolean
}

/** Menu callbacks return completed operation feedback, with no handle for loading updates. */
export type MenuFeedback =
  void | (ToastMessage & { readonly type: Exclude<ToastMessage['type'], 'loading'> })

export type MenuItem =
  | { readonly type: 'separator' }
  | (MenuItemPresentation & {
      readonly type: 'action'
      readonly onSelect: (execution: ExecutionContext) => MenuFeedback | Promise<MenuFeedback>
    })
  | (MenuItemPresentation & {
      readonly type: 'checkbox'
      readonly checked: boolean
      readonly onChange: (
        nextChecked: boolean,
        execution: ExecutionContext,
      ) => MenuFeedback | Promise<MenuFeedback>
    })
  | (MenuItemPresentation & {
      readonly type: 'radio'
      readonly group: string
      readonly checked: boolean
      readonly onSelect: (execution: ExecutionContext) => MenuFeedback | Promise<MenuFeedback>
    })
  | (MenuItemPresentation & { readonly type: 'submenu'; readonly items: readonly MenuItem[] })

export interface MenuContextMap {
  readonly extension: object
  readonly entry: { readonly entries: NonEmptyArray<EntryRef> }
}

export interface MenusApi {
  /** Construction uses fixed local targets and its own signal; selected callbacks outlive menu closure. */
  add<K extends keyof MenuContextMap>(
    contextKind: K,
    getItems: (
      context: MenuContextMap[K],
      call: ExecutionContext,
    ) => readonly MenuItem[] | Promise<readonly MenuItem[]>,
  ): Disposable
}

/** Validate live callback nodes and sibling radio groups without serializing callbacks or invoking business work. */
export function validateMenuItems(input: unknown, defaultLocale: string): readonly MenuItem[] {
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
    icon: v.exactOptional(v.pipe(v.unknown(), v.transform(parseUiIcon))),
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
            v.transform((value) => validateMenuItems(value, defaultLocale)),
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

  return nodes as readonly MenuItem[]
}
