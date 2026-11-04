/** @fileoverview Defines instance-owned private JSON and protected secret storage with per-key atomic comparisons. */

import type { JsonValue } from './json'
import type { CallOptions } from './operations'
import * as v from 'valibot'
import { nonemptyText, id, unique, text, parseValue } from './validation'
import { parseJsonValue } from './json'
import { DesktopError } from './errors'

/** Value and revision are from one read. Null outside the snapshot means absent; a JSON null value remains present. */
export interface PrivateValue<T> {
  readonly value: T
  readonly revision: string
}

/** Omit the comparison for an unconditional write; null requires absence, and a string requires that exact revision. */
export interface PrivateWriteOptions {
  readonly expectedRevision?: string | null
}

/** One owned key change; expectedRevision follows PrivateWriteOptions and does not lock unrelated keys. */
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
  /**
   * Read one value and revision from the actual owner's namespace; absence differs from a stored
   * JSON null.
   */
  get(key: string, call?: CallOptions): Promise<PrivateValue<JsonValue> | null>

  /**
   * Commit one JSON value and return a fresh revision; a supplied revision is compared
   * atomically and mismatch preserves the old value.
   */
  set(
    key: string,
    value: JsonValue,
    options?: PrivateWriteOptions,
    call?: CallOptions,
  ): Promise<PrivateValue<JsonValue>>

  /**
   * Delete one owned key after its optional revision comparison; an absent key succeeds when no
   * condition conflicts.
   */
  delete(key: string, options?: PrivateWriteOptions, call?: CallOptions): Promise<void>
}

/** Only the owning Node instance can read secret text; status does not decrypt or claim remote authentication validity. */
export interface PrivateSecretsApi {
  /**
   * Decrypt an owned secret for its Node instance; absence, unavailable protection and
   * unreadable ciphertext remain distinct.
   */
  get(key: string, call?: CallOptions): Promise<PrivateValue<string> | null>

  /**
   * Read presence and revision without decrypting or claiming that remote authorization is still
   * valid.
   */
  getState(key: string, call?: CallOptions): Promise<{ readonly revision: string } | null>

  /**
   * Protect and durably commit the secret with its optional revision comparison; protection
   * failure preserves the old ciphertext.
   */
  set(
    key: string,
    value: string,
    options?: PrivateWriteOptions,
    call?: CallOptions,
  ): Promise<{ readonly revision: string }>

  /**
   * Remove one owned secret after its optional revision comparison; this does not revoke
   * credentials at the remote provider.
   */
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
