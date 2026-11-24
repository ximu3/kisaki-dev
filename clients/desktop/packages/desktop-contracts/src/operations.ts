import type { ErrorSummary } from './errors'
import { parseValue, intervalEntries } from './validation'
import * as v from 'valibot'

export type NonEmptyArray<T> = readonly [T, ...T[]]

export type Bounds<T> =
  | { readonly min: T; readonly max?: T }
  | { readonly min?: T; readonly max: T }

export interface CallOptions {
  readonly signal?: AbortSignal
}

export interface Registration<Ref> {
  readonly ref: Ref

  dispose(): Promise<void>
}

export interface ExecutionContext {
  readonly signal: AbortSignal
}

export interface Disposable {
  dispose(): void | Promise<void>
}

export type Listener<T> = (value: T) => void

export interface ListOptions {
  readonly offset: number
  readonly limit: number
}

export interface ListResult<T> {
  readonly items: readonly T[]
  readonly total: number
}

export type KeyedResult<
  Items extends readonly { readonly key: string }[] | undefined,
  Values extends object,
> = string extends keyof Values
  ? Values
  : Items extends readonly { readonly key: string }[]
    ? number extends Items['length']
      ? Partial<Values>
      : Partial<Values> & {
          readonly [
            K in keyof Values as Extract<Items[number], { readonly key: K }> extends never
              ? never
              : K
          ]-?: Values[K]
        }
    : Partial<Values>

export type StoredDefinition<T> =
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'invalid'; readonly error: ErrorSummary }

export function parseListOptions(input: unknown): ListOptions {
  return parseValue(v.strictObject(intervalEntries), input, 'Invalid list interval')
}
