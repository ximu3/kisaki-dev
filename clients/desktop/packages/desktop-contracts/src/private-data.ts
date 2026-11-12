/** @fileoverview Defines extension-owned private JSON and protected secret storage with per-key atomic comparisons. */

import type { JsonValue } from './json'
import type { CallOptions } from './operations'
import * as v from 'valibot'
import { nonemptyText, id, unique, text, parseValue } from './validation'
import { parseJsonValue } from './json'
import { DesktopError } from './errors'

/**
 * Private value and revision obtained from one read.
 *
 * Null outside this snapshot means absence; a stored JSON null remains present.
 */
export interface PrivateValue<T> {
  readonly value: T
  readonly revision: string
}

/**
 * Optional per-key revision precondition.
 *
 * Omission permits an unconditional write, null requires absence, and a string requires that exact
 * revision.
 */
export interface PrivateWriteOptions {
  readonly expectedRevision?: string | null
}

/** Set or delete intent for one owned key with an optional revision precondition. */
export type PrivateMutation<T> = {
  readonly key: string
  readonly expectedRevision?: string | null
} & ({ readonly type: 'set'; readonly value: T } | { readonly type: 'delete' })

/** Atomic batch of private JSON and secret mutations within the actual owner's namespace. */
export interface PrivateCommit {
  readonly values?: readonly PrivateMutation<JsonValue>[]
  readonly secrets?: readonly PrivateMutation<string>[]
}

/**
 * Post-commit revisions for the submitted keys in each store.
 *
 * Sets receive fresh revisions; deleted or absent keys return null. Unrelated keys are omitted.
 */
export interface PrivateCommitResult {
  readonly values: Readonly<Record<string, string | null>>
  readonly secrets: Readonly<Record<string, string | null>>
}

/** Private JSON reads and per-key writes scoped to the actual extension owner. */
export interface PrivateValuesApi {
  /** Reads an owned value and revision, distinguishing absence from a stored JSON null. */
  get(key: string, call?: CallOptions): Promise<PrivateValue<JsonValue> | null>

  /**
   * Commits a JSON value and returns its value with a fresh revision.
   *
   * An optional revision is compared atomically; a mismatch preserves the old value.
   */
  set(
    key: string,
    value: JsonValue,
    options?: PrivateWriteOptions,
    call?: CallOptions,
  ): Promise<PrivateValue<JsonValue>>

  /**
   * Deletes an owned key after its optional revision comparison.
   *
   * An absent key succeeds when no precondition conflicts.
   */
  delete(key: string, options?: PrivateWriteOptions, call?: CallOptions): Promise<void>
}

/**
 * Protected secret storage scoped to the actual extension owner.
 *
 * Only its owning Node instance can read plaintext. Presence and revision reads do not decrypt or
 * establish remote authentication validity.
 */
export interface PrivateSecretsApi {
  /**
   * Decrypts an owned secret for its Node instance.
   *
   * Absence, unavailable protection and unreadable ciphertext remain distinct outcomes.
   */
  get(key: string, call?: CallOptions): Promise<PrivateValue<string> | null>

  /** Reads secret presence and revision without decrypting its value. */
  getState(key: string, call?: CallOptions): Promise<{ readonly revision: string } | null>

  /**
   * Protects and durably commits a secret after its optional revision comparison.
   *
   * Protection failure preserves the old ciphertext.
   */
  set(
    key: string,
    value: string,
    options?: PrivateWriteOptions,
    call?: CallOptions,
  ): Promise<{ readonly revision: string }>

  /**
   * Deletes an owned secret after its optional revision comparison.
   *
   * Remote-provider credentials remain unaffected.
   */
  delete(key: string, options?: PrivateWriteOptions, call?: CallOptions): Promise<void>
}

/** Owner-scoped private stores with atomic commits across JSON values and protected secrets. */
export interface PrivateStorageApi {
  readonly values: PrivateValuesApi
  readonly secrets: PrivateSecretsApi

  /**
   * Prepares protected bytes and atomically commits the submitted keys.
   *
   * Any protection or revision-comparison failure preserves all previous values.
   */
  commit(input: PrivateCommit, call?: CallOptions): Promise<PrivateCommitResult>
}

/**
 * Parses a nonempty mutation batch and requires each store's keys to be unique.
 *
 * Set values follow their store's JSON or text contract; owner identity comes from the actual
 * caller.
 */
export function parsePrivateCommit(input: unknown): PrivateCommit {
  /** Creates set and delete schemas sharing a key and optional revision precondition. */
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
