/** @fileoverview Defines actual view documents, private calls, initialization and host/document lifetimes. */

import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ExecutionContext, Disposable, CallOptions } from '../operations'
import type { ViewResourcesApi } from '../resources'
import * as v from 'valibot'
import { parseExternalValue, parseValue } from '../validation'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'

/** root is a controlled package directory ('.' means package root); entry is relative to root and must serve actual HTML. */
export interface ExtensionViewDocument {
  readonly root: string
  readonly entry: string
}

/** Shared pure method descriptors give each view its own private request/result association; the author validates actual inputs. */
export interface ViewMethod {
  readonly input: unknown
  readonly result: unknown
}

export type ViewMethods = Readonly<Record<string, ViewMethod>>

export type ViewNotifications = Readonly<Record<string, unknown>>

export type ViewMethodsConstraint<Methods> = Readonly<Record<keyof Methods, ViewMethod>>

export interface ViewHostIpc<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  /**
   * Register one private method in this actual view and return its removal handle; accepted
   * calls retain their original implementation.
   */
  handle<K extends keyof M & string>(
    name: K,
    handler: (
      input: M[K]['input'],
      context: ExecutionContext,
    ) => M[K]['result'] | Promise<M[K]['result']>,
  ): Disposable

  /**
   * Send a transient notification only through this view's channel, without an acknowledgement
   * or persistent replay.
   */
  send<K extends keyof N & string>(name: K, payload: N[K]): void
}

export interface ViewClientIpc<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  /**
   * Wait for the named private operation's actual result, failure or cancellation; the transport
   * does not automatically retry it.
   */
  invoke<K extends keyof M & string>(
    name: K,
    ...args: undefined extends M[K]['input']
      ? [input?: M[K]['input'], options?: CallOptions]
      : [input: M[K]['input'], options?: CallOptions]
  ): Promise<M[K]['result']>

  /**
   * Subscribe to future transient notifications for this actual view; initial business state
   * must be read explicitly.
   */
  on<K extends keyof N & string>(name: K, listener: (payload: N[K]) => void): Disposable
}

/** Actual release is announced by onDispose. close requests the normal host decision and can be refused by unsaved edits. */
export interface HostView<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  readonly ipc: ViewHostIpc<M, N>

  /**
   * Request the host's normal close decision, including unsaved-change checks; observe onDispose
   * for actual release.
   */
  close(): Promise<void>

  /**
   * Register cleanup for actual view release rather than a close request; removing this callback
   * does not close the view.
   */
  onDispose(cleanup: () => void | Promise<void>): Disposable
}

export interface ViewContext {
  readonly resources: ViewResourcesApi

  /**
   * Request the same host-coordinated close used by the container; refusal preserves the view
   * and its unsaved state.
   */
  close(): Promise<void>

  /** Replace the one active close guard; undefined clears it, but a handler must return a real boolean. */
  setCloseGuard(handler: (() => boolean | Promise<boolean>) | undefined): void

  /**
   * Register cleanup for actual document/view release; independent tasks keep their separately
   * owned lifetime.
   */
  onDispose(cleanup: () => void | Promise<void>): Disposable
}

/** A package-owned document and initialization belong to each actual view created for this extension. */
export interface ExtensionViewDefinition<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  readonly title: LocalizedText
  readonly document: ExtensionViewDocument

  /** Run once per newly created actual view; the frontend is connected only after successful setup. */
  readonly setup?: (view: HostView<M, N>) => void | Promise<void>
}

export interface ExtensionDialogsApi {
  /** Each call creates an independent view and resolves when interactive, not when the user closes or submits. */
  open<M extends ViewMethodsConstraint<M> = ViewMethods, N extends object = ViewNotifications>(
    input: ExtensionViewDefinition<M, N>,
    call?: CallOptions,
  ): Promise<HostView<M, N>>
}

/** Validate a package document; actual containment, symlinks, bytes and MIME are checked by the host. */
export function parseExtensionViewDocument(input: unknown): ExtensionViewDocument {
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
