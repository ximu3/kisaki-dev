import { readdir, realpath } from 'node:fs/promises'
import { join, relative, sep, extname } from 'node:path'
import { DesktopError, type ErrorSummary } from '@kisaki3/desktop-contracts/errors'
import type { DirectoryDiscoveryDefinition, FileWorkType } from '@kisaki3/desktop-contracts/library'
import type { NativeFiles } from '#native'
import { fileError } from '../files/error'
import { registeredRelation as comparePaths } from '../../../../infrastructure/files/registered-path'
import { matchesFilters } from '../../../../infrastructure/files/matching'
import { pictureName } from '../reading/inspect'
import type { Position } from '../paths'

const videos = new Set(
  '.mkv .mp4 .m4v .webm .avi .mov .wmv .flv .ts .mts .m2ts .mpg .mpeg .vob .ogv .asf .mxf .3gp'.split(
    ' ',
  ),
)
const books = new Set('.epub .fb2 .pdf .mobi .azw .azw3 .txt .zip .cbz .rar .cbr'.split(' '))
export async function discover(
  type: FileWorkType,
  root: string,
  rules: DirectoryDiscoveryDefinition,
  positions: readonly Position[],
  protectedPaths: readonly string[],
  native: NativeFiles,
  signal: AbortSignal,
  affected: readonly string[] | null = null,
) {
  const seen = new Set<string>(),
    registered = positions.filter((p) => p.kind === 'pages')
  const paths: string[] = [],
    skipped: string[] = [],
    issues: { path: string; error: ErrorSummary }[] = []
  const suffixes = type === 'anime' ? videos : books
  const rel = (path: string) => relative(root, path).split(sep).join('/') || '.'
  const matches = (path: string, filters: DirectoryDiscoveryDefinition['include']) =>
    matchesFilters(filters, root, path, rel(path), native)
  async function relevant(path: string, ancestors: boolean) {
    if (!affected) {
      return true
    }
    for (const changed of affected) {
      const relation = await comparePaths(path, changed, native)
      if (
        relation === 'same' ||
        relation === 'within' ||
        relation === 'unknown' ||
        (ancestors && relation === 'contains')
      ) {
        return true
      }
    }
    return false
  }
  async function admit(path: string) {
    if (!(await relevant(path, true))) {
      return
    }
    if (!rules.include.length || (await matches(path, rules.include))) {
      paths.push(path)
      return
    }
    skipped.push(path)
  }
  async function visit(
    path: string,
    depth: number,
    completeBranch = false,
  ): Promise<'empty' | 'document' | 'unknown'> {
    signal.throwIfAborted()
    if (await matches(path, rules.exclude)) {
      skipped.push(path)
      return 'empty'
    }
    for (const space of protectedPaths) {
      const cmp = await comparePaths(space, path, native)
      if (cmp === 'same' || cmp === 'contains') {
        skipped.push(path)
        return 'empty'
      }
      if (cmp === 'unknown') {
        throw new DesktopError('PathUnresolved', 'A recovery directory could not be excluded')
      }
    }
    for (const boundary of registered) {
      const cmp = await comparePaths(boundary.path, path, native)
      if (cmp === 'same') {
        await admit(path)
        return 'document'
      }
      if (cmp === 'contains') {
        skipped.push(path)
        return 'document'
      }
    }
    const physical = await realpath(path)
    if (seen.has(physical)) {
      skipped.push(path)
      return 'unknown'
    }
    seen.add(physical)
    try {
      let loose = false,
        contained = false,
        unknown = false
      const entries = await readdir(path, { withFileTypes: true })
      const checkSiblings =
        type !== 'anime' && entries.some((entry) => entry.isFile() && pictureName.test(entry.name))
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        signal.throwIfAborted()
        const child = join(path, entry.name)
        if (entry.isSymbolicLink() || (await matches(child, rules.exclude))) {
          skipped.push(child)
          continue
        }
        if (type !== 'anime' && entry.isFile() && pictureName.test(entry.name)) {
          loose = true
          continue
        }
        if (rules.maxDepth !== null && depth + 1 > rules.maxDepth) {
          skipped.push(child)
          if (
            entry.isDirectory() ||
            entry.isSymbolicLink() ||
            suffixes.has(extname(entry.name).toLowerCase())
          ) {
            unknown = true
          }
          continue
        }
        try {
          if (entry.isDirectory()) {
            if (!completeBranch && !checkSiblings && !(await relevant(child, true))) {
              continue
            }
            const result = await visit(child, depth + 1, completeBranch || checkSiblings)
            if (result === 'document') {
              contained = true
            }
            if (result === 'unknown') {
              unknown = true
            }
          } else if (entry.isFile() && suffixes.has(extname(entry.name).toLowerCase())) {
            contained = true
            await admit(child)
          }
        } catch (cause) {
          signal.throwIfAborted()
          issues.push({ path: child, error: fileError(cause) })
          unknown = true
        }
      }
      if (loose && !contained && !unknown) {
        await admit(path)
        return 'document'
      }
      if (loose && (contained || unknown)) {
        issues.push({
          path,
          error: {
            code: 'PathConflict',
            message: 'Loose pages share this folder with a separate or unverified reading target',
          },
        })
      }
      if (unknown) {
        return 'unknown'
      }
      return contained || loose ? 'document' : 'empty'
    } finally {
      seen.delete(physical)
    }
  }
  try {
    await visit(root, 0)
  } catch (cause) {
    signal.throwIfAborted()
    issues.push({ path: root, error: fileError(cause) })
  }
  return { paths, skipped, issues }
}
