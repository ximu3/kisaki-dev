/** @fileoverview Shares pure format validation and safe errors within extension distribution. */

import * as v from 'valibot'
import { parse, validRange } from 'semver'

/** A classified format or signature failure; messages never contain untrusted document contents. */
export class DistributionError extends Error {
  override readonly name = 'DistributionError'

  constructor(
    readonly code: 'InvalidFormat' | 'InvalidSignature',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export const textSchema = v.pipe(
  v.string(),
  v.check((value) => value.trim().length > 0),
)
export const versionSchema = v.pipe(
  textSchema,
  v.check((value) => {
    const version = parse(value)
    return (
      version !== null &&
      value === version.version + (version.build.length ? `+${version.build.join('.')}` : '')
    )
  }),
)
export const versionRangeSchema = v.pipe(
  textSchema,
  v.check((value) => validRange(value) !== null),
)
export const sizeSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0))
export const sha256Schema = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))

/** Parse an external format without exposing source data through validation messages. */
export function parseFormat<Value>(
  schema: v.GenericSchema<unknown, Value>,
  value: unknown,
  subject: string,
): Value {
  const result = v.safeParse(schema, value)
  if (!result.success) {
    throw new DistributionError('InvalidFormat', `Invalid ${subject}.`)
  }
  return result.output
}

/** Require an HTTP(S) location, optionally resolving a signed relative reference against its response URL. */
export function parseHttpUrl(value: string, base?: string): string {
  let url: URL
  try {
    url = new URL(value, base)
  } catch (cause) {
    throw new DistributionError('InvalidFormat', 'Invalid HTTP URL.', { cause })
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new DistributionError('InvalidFormat', 'Only HTTP and HTTPS URLs are supported.')
  }
  return url.href
}
