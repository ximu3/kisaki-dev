/** @fileoverview Provides locatable format, compatibility and trust failures for distribution consumers. */

/** Stable failure categories; callers should not classify human-readable messages. */
export type DistributionErrorCode =
  | 'invalid-json'
  | 'duplicate-property'
  | 'invalid-format'
  | 'unsupported-schema'
  | 'version-conflict'
  | 'target-conflict'
  | 'immutable-release'
  | 'artifact-mismatch'
  | 'invalid-key'
  | 'identity-mismatch'
  | 'key-mismatch'
  | 'invalid-signature'
  | 'integrity-mismatch'

/** A field path in the submitted document; numeric segments identify array items. */
export type FieldPath = readonly (string | number)[]

/** A rejected input or operation. Paths locate fields without including their untrusted values. */
export class DistributionError extends Error {
  readonly code: DistributionErrorCode
  readonly path: FieldPath

  /** Records a distribution failure with a copied field path and optional local cause. */
  constructor(
    code: DistributionErrorCode,
    message: string,
    path: FieldPath = [],
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'DistributionError'
    this.code = code
    this.path = [...path]
  }
}
