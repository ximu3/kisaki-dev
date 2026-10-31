/** @fileoverview Defines instance-owned UI contributions, view-private communication, and explicit interaction lifetimes. */

import * as v from 'valibot'
import { parsePackagePath } from '@kisaki3/extension-distribution/identity'
import { localizedTextSchema, type LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type {
  AsyncDisposable,
  CallOptions,
  Disposable,
  ExecutionContext,
  ParticipationContext,
  Registration,
} from '../execution'
import { invalidInput } from '../errors'
import type { EntryRef } from '../library/identity'
import type { ReadResourceRef, ViewResourceBinding } from '../resources'
import { objectSchema } from '../schema'
import { nonemptyStringSchema, parseContract } from '../validation'
import type { NativeViewTarget } from './navigation'
import type { PageRef } from './pages'

/** Runtime contribution icons resolve in their real owner's package; arbitrary components are not accepted. */
export type UiIcon =
  { readonly type: 'mdi'; readonly name: string } | { readonly type: 'file'; readonly path: string }
export interface UiDocument {
  readonly root: string
  readonly entry: string
}
export interface ToastMessage {
  readonly type: 'info' | 'success' | 'warning' | 'error'
  readonly title: LocalizedText
  readonly description?: LocalizedText
}
export interface ToastHandle {
  /** Replace this still-live notice; updating a user-dismissed notice does not recreate it. */
  update(message: ToastMessage): void
  /** Dismiss this notice, idempotently, without changing any independent field validation state. */
  dismiss(): void
}
export interface ToastApi {
  /** Display one view-owned notice; persistent notices remain until dismissal or actual owner release. */
  show(message: ToastMessage, options?: { readonly persistent?: boolean }): ToastHandle
}
/** The author shares a finite method map between Node and its own frontend; handlers still validate external input. */
export interface PrivateMethod {
  readonly input: unknown
  readonly result: unknown
}
export interface NodeViewIpc<
  Methods extends { [Key in keyof Methods]: PrivateMethod } = Record<string, PrivateMethod>,
  Notices extends object = Record<string, unknown>,
> {
  /** Register one unique method on this view; disposal removes it for subsequent calls without replaying accepted work. */
  handle<Name extends keyof Methods & string>(
    name: Name,
    handler: (
      input: Methods[Name]['input'],
      context: ExecutionContext,
    ) => Methods[Name]['result'] | Promise<Methods[Name]['result']>,
  ): Disposable
  /** Send a short no-response private notice to this view's current document. */
  send<Name extends keyof Notices & string>(name: Name, payload: Notices[Name]): void
}
export interface WebviewIpc<
  Methods extends { [Key in keyof Methods]: PrivateMethod } = Record<string, PrivateMethod>,
  Notices extends object = Record<string, unknown>,
> {
  /** Invoke a method declared by this view's actual Node owner; cancellation waits for the method's actual outcome. */
  invoke<Name extends keyof Methods & string>(
    name: Name,
    ...args: undefined extends Methods[Name]['input']
      ? [input?: Methods[Name]['input'], call?: CallOptions]
      : [input: Methods[Name]['input'], call?: CallOptions]
  ): Promise<Methods[Name]['result']>
  /** Subscribe to this document's private notices; disposal stops delivery only. */
  on<Name extends keyof Notices & string>(
    name: Name,
    listener: (payload: Notices[Name]) => void,
  ): Disposable
}
/** An actual Node view survives ordinary document refresh; it never migrates to another extension instance. */
export interface NodeView<
  Methods extends { [Key in keyof Methods]: PrivateMethod } = Record<string, PrivateMethod>,
  Notices extends object = Record<string, unknown>,
> {
  readonly ipc: NodeViewIpc<Methods, Notices>
  readonly resources: {
    /** Bind already acquired content into this actual view, preserving aliases and independent occupancy. */
    bind(
      resources: Readonly<Record<string, ReadResourceRef>>,
      call?: CallOptions,
    ): Promise<ViewResourceBinding>
  }
  /** Request normal host close/guard coordination; actual release is reported only through onDispose. */
  close(call?: CallOptions): Promise<void>
  /** Run this view's cleanup on actual release, and immediately when registered after release. */
  onDispose(cleanup: () => void | Promise<void>): Disposable
}
export interface PageDefinition<
  Methods extends { [Key in keyof Methods]: PrivateMethod } = Record<string, PrivateMethod>,
  Notices extends object = Record<string, unknown>,
> {
  readonly ref: Extract<PageRef, { type: 'extension' }>
  readonly title: LocalizedText
  readonly icon: UiIcon
  readonly document: UiDocument
  readonly setup?: (view: NodeView<Methods, Notices>) => void | Promise<void>
}
export interface DialogDefinition<
  Methods extends { [Key in keyof Methods]: PrivateMethod } = Record<string, PrivateMethod>,
  Notices extends object = Record<string, unknown>,
> {
  readonly title: LocalizedText
  readonly document: UiDocument
  readonly setup?: (view: NodeView<Methods, Notices>) => void | Promise<void>
}
export interface MenuContextMap {
  readonly extension: { readonly extensionId: string }
  readonly entry: { readonly entries: readonly [EntryRef, ...EntryRef[]] }
}
export type MenuContextKind = keyof MenuContextMap
interface MenuLabel {
  readonly label: LocalizedText
  readonly icon?: UiIcon
  readonly disabled?: boolean
}
export type MenuActionResult = void | ToastMessage
/** Radio groups are local to one sibling list; selected actions have a lifetime independent of menu construction. */
export type MenuItem =
  | (MenuLabel & {
      readonly type: 'action'
      readonly onSelect: (
        execution: ExecutionContext,
      ) => MenuActionResult | Promise<MenuActionResult>
    })
  | (MenuLabel & {
      readonly type: 'checkbox'
      readonly checked: boolean
      readonly onChange: (
        nextChecked: boolean,
        execution: ExecutionContext,
      ) => MenuActionResult | Promise<MenuActionResult>
    })
  | (MenuLabel & {
      readonly type: 'radio'
      readonly group: string
      readonly checked: boolean
      readonly onSelect: (
        execution: ExecutionContext,
      ) => MenuActionResult | Promise<MenuActionResult>
    })
  | { readonly type: 'separator' }
  | (MenuLabel & { readonly type: 'submenu'; readonly items: readonly MenuItem[] })
export interface MenusApi {
  /** Contribute to one actual menu kind using its fixed target snapshot; disposing stops future construction. */
  add<Kind extends MenuContextKind>(
    kind: Kind,
    getItems: (
      context: MenuContextMap[Kind],
      call: ParticipationContext,
    ) => readonly MenuItem[] | Promise<readonly MenuItem[]>,
  ): Promise<AsyncDisposable>
}
export interface UiApi {
  readonly pages: {
    /** Publish one stable full page identity; setup is awaited only for newly created actual views. */
    register(definition: PageDefinition, call?: CallOptions): Promise<Registration<PageRef>>
    /** Open or focus the named page; only the real owner's endpoint can receive its private view handle. */
    open(ref: PageRef, call?: CallOptions): Promise<NodeView>
  }
  readonly dialogs: {
    /** Create an independent temporary view and await setup plus interactivity, not user selection or closing. */
    open(definition: DialogDefinition, call?: CallOptions): Promise<NodeView>
  }
  readonly menus: MenusApi
  /** Wait for the actual native target to accept navigation; this never implicitly starts content or saves data. */
  navigate(target: NativeViewTarget, call?: CallOptions): Promise<void>
  /** Validate an explicit credential-free HTTP(S) URL and request the system browser to open it. */
  openExternal(url: string, call?: CallOptions): Promise<void>
}
export interface NotificationsApi {
  /** Await system acceptance, or return unavailable; a delivery failure rejects and is never rerouted to another UI channel. */
  show(
    input: { readonly title: string; readonly body: string; readonly open?: NativeViewTarget },
    call?: CallOptions,
  ): Promise<'accepted' | 'unavailable'>
}

const packagePath = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      parsePackagePath(value)
      return true
    } catch {
      return false
    }
  }),
)
const iconSchema = v.union([
  objectSchema({ type: v.literal('mdi'), name: nonemptyStringSchema }),
  objectSchema({ type: v.literal('file'), path: packagePath }),
])
/** Validate a document's package-relative scope; the host must still verify actual files and reject escaping links. */
export function parseUiDocument(input: unknown): UiDocument {
  return parseContract(
    objectSchema({ root: v.union([v.literal('.'), packagePath]), entry: packagePath }),
    input,
    'UI document',
  )
}
/** Validate icon addressing without treating it as a browser URL or component name. */
export function parseUiIcon(input: unknown): UiIcon {
  return parseContract(iconSchema, input, 'UI icon')
}
/** Validate the finite feedback structure; business callbacks and results are not toast fields. */
export function parseToastMessage(input: unknown): ToastMessage {
  return parseContract(
    objectSchema({
      type: v.picklist(['info', 'success', 'warning', 'error']),
      title: localizedTextSchema,
      description: v.exactOptional(localizedTextSchema),
    }),
    input,
    'toast message',
  )
}
/** Validate the exact external-open policy before handing a URL to the system. */
export function parseExternalUrl(input: unknown): string {
  const text = parseContract(nonemptyStringSchema, input, 'external URL')
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return invalidInput('The external URL is invalid.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    return invalidInput('The external URL must use HTTP(S) without credentials.')
  }
  return url.href
}
/** Check sibling radio exclusivity recursively after the menu's typed contribution has been constructed. */
export function validateMenuGroups(items: readonly MenuItem[]): void {
  const selected = new Set<string>()
  for (const item of items) {
    if (item.type === 'radio' && item.checked) {
      if (selected.has(item.group)) {
        invalidInput('A menu radio group has multiple selected items.')
      }
      selected.add(item.group)
    }
    if (item.type === 'submenu') {
      validateMenuGroups(item.items)
    }
  }
}

