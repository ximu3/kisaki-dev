/** @fileoverview Owns portable absolute-path shape checks and the finite relative discovery-filter language. */

import * as v from 'valibot'
import { objectSchema } from './schema'
import { nonemptyStringSchema, parseContract } from './validation'

/** Exact paths use actual filesystem equality; glob case handling is the filter's explicit choice. */
export type PathFilter =
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'glob'; readonly pattern: string; readonly ignoreCase: boolean }

/** Shape only: actual path normalization, filesystem resolution, and equivalence belong to the native owner. */
export const absolutePathSchema = v.pipe(
  nonemptyStringSchema,
  v.check(
    (value) =>
      !value.includes('\0') &&
      (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value)),
  ),
)
export const relativePathSchema = v.pipe(v.string(), v.minLength(1), v.check(isRelativePath))
const globSchema = v.pipe(
  relativePathSchema,
  v.check((value) => value.split('/').every((part) => !part.includes('**') || part === '**')),
)
export const pathFilterSchema = v.union([
  objectSchema({ kind: v.literal('path'), path: relativePathSchema }),
  objectSchema({ kind: v.literal('glob'), pattern: globSchema, ignoreCase: v.boolean() }),
])

/** Validate an absolute input without changing its text or claiming the file exists. */
export function parseAbsolutePath(input: unknown): string {
  return parseContract(absolutePathSchema, input, 'absolute path')
}
/** Validate a root-relative value; '.' denotes the root and no traversal or empty segments are accepted. */
export function parseRelativePath(input: unknown): string {
  return parseContract(relativePathSchema, input, 'relative path')
}
/** Validate the finite filter language; metacharacters in exact path filters remain literal filenames. */
export function parsePathFilter(input: unknown): PathFilter {
  return parseContract(pathFilterSchema, input, 'path filter')
}

function isRelativePath(value: string): boolean {
  return (
    value === '.' ||
    (!/[\\\0]/.test(value) &&
      !/^[A-Za-z]:/.test(value) &&
      value.split('/').every((part) => part !== '' && part !== '.' && part !== '..'))
  )
}

/** Match one already valid relative path. Discovery owners decide subtree pruning and actual filesystem equality. */
export function matchesPathFilter(
  filter: PathFilter,
  path: string,
  options: { readonly pathEquals: (left: string, right: string) => boolean },
): boolean {
  if (filter.kind === 'path') {
    return options.pathEquals(filter.path, path)
  }
  if (filter.pattern === '.') {
    return path === '.'
  }
  const pattern = filter.pattern.split('/')
  const parts = path === '.' ? [] : path.split('/')
  let reachable = new Set([0])
  for (const segment of pattern) {
    const next = new Set<number>()
    if (segment === '**') {
      let earliest = parts.length
      for (const start of reachable) {
        earliest = Math.min(earliest, start)
      }
      for (let index = earliest; index <= parts.length; index += 1) {
        next.add(index)
      }
    } else {
      const tokens = Array.from(segment, (character) => {
        if (!filter.ignoreCase || character === '*' || character === '?') {
          return character
        }
        // A single literal keeps native Unicode case folding without wildcard backtracking.
        return new RegExp(`^${character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'iu')
      })
      for (const index of reachable) {
        if (index < parts.length && matchesSegment(tokens, parts[index]!)) {
          next.add(index + 1)
        }
      }
    }
    reachable = next
    if (reachable.size === 0) {
      return false
    }
  }
  return reachable.has(parts.length)
}

function matchesSegment(tokens: readonly (string | RegExp)[], path: string): boolean {
  const characters = Array.from(path)
  let tokenIndex = 0
  let pathIndex = 0
  let lastStar = -1
  let starEnd = 0

  while (pathIndex < characters.length) {
    const token = tokens[tokenIndex]
    if (token === '*') {
      lastStar = tokenIndex
      tokenIndex += 1
      starEnd = pathIndex
    } else if (
      token === '?' ||
      (token instanceof RegExp
        ? token.test(characters[pathIndex]!)
        : token === characters[pathIndex])
    ) {
      tokenIndex += 1
      pathIndex += 1
    } else if (lastStar >= 0) {
      // Extend only the latest wildcard; earlier successful partitions need not be retried.
      tokenIndex = lastStar + 1
      starEnd += 1
      pathIndex = starEnd
    } else {
      return false
    }
  }

  while (tokens[tokenIndex] === '*') {
    tokenIndex += 1
  }
  return tokenIndex === tokens.length
}
