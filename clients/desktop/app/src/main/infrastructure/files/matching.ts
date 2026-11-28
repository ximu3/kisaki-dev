import { join } from 'node:path'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { PathFilter } from '@kisaki3/desktop-contracts/paths'
import type { NativeFiles } from '#native'
import { comparePaths } from './paths'

function nameMatches(pattern: string, name: string, ignoreCase: boolean) {
  const text = Array.from(ignoreCase ? name.toLowerCase() : name)
  const tokens = Array.from(ignoreCase ? pattern.toLowerCase() : pattern)
  let i = 0,
    j = 0,
    wild = -1,
    restart = 0
  while (i < text.length) {
    if (j < tokens.length && (tokens[j] === '?' || tokens[j] === text[i])) {
      i++
      j++
      continue
    }
    if (tokens[j] === '*') {
      wild = j++
      restart = i
      continue
    }
    if (wild < 0) {
      return false
    }
    j = wild + 1
    i = ++restart
  }
  while (tokens[j] === '*') {
    j++
  }
  return j === tokens.length
}
export function globMatches(pattern: string, relative: string, ignoreCase: boolean) {
  const terms = pattern.split('/'),
    names = relative.split('/')
  let states = new Set([0])
  function skip(set: Set<number>) {
    for (const position of set) {
      if (terms[position] === '**') {
        set.add(position + 1)
      }
    }
  }
  skip(states)
  for (const name of names) {
    const next = new Set<number>()
    for (const position of states) {
      const term = terms[position]
      if (term === '**') {
        next.add(position)
      } else if (term !== undefined && nameMatches(term, name, ignoreCase)) {
        next.add(position + 1)
      }
    }
    skip(next)
    states = next
  }
  return states.has(terms.length)
}
export async function matchesFilters(
  filters: readonly PathFilter[],
  root: string,
  path: string,
  relative: string,
  native: NativeFiles,
) {
  for (const filter of filters) {
    if (filter.kind === 'glob') {
      if (globMatches(filter.pattern, relative, filter.ignoreCase)) {
        return true
      }
      continue
    }
    if (filter.path === relative) {
      return true
    }
    const relation = await comparePaths(join(root, filter.path), path, native)
    if (relation === 'same') {
      return true
    }
    if (
      relation === 'unknown' &&
      filter.path.normalize('NFC').toLowerCase() === relative.normalize('NFC').toLowerCase()
    ) {
      throw new DesktopError('PathUnresolved', 'The exact path filter could not be evaluated')
    }
  }
  return false
}
