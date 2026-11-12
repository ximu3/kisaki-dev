/** @fileoverview Defines actual view documents, private calls, initialization and host/document lifetimes. */

import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ExecutionContext, Disposable, CallOptions } from '../operations'
import type { ViewResourcesApi } from '../resources'
import * as v from 'valibot'
import { parseExternalValue, parseValue } from '../validation'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'

/**
 * Package-owned HTML document and its controlled resource root.
 *
 * A dot selects the package root; entry is relative to that root and must serve actual HTML.
 */
export interface ExtensionViewDocument {
  readonly root: string
  readonly entry: string
}

/**
 * Pure input and result descriptor for one view-private method.
 *
 * The method author validates actual input values.
 */
export interface ViewMethod {
  readonly input: unknown
  readonly result: unknown
}

/** Named input and result descriptors for a view's private request channel. */
export type ViewMethods = Readonly<Record<string, ViewMethod>>

/** Named payload types for a view's transient notification channel. */
export type ViewNotifications = Readonly<Record<string, unknown>>

/** Constraint requiring every declared method key to provide an input and result descriptor. */
export type ViewMethodsConstraint<Methods> = Readonly<Record<keyof Methods, ViewMethod>>

/** Host-side private method registration and notification delivery for one actual view. */
export interface ViewHostIpc<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  /**
   * Registers a private method in this view and returns its removal handle.
   *
   * Accepted calls retain the implementation they acquired.
   */
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
   * Invokes the named private operation and waits for its actual result, failure or cancellation.
   *
   * The transport does not automatically retry the operation.
   */
  invoke<K extends keyof M & string>(
    name: K,
    ...args: undefined extends M[K]['input']
      ? [input?: M[K]['input'], options?: CallOptions]
      : [input: M[K]['input'], options?: CallOptions]
  ): Promise<M[K]['result']>

  /**
   * Subscribes to future notifications and returns the subscription lifetime.
   *
   * Initial business state requires an explicit read.
   */
  on<K extends keyof N & string>(name: K, listener: (payload: N[K]) => void): Disposable
}

/**
 * Host-side handle to an actual extension view and its private channel.
 *
 * Close requests may be refused by unsaved edits; onDispose reports actual release.
 */
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

  /**
   * Registers cleanup for actual view release and returns its removal handle.
   *
   * Removing the callback leaves the view open.
   */
  onDispose(cleanup: () => void | Promise<void>): Disposable
}

/** Document-side view resources, coordinated closing and release lifecycle. */
export interface ViewContext {
  readonly resources: ViewResourcesApi

  /**
   * Requests the same host-coordinated close used by the container.
   *
   * Refusal preserves the view and its unsaved state.
   */
  close(): Promise<void>

  /**
   * Replaces the view's single close guard, or clears it when undefined is supplied.
   *
   * The handler returns true to allow closing and false to preserve the view.
   */
  setCloseGuard(handler: (() => boolean | Promise<boolean>) | undefined): void

  /**
   * Registers cleanup for actual document or view release and returns its removal handle.
   *
   * Independent tasks retain their separately owned lifetimes.
   */
  onDispose(cleanup: () => void | Promise<void>): Disposable
}

/** Package-owned document, localized title and initialization for each created extension view. */
export interface ExtensionViewDefinition<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  readonly title: LocalizedText
  readonly document: ExtensionViewDocument

  /**
   * Initializes each newly created view once.
   *
   * The frontend connects only after setup succeeds.
   */
  readonly setup?: (view: HostView<M, N>) => void | Promise<void>
}

/** Creation of independent extension views within host-owned dialogs. */
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

/**
 * Parses package-relative document and root paths.
 *
 * The host checks actual containment, symlinks, file bytes and MIME type.
 */
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