const menuLabelFields = {
  label: localizedTextSchema,
  icon: v.exactOptional(iconSchema),
  disabled: v.exactOptional(v.boolean()),
}
const selectHandler = v.custom<Extract<MenuItem, { type: 'action' }>['onSelect']>(
  (value) => typeof value === 'function',
)
const changeHandler = v.custom<Extract<MenuItem, { type: 'checkbox' }>['onChange']>(
  (value) => typeof value === 'function',
)
const menuItemSchema: v.GenericSchema<unknown, MenuItem> = v.lazy(() =>
  v.union([
    objectSchema({ type: v.literal('action'), ...menuLabelFields, onSelect: selectHandler }),
    objectSchema({
      type: v.literal('checkbox'),
      ...menuLabelFields,
      checked: v.boolean(),
      onChange: changeHandler,
    }),
    objectSchema({
      type: v.literal('radio'),
      ...menuLabelFields,
      group: nonemptyStringSchema,
      checked: v.boolean(),
      onSelect: selectHandler,
    }),
    objectSchema({ type: v.literal('separator') }),
    objectSchema({
      type: v.literal('submenu'),
      ...menuLabelFields,
      items: v.pipe(v.array(menuItemSchema), v.readonly()),
    }),
  ]),
)
/** Validate constructed menu values and their callable slots before binding callbacks to the actual menu lifetime. */
export function parseMenuItems(input: unknown): readonly MenuItem[] {
  const items = parseContract(v.pipe(v.array(menuItemSchema), v.readonly()), input, 'menu items')
  validateMenuGroups(items)
  return items
}
