/** @fileoverview Defines instance-owned private JSON, protected secrets, and atomic key revision comparisons. */

import * as v from 'valibot'
import type { CallOptions } from '@kisaki3/desktop-contracts/execution'
import { parseJsonValue, type JsonValue } from '@kisaki3/desktop-contracts/json'
import { objectSchema, nonemptyString, parse } from '../schema'

/** A key value and its revision belong to the same read snapshot; null means the key is absent. */
export interface StoredValue {
  readonly value: JsonValue
  readonly revision: string
}
/** Configured secret metadata contains no plaintext; its revision belongs to that exact protected value. */
export interface SecretState {
  readonly revision: string
}
/** Omission allows last-commit-wins; null requires absence and a string requires that exact saved revision. */
export interface StorageWriteOptions {
  readonly expectedRevision?: string | null
}
/** One complete namespace-local key change; revisions follow StorageWriteOptions and are not user-selected new revisions. */
export type StorageMutation = {
  readonly key: string
  readonly expectedRevision?: string | null
} & ({ readonly type: 'set'; readonly value: JsonValue } | { readonly type: 'delete' })
/** All selected ordinary and protected keys form one commit; each namespace may name a key only once. */
export interface StorageCommit {
  readonly values?: readonly StorageMutation[]
  readonly secrets?: readonly StorageMutation[]
}
/** Only committed keys are reported, with their new revisions; null marks an absent key after deletion. */
export interface StorageCommitResult {
  readonly values: readonly { readonly key: string; readonly revision: string | null }[]
  readonly secrets: readonly { readonly key: string; readonly revision: string | null }[]
}
/** Only the actual extension instance selects the namespace. Webviews receive no raw storage or secret capability. */
export interface StorageApi {
  readonly values: {
    /** Read one complete ordinary JSON key and its revision, or null. */
    get(key: string, call?: CallOptions): Promise<StoredValue | null>
    /** Save a complete key value; an omitted revision uses last-commit-wins semantics. */
    set(
      key: string,
      value: JsonValue,
      options?: StorageWriteOptions,
      call?: CallOptions,
    ): Promise<{ readonly revision: string }>
    /** Delete only this key after any explicit condition check; absence with a matching condition is unchanged success. */
    delete(key: string, options?: StorageWriteOptions, call?: CallOptions): Promise<void>
  }
  readonly secrets: {
    /** Read configured state and its revision without decrypting or exposing secret material. */
    get(key: string, call?: CallOptions): Promise<SecretState | null>
    /** Node-only decryption; protection failure or unreadable ciphertext is an error, never a missing credential. */
    read(key: string, call?: CallOptions): Promise<StoredValue | null>
    /** Protect the complete new value before commit; failure retains existing ciphertext. */
    set(
      key: string,
      value: JsonValue,
      options?: StorageWriteOptions,
      call?: CallOptions,
    ): Promise<SecretState>
    /** Remove only this protected key under its explicit optional revision condition. */
    delete(key: string, options?: StorageWriteOptions, call?: CallOptions): Promise<void>
  }
  /** Prepare encryption outside the transaction, then check all related revisions and commit ordinary/secret keys atomically. */
  commit(input: StorageCommit, call?: CallOptions): Promise<StorageCommitResult>
}
const mutation = v.union([
  objectSchema({
    type: v.literal('set'),
    key: nonemptyString,
    value: v.pipe(v.unknown(), v.transform(parseJsonValue)),
    expectedRevision: v.exactOptional(v.nullable(nonemptyString)),
  }),
  objectSchema({
    type: v.literal('delete'),
    key: nonemptyString,
    expectedRevision: v.exactOptional(v.nullable(nonemptyString)),
  }),
])
const mutations = v.pipe(
  v.array(mutation),
  v.check((items) => new Set(items.map((item) => item.key)).size === items.length),
  v.readonly(),
)
/** Validate explicit namespace-local mutations; duplicate keys within either namespace cannot be resolved by array order. */
export function parseStorageCommit(input: unknown): StorageCommit {
  return parse(
    objectSchema({ values: v.exactOptional(mutations), secrets: v.exactOptional(mutations) }),
    input,
    'private storage commit',
  )
}
