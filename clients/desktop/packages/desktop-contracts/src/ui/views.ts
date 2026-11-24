import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ExecutionContext, Disposable, CallOptions } from '../operations'
import type { ViewResourcesApi } from '../resources'
import * as v from 'valibot'
import { fromParser, parseExternalValue, parseValue } from '../validation'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'

export interface ExtensionViewDocument {
  readonly root: string
  readonly entry: string
}

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

  setCloseGuard(handler: (() => boolean | Promise<boolean>) | undefined): void

  onDispose(cleanup: () => void | Promise<void>): Disposable
}

export interface ExtensionViewDefinition<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> {
  readonly title: LocalizedText
  readonly document: ExtensionViewDocument

  readonly setup?: (view: HostView<M, N>) => void | Promise<void>
}

export interface ExtensionDialogsApi {
  open<M extends ViewMethodsConstraint<M> = ViewMethods, N extends object = ViewNotifications>(
    input: ExtensionViewDefinition<M, N>,
    call?: CallOptions,
  ): Promise<HostView<M, N>>
}

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
