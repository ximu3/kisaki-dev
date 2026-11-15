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

/** Localized label, optional icon and disabled state shared by actionable menu nodes. */
export interface ExtensionMenuItemPresentation {
  readonly label: LocalizedText
  readonly icon?: ExtensionUiIcon
  readonly disabled?: boolean
}

/**
 * Optional completion feedback returned by a menu operation.
 *
 * Loading messages require a live handle and are outside this result shape.
 */
export type ExtensionMenuFeedback =
  | void
  | (ToastMessage & { readonly type: Exclude<ToastMessage['type'], 'loading'> })

/**
 * Node-owned menu contribution with live callbacks.
 *
 * Each submenu defines a separate scope for sibling radio groups.
 */
export type ExtensionMenuItem =
  | { readonly type: 'separator' }
  | (ExtensionMenuItemPresentation & {
      readonly type: 'action'
      /** Executes the selected action and returns optional completion feedback. */
      readonly onSelect: (
        execution: ExecutionContext,
      ) => ExtensionMenuFeedback | Promise<ExtensionMenuFeedback>
    })
  | (ExtensionMenuItemPresentation & {
      readonly type: 'checkbox'
      readonly checked: boolean
      /** Handles the requested checked state and returns optional completion feedback. */
      readonly onChange: (
        nextChecked: boolean,
        execution: ExecutionContext,
      ) => ExtensionMenuFeedback | Promise<ExtensionMenuFeedback>
    })
  | (ExtensionMenuItemPresentation & {
      readonly type: 'radio'
      readonly group: string
      readonly checked: boolean
      /** Handles selection of this radio item and returns optional completion feedback. */
      readonly onSelect: (
        execution: ExecutionContext,
      ) => ExtensionMenuFeedback | Promise<ExtensionMenuFeedback>
    })
  | (ExtensionMenuItemPresentation & {
      readonly type: 'submenu'
      readonly items: readonly ExtensionMenuItem[]
    })

/** Fixed native context supplied to extension-wide or selected-entry menu construction. */
export interface ExtensionMenuContextMap {
  readonly extension: object
  readonly entry: { readonly entries: NonEmptyArray<EntryRef> }
}

/** Owner-bound registration of context-menu contribution factories. */
export interface ExtensionMenusApi {
  /**
   * Registers a factory for the selected menu context and returns its removal handle.
   *
   * Construction receives fixed local targets and its own signal. Accepted action callbacks outlive
   * menu closure.
   */
  add<K extends keyof ExtensionMenuContextMap>(
    contextKind: K,
    getItems: (
      context: ExtensionMenuContextMap[K],
      call: ExecutionContext,
    ) => readonly ExtensionMenuItem[] | Promise<readonly ExtensionMenuItem[]>,
  ): Disposable
}

/**
 * Validates menu presentation, live callback shapes and sibling radio-group selection.
 *
 * Callbacks are retained without invoking business operations.
 */
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
