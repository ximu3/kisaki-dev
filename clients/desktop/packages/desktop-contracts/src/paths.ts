/** @fileoverview Defines relative path filters while leaving filesystem equivalence and resolution to the host. */

import { parseValue, nonemptyText } from './validation'
import { DesktopError } from './errors'
import * as v from 'valibot'

/** Exact paths treat wildcard-looking characters literally; glob syntax is *, ? and whole ** segments only. */
export type PathFilter =
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'glob'; readonly pattern: string; readonly ignoreCase: boolean }

/** Check absolute syntax without resolving symlinks, folding .. or guessing filesystem name equivalence. */
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

/** Root is '.', other paths contain nonempty slash-separated segments with no root escape or drive prefix. */
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

/** Validate the closed filter syntax; character-class and brace-looking text remains literal. */
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
