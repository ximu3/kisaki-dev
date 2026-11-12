/** @fileoverview Defines relative path filters while leaving filesystem equivalence and resolution to the host. */

import { parseValue, nonemptyText } from './validation'
import { DesktopError } from './errors'
import * as v from 'valibot'

/**
 * Root-relative literal path or glob with an explicit case-matching policy.
 *
 * Literal paths preserve wildcard-looking characters. Globs support *, ? and whole ** segments.
 */
export type PathFilter =
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'glob'; readonly pattern: string; readonly ignoreCase: boolean }

/**
 * Checks absolute path syntax while preserving the supplied spelling.
 *
 * The host owns symlink resolution, parent traversal and filesystem name equivalence.
 */
export function parseAbsolutePath(input: unknown): string {
  const value = parseValue(nonemptyText, input, 'Invalid absolute path')
  if (
    value.includes('\0') ||
    !(
      value.startsWith('/') ||
      /^[A-Za-z]:[\\/]/.test(value) ||
      /^\\\\[^\\/]+[\\/][^\\/]+/.test(value)
    )
  ) {
    throw new DesktopError('InvalidInput', 'An explicit absolute filesystem path is required')
  }

  return value
}

/**
 * Parses a root-relative slash-separated path.
 *
 * The root is represented by a dot. Other paths require nonempty segments and reject dot segments,
 * parent traversal and drive prefixes.
 */
export function parseRelativePath(input: unknown): string {
  const value = parseValue(nonemptyText, input, 'Invalid relative path')
  if (value === '.') {
    return value
  }
  if (
    /[\\\0]/.test(value) ||
    /^[A-Za-z]:/.test(value) ||
    value.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new DesktopError('InvalidInput', 'Expected a root-relative slash-separated path')
  }

  return value
}

/**
 * Parses a literal path or restricted glob and requires recursive wildcards to occupy complete
 * segments.
 *
 * Character-class and brace-looking text remains literal.
 */
export function parsePathFilter(input: unknown): PathFilter {
  const value = parseValue(
    v.variant('kind', [
      v.strictObject({
        kind: v.literal('path'),
        path: v.pipe(v.unknown(), v.transform(parseRelativePath)),
      }),
      v.strictObject({
        kind: v.literal('glob'),
        pattern: v.pipe(v.unknown(), v.transform(parseRelativePath)),
        ignoreCase: v.boolean(),
      }),
    ]),
    input,
    'Invalid path filter',
  )
  if (
    value.kind === 'glob' &&
    value.pattern.split('/').some((part) => part.includes('**') && part !== '**')
  ) {
    throw new DesktopError(
      'InvalidInput',
      'A recursive glob wildcard must occupy a complete path segment',
    )
  }

  return value
}
