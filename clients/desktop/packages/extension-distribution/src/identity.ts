/** @fileoverview Validates opaque extension identities and package-relative resource paths. */

import * as v from 'valibot'
import { parseFormat, textSchema } from './validation'

export const extensionIdSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z](?:[a-z0-9-]*[a-z0-9])?)*$/),
)
export const localIdSchema = v.pipe(
  textSchema,
  v.check((value) => !value.includes(':')),
)
export const packagePathSchema = v.pipe(
  textSchema,
  v.check((value) => {
    return (
      !/[\\:]/.test(value) &&
      !value.includes('\0') &&
      value.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
    )
  }),
)

/** Validate a formal extension or registry ID without normalizing case or inferring ownership. */
export function parseExtensionId(value: unknown): string {
  return parseFormat(extensionIdSchema, value, 'extension identity')
}

/** Validate an instance-local contribution ID; the host supplies the actual extension identity. */
export function parseLocalId(value: unknown): string {
  return parseFormat(localIdSchema, value, 'local contribution identity')
}

/** Validate a slash-separated relative package path, preserving its actual filename bytes. */
export function parsePackagePath(value: unknown): string {
  return parseFormat(packagePathSchema, value, 'package path')
}

/** Compose a stable contribution reference, without treating its prefix as a permission. */
export function formatContributionId(extensionId: string, localId: string): `${string}:${string}` {
  return `${parseExtensionId(extensionId)}:${parseLocalId(localId)}`
}

/** Split the sole identity separator and validate both independently owned parts. */
export function parseContributionId(value: unknown): {
  readonly extensionId: string
  readonly localId: string
} {
  const text = parseFormat(textSchema, value, 'contribution identity')
  const parts = text.split(':')
  if (parts.length !== 2) {
    return parseFormat(v.never(), value, 'contribution identity')
  }
  return { extensionId: parseExtensionId(parts[0]), localId: parseLocalId(parts[1]) }
}
