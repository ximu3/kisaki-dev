import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { parseHostPath } from '#host-path'
import type { NativeFiles } from '#native'
import { comparePaths, type PathRelation } from './paths'

async function present(path: string) {
  try {
    await lstat(path)
    return true
  } catch (cause) {
    if (
      cause instanceof Error &&
      'code' in cause &&
      (cause.code === 'ENOENT' || cause.code === 'ENOTDIR')
    ) {
      return false
    }
    return undefined
  }
}

export async function registeredRelation(
  first: string,
  second: string,
  native: NativeFiles,
): Promise<PathRelation> {
  const relation = await comparePaths(first, second, native)
  if (relation !== 'unknown') {
    return relation
  }
  const left = parseHostPath(first),
    right = parseHostPath(second)
  if (
    left.lookupRoot !== right.lookupRoot ||
    left.names.includes('..') ||
    right.names.includes('..')
  ) {
    return 'unknown'
  }
  let parent = left.lookupRoot
  for (let i = 0; i < Math.min(left.names.length, right.names.length); i++) {
    const a = left.names[i]!,
      b = right.names[i]!
    if (a !== b) {
      const firstEntry = join(parent, a),
        secondEntry = join(parent, b)
      const [one, two] = await Promise.all([present(firstEntry), present(secondEntry)])
      if (one === undefined || two === undefined || (!one && !two)) {
        return 'unknown'
      }
      if (one !== two) {
        return 'separate'
      }
      const firstDifference = await comparePaths(firstEntry, secondEntry, native)
      if (firstDifference !== 'same') {
        return firstDifference === 'separate' ? 'separate' : 'unknown'
      }
    }
    parent = join(parent, a)
  }
  if (left.names.length === right.names.length) {
    return 'same'
  }
  return left.names.length < right.names.length ? 'contains' : 'within'
}

export async function suffixBelow(root: string, path: string, native: NativeFiles) {
  const relation = await registeredRelation(root, path, native)
  if (relation === 'same') {
    return []
  }
  if (relation === 'separate' || relation === 'within') {
    return null
  }
  if (relation === 'unknown') {
    return undefined
  }
  const source = parseHostPath(root),
    target = parseHostPath(path)
  if (source.names.includes('..') || target.names.includes('..')) {
    return undefined
  }
  return target.names.slice(source.names.length)
}
