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

export type FieldPath = readonly (string | number)[]

export class DistributionError extends Error {
  readonly code: DistributionErrorCode
  readonly path: FieldPath

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
