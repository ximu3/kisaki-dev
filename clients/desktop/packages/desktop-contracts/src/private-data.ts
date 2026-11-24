import type { CallOptions, KeyedResult } from './operations'
import * as v from 'valibot'
import { fromParser, nonemptyText, id, unique, text, parseValue } from './validation'
import { parseJsonValue, type JsonValue } from './json'
import { DesktopError } from './errors'

export interface PrivateValue<T> {
  readonly value: T
  readonly revision: string
}

export interface PrivateWriteOptions {
  readonly expectedRevision?: string | null
}

export type PrivateMutation<T> = {
  readonly key: string
  readonly expectedRevision?: string | null
} & ({ readonly type: 'set'; readonly value: T } | { readonly type: 'delete' })

export interface PrivateCommit {
  readonly values?: readonly PrivateMutation<JsonValue>[]
  readonly secrets?: readonly PrivateMutation<string>[]
}

type SubmittedMutations<Items> = Items extends readonly (infer Mutation)[]
  ? Extract<Mutation, PrivateMutation<JsonValue>>
  : never

export interface PrivateCommitResult<I extends PrivateCommit = PrivateCommit> {
  readonly values: KeyedResult<
    I['values'],
    {
      readonly [
        Mutation in SubmittedMutations<I['values']> as Mutation['key']
      ]: Mutation['type'] extends 'set' ? string : null
    }
  >
  readonly secrets: KeyedResult<
    I['secrets'],
    {
      readonly [
        Mutation in SubmittedMutations<I['secrets']> as Mutation['key']
      ]: Mutation['type'] extends 'set' ? string : null
    }
  >
}

export interface PrivateValuesApi {
  get(key: string, call?: CallOptions): Promise<PrivateValue<JsonValue> | null>

  set<T extends JsonValue>(
    key: string,
    value: T,
    options?: PrivateWriteOptions,
    call?: CallOptions,
  ): Promise<PrivateValue<T>>

  delete(key: string, options?: PrivateWriteOptions, call?: CallOptions): Promise<void>
}

export interface PrivateSecretsApi {
  get(key: string, call?: CallOptions): Promise<PrivateValue<string> | null>

  getState(key: string, call?: CallOptions): Promise<{ readonly revision: string } | null>

  set(
    key: string,
    value: string,
    options?: PrivateWriteOptions,
    call?: CallOptions,
  ): Promise<{ readonly revision: string }>

  delete(key: string, options?: PrivateWriteOptions, call?: CallOptions): Promise<void>
}

export interface PrivateStorageApi {
  readonly values: PrivateValuesApi
  readonly secrets: PrivateSecretsApi

  commit<const I extends PrivateCommit>(
    input: I,
    call?: CallOptions,
  ): Promise<PrivateCommitResult<I>>
}

export function parsePrivateCommit(input: unknown): PrivateCommit {
  const mutation = <T extends v.GenericSchema>(value: T) =>
    v.variant('type', [
      v.strictObject({
        type: v.literal('set'),
        key: nonemptyText,
        value,
        expectedRevision: v.exactOptional(v.nullable(id)),
      }),
      v.strictObject({
        type: v.literal('delete'),
        key: nonemptyText,
        expectedRevision: v.exactOptional(v.nullable(id)),
      }),
    ])

  const values = v.pipe(
    v.array(mutation(fromParser(parseJsonValue))),
    v.check((items) => unique(items, (item) => item.key)),
  )
  const secrets = v.pipe(
    v.array(mutation(text)),
    v.check((items) => unique(items, (item) => item.key)),
  )

  const result = parseValue(
    v.strictObject({ values: v.exactOptional(values), secrets: v.exactOptional(secrets) }),
    input,
    'Invalid private storage commit',
  )
  if ((result.values?.length ?? 0) + (result.secrets?.length ?? 0) === 0) {
    throw new DesktopError('InvalidInput', 'A private commit requires at least one mutation')
  }

  return result
}
