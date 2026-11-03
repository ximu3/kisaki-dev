/** @fileoverview Defines relative path filters while leaving filesystem equivalence and resolution to the host. */

import * as v from 'valibot'
import { DesktopError } from './errors'
import { nonemptyText, parseValue } from './validation'

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

function segmentMatches(pattern: string, value: string, ignoreCase: boolean): boolean {
  const characters = Array.from(value)
  let previous = new Array<boolean>(characters.length + 1).fill(false)
  previous[0] = true

  for (const token of pattern) {
    const current = new Array<boolean>(characters.length + 1).fill(false)
    current[0] = token === '*' && previous[0]!

    // Native case folding only compares one escaped literal point; user regex structure is never evaluated.
    const literal =
      ignoreCase && token !== '*' && token !== '?'
        ? new RegExp(`^(?:${token.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&')})$`, 'iu')
        : null

    for (let index = 1; index <= characters.length; index += 1) {
      current[index] =
        token === '*'
          ? previous[index]! || current[index - 1]!
          : previous[index - 1]! &&
            (token === '?' ||
              (literal ? literal.test(characters[index - 1]!) : token === characters[index - 1]))
    }
    previous = current
  }

  return previous[characters.length]!
}

/**
 * Match one path without traversing it; exact equality comes from known filesystem name rules.
 * Traversal separately applies excluded directories to their subtrees; failed inclusion never prunes descendants.
 */
export function matchesPathFilter(
  filter: PathFilter,
  relativePath: string,
  pathEquals: (left: string, right: string) => boolean,
): boolean {
  const parsed = parsePathFilter(filter)
  const path = parseRelativePath(relativePath)
  if (parsed.kind === 'path') {
    return pathEquals(parsed.path, path)
  }

  const patterns = parsed.pattern === '.' ? [] : parsed.pattern.split('/')
  const parts = path === '.' ? [] : path.split('/')
  let previous = new Array<boolean>(parts.length + 1).fill(false)
  previous[0] = true

  for (const segment of patterns) {
    const current = new Array<boolean>(parts.length + 1).fill(false)
    current[0] = segment === '**' && previous[0]!
    for (let index = 1; index <= parts.length; index += 1) {
      current[index] =
        segment === '**'
          ? previous[index]! || current[index - 1]!
          : previous[index - 1]! && segmentMatches(segment, parts[index - 1]!, parsed.ignoreCase)
    }
    previous = current
  }

  return previous[parts.length]!
}

/** Prepare a rule's base name from an actual final component; a lone leading dot is not an extension. */
export function fileRuleBaseName(name: string, kind: 'file' | 'directory'): string {
  if (kind === 'directory') {
    return name
  }

  const extension = name.lastIndexOf('.')
  return extension > 0 ? name.slice(0, extension) : name
}
