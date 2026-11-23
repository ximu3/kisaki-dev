import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ExecutionContext, Disposable, CallOptions } from '../operations'
import type { ViewResourcesApi } from '../resources'
import * as v from 'valibot'
import { fromParser, parseExternalValue, parseValue } from '../validation'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'

/** A dot selects the package root; entry is relative to that root and must serve actual HTML. */
export interface ExtensionViewDocument {
  readonly root: string
  readonly entry: string
}

/** The method author validates actual input values. */
export interface ViewMethod {
  readonly input: unknown
  readonly result: unknown
}

export type ViewMethods = Readonly<Record<string, ViewMethod>>

export type ViewNotifications = Readonly<Record<string, unknown>>

export type ViewMethodsConstraint<Methods> = Readonly<Record<keyof Methods, ViewMethod>>

/** Host-side private method registration and notification delivery for one actual view. */
export interface ViewHostIpc<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  /** Accepted calls retain the implementation they acquired. */
  handle<K extends keyof M & string>(
    name: K,
    handler: (
      input: M[K]['input'],
      context: ExecutionContext,
    ) => M[K]['result'] | Promise<M[K]['result']>,
  ): Disposable

  /**
   * Sends a transient notification through this view's channel without acknowledgement or
   * persistent replay.
   */
  send<K extends keyof N & string>(name: K, payload: N[K]): void
}

/** Document-side private requests and transient notification subscriptions for one actual view. */
export interface ViewClientIpc<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  /**
   * Settles when the private call finishes, fails or is cancelled. The transport does not retry it.
   */
  invoke<K extends keyof M & string>(
    name: K,
    ...args: undefined extends M[K]['input']
      ? [input?: M[K]['input'], options?: CallOptions]
      : [input: M[K]['input'], options?: CallOptions]
  ): Promise<M[K]['result']>

  /** Initial business state requires an explicit read. */
  on<K extends keyof N & string>(name: K, listener: (payload: N[K]) => void): Disposable
}

/** Close requests may be refused by unsaved edits; onDispose reports actual release. */
export interface HostView<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  readonly ipc: ViewHostIpc<M, N>

  /**
   * Requests the host's normal close decision, including unsaved-change checks.
   *
   * Actual release is reported through onDispose.
   */
  close(): Promise<void>

  /** Removing the callback leaves the view open. */
  onDispose(cleanup: () => void | Promise<void>): Disposable
}

/** Document-side view resources, coordinated closing and release lifecycle. */
export interface ViewContext {
  readonly resources: ViewResourcesApi

  /** Refusal preserves the view and its unsaved state. */
  close(): Promise<void>

  /**
   * Replaces the view's single close guard, or clears it when undefined is supplied.
   *
   * The handler returns true to allow closing and false to preserve the view.
   */
  setCloseGuard(handler: (() => boolean | Promise<boolean>) | undefined): void

  /** Independent tasks retain their separately owned lifetimes. */
  onDispose(cleanup: () => void | Promise<void>): Disposable
}

/** Package-owned document, localized title and initialization for each created extension view. */
export interface ExtensionViewDefinition<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  readonly title: LocalizedText
  readonly document: ExtensionViewDocument

  /** The frontend connects only after setup succeeds. */
  readonly setup?: (view: HostView<M, N>) => void | Promise<void>
}

export interface ExtensionDialogsApi {
  /**
   * Creates an independent dialog view and resolves when it becomes interactive.
   *
   * User submission and closing happen later through the view's own lifecycle.
   */
  open<M extends ViewMethodsConstraint<M> = ViewMethods, N extends object = ViewNotifications>(
    input: ExtensionViewDefinition<M, N>,
    call?: CallOptions,
  ): Promise<HostView<M, N>>
}

/** The host checks actual containment, symlinks, file bytes and MIME type. */
export function parseExtensionViewDocument(input: unknown): ExtensionViewDocument {
  const path = fromParser((value) =>
    parseExternalValue(parsePackagePath, value, 'Invalid view document path'),
  )
  return parseValue(
    v.strictObject({ root: v.union([v.literal('.'), path]), entry: path }),
    input,
    'Invalid view document',
  )
}
