/** @fileoverview Defines instance-owned private JSON and protected secret storage with per-key atomic comparisons. */

import * as v from 'valibot'
import { DesktopError } from './errors'
import { parseJsonValue } from './json'
import type { JsonValue } from './json'
import type { CallOptions } from './operations'
import { id, nonemptyText, parseValue, text, unique } from './validation'

/** Value and revision are from one read. Null outside the snapshot means absent; a JSON null value remains present. */
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

/** Successful sets get fresh revisions. Deleted/missing keys have null, and unrelated keys are not returned or locked. */
export interface PrivateCommitResult {
  readonly values: Readonly<Record<string, string | null>>
  readonly secrets: Readonly<Record<string, string | null>>
}

export interface PrivateValuesApi {
  get(key: string, call?: CallOptions): Promise<PrivateValue<JsonValue> | null>

  set(
    key: string,
    value: JsonValue,
    options?: PrivateWriteOptions,
    call?: CallOptions,
  ): Promise<PrivateValue<JsonValue>>
  delete(key: string, options?: PrivateWriteOptions, call?: CallOptions): Promise<void>
}

/** Only the owning Node instance can read secret text; status does not decrypt or claim remote authentication validity. */
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

  /** Prepare protected bytes before a short all-or-nothing commit; any comparison/protection failure preserves all old keys. */
  commit(input: PrivateCommit, call?: CallOptions): Promise<PrivateCommitResult>
}

/** Do not accept an extensionId, transaction callback, undefined value or repeated mutation of the same store/key. */
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
    v.array(mutation(v.pipe(v.unknown(), v.transform(parseJsonValue)))),
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
