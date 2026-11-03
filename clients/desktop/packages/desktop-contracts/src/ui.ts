/** @fileoverview Defines native navigation and host-owned extension views, menus and local feedback lifetimes. */

import * as v from 'valibot'
import { normalizeLocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'
import { DesktopError } from './errors'
import type {
  CallOptions,
  Disposable,
  NonEmptyArray,
  ExecutionContext,
  Registration,
} from './operations'
import type { EntryRef } from './library/catalog'
import type { ViewResourcesApi } from './resources'
import { id, nonemptyText, parseExternalValue, parseValue } from './validation'
import { parseNativeViewTarget } from './ui/navigation'
import type { NativeViewTarget, SearchTarget } from './ui/navigation'
import type { PageRef } from './ui/pages'

export { parsePageRef, reconcilePageOrder } from './ui/pages'
export type { PageRef } from './ui/pages'
export {
  parseEntryIdentifier,
  parseEntryViewSelection,
  parseNativeViewTarget,
  parseSearchTarget,
} from './ui/navigation'
export type {
  EntryIdentifier,
  EntryViewSelectionByType,
  EntryViewSelection,
  EntryViewTarget,
  NativeViewTarget,
  SearchTarget,
} from './ui/navigation'

/** Icon files are package-relative to the actual contribution owner; component/render callbacks are not accepted. */
export type UiIcon =
  { readonly type: 'mdi'; readonly name: string } | { readonly type: 'file'; readonly path: string }
/** root is a controlled package directory ('.' means package root); entry is relative to root and must serve actual HTML. */
export interface ViewDocument {
  readonly root: string
  readonly entry: string
}
export interface ToastMessage {
  readonly type: 'info' | 'success' | 'warning' | 'error'
  readonly title: LocalizedText
  readonly description?: LocalizedText
}
export interface ToastHandle {
  update(message: ToastMessage): void
  dismiss(): void
}
export interface ToastApi {
  show(message: ToastMessage, options?: { readonly persistent?: boolean }): ToastHandle
}

/** Shared pure method descriptors give each view its own private request/result association; the author validates actual inputs. */
export interface ViewMethod {
  readonly input: unknown
  readonly result: unknown
}
export type ViewMethods = Readonly<Record<string, ViewMethod>>
export type ViewNotifications = Readonly<Record<string, unknown>>
type ViewMethodsConstraint<Methods> = Readonly<Record<keyof Methods, ViewMethod>>
export interface ViewHostIpc<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  handle<K extends keyof M & string>(
    name: K,
    handler: (
      input: M[K]['input'],
      context: ExecutionContext,
    ) => M[K]['result'] | Promise<M[K]['result']>,
  ): Disposable
  send<K extends keyof N & string>(name: K, payload: N[K]): void
}
export interface ViewClientIpc<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  invoke<K extends keyof M & string>(
    name: K,
    ...args: undefined extends M[K]['input']
      ? [input?: M[K]['input'], options?: CallOptions]
      : [input: M[K]['input'], options?: CallOptions]
  ): Promise<M[K]['result']>
  on<K extends keyof N & string>(name: K, listener: (payload: N[K]) => void): Disposable
}
/** Actual release is announced by onDispose. close requests the normal host decision and can be refused by unsaved edits. */
export interface HostView<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  readonly ipc: ViewHostIpc<M, N>
  close(): Promise<void>
  onDispose(cleanup: () => void | Promise<void>): Disposable
}
export interface ViewContext {
  readonly resources: ViewResourcesApi
  close(): Promise<void>
  /** Replace the one active close guard; undefined clears it, but a handler must return a real boolean. */
  setCloseGuard(handler: (() => boolean | Promise<boolean>) | undefined): void
  onDispose(cleanup: () => void | Promise<void>): Disposable
}
export interface ViewDefinition<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  readonly title: LocalizedText
  readonly document: ViewDocument
  /** Run once per newly created actual view; the frontend is connected only after successful setup. */
  readonly setup?: (view: HostView<M, N>) => void | Promise<void>
}
export interface PageDefinition<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> extends ViewDefinition<M, N> {
  readonly id: string
  readonly icon: UiIcon
}
export interface PagesApi {
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
export interface DialogsApi {
  /** Each call creates an independent view and resolves when interactive, not when the user closes or submits. */
  open<M extends ViewMethodsConstraint<M> = ViewMethods, N extends object = ViewNotifications>(
    input: ViewDefinition<M, N>,
    call?: CallOptions,
  ): Promise<HostView<M, N>>
}
export interface MenuItemPresentation {
  readonly label: LocalizedText
  readonly icon?: UiIcon
  readonly disabled?: boolean
}
export type MenuFeedback = void | ToastMessage
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
export interface NotificationMessage {
  readonly title: string
  readonly body: string
  readonly open?: NativeViewTarget
}
export interface NotificationsApi {
  /** accepted means OS delivery acceptance only; unavailable never silently falls back to a Toast. */
  show(message: NotificationMessage, call?: CallOptions): Promise<'accepted' | 'unavailable'>
}
/** The native module owns complete UI contracts; SDK/window entrypoints explicitly select their authorized subset. */
export interface UiApi {
  readonly pages: PagesApi
  readonly dialogs: DialogsApi
  readonly menus: MenusApi
  readonly toast: ToastApi
  navigate(target: NativeViewTarget | SearchTarget, call?: CallOptions): Promise<void>
  /** Wait only for the main-window search panel to become visible; content windows do not expose this operation. */
  openSearch(call?: CallOptions): Promise<void>
  openExternal(url: string, call?: CallOptions): Promise<void>
}

/** Validate a package document; actual containment, symlinks, bytes and MIME are checked by the host. */
export function parseViewDocument(input: unknown): ViewDocument {
  const path = v.pipe(
    v.unknown(),
    v.transform((value) =>
      parseExternalValue(parsePackagePath, value, 'Invalid view document path'),
    ),
  )
  return parseValue(
    v.strictObject({ root: v.union([v.literal('.'), path]), entry: path }),
    input,
    'Invalid view document',
  )
}
/** MDI name existence is verified against the host's fixed catalog, independently of pure syntax. */
export function parseUiIcon(input: unknown): UiIcon {
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
/** Static text follows the contribution owner's default locale and never interprets application message keys. */
export function parseToastMessage(input: unknown, defaultLocale: string): ToastMessage {
  const localized = v.pipe(
    v.unknown(),
    v.transform((value) =>
      parseExternalValue(
        (value) => normalizeLocalizedText(value, defaultLocale),
        value,
        'Invalid UI text',
      ),
    ),
  )
  return parseValue(
    v.strictObject({
      type: v.picklist(['info', 'success', 'warning', 'error']),
      title: localized,
      description: v.exactOptional(localized),
    }),
    input,
    'Invalid Toast message',
  )
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
/** A notification contains only safe display text and an optional existing native navigation intent. */
export function parseNotificationMessage(input: unknown): NotificationMessage {
  return parseValue(
    v.strictObject({
      title: nonemptyText,
      body: nonemptyText,
      open: v.exactOptional(v.pipe(v.unknown(), v.transform(parseNativeViewTarget))),
    }),
    input,
    'Invalid notification message',
  )
}
