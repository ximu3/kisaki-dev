import { sql, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  partWorkType,
  partTypes,
  type WorkRef,
  type FileWorkType,
  type FileRecognitionResult,
  type FileRecognitionSource,
  type PartRef,
  type FileNumberCondition,
} from '@kisaki3/desktop-contracts/library'
import { comicVolumeChapters } from '../../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../../transaction'
import { parts } from '../../parts/tables'
import type { Condition } from './output'

export interface Candidate {
  ref: PartRef
  name: string | null
  number: string | null
  classification: string | null
  volumes: readonly { id: string; number: string | null }[]
}
export function candidates(db: LibraryDatabase, work: WorkRef<FileWorkType>) {
  const members = new Map<string, { id: string; number: string | null }[]>()
  if (work.type === 'comic') {
    for (const row of db
      .select()
      .from(comicVolumeChapters)
      .where(eq(comicVolumeChapters.comicId, work.id))
      .all()) {
      const rows = members.get(row.chapterId) ?? []
      rows.push({ id: row.volumeId, number: row.numberLabel })
      members.set(row.chapterId, rows)
    }
  }
  const result: Candidate[] = []
  for (const kind of partTypes.filter((kind) => partWorkType(kind) === work.type)) {
    const { table, owner } = parts[kind]
    const list = db.all<{
      id: string
      name: string | null
      number: string | null
      classification: string | null
    }>(
      sql`select id,name,${kind === 'animeExtra' ? sql`null` : sql`number_label`} number,${work.type === 'anime' ? sql`type` : sql`null`} classification from ${table} where ${owner}=${work.id} order by sort_order,id`,
    )
    for (const row of list) {
      result.push({
        ...row,
        ref: { type: kind, id: row.id },
        volumes: kind === 'comicChapter' ? (members.get(row.id) ?? []) : [],
      })
    }
  }
  return result
}
function normalize(value: string | null | undefined) {
  const text = value?.trim()
  return text && /^[0-9]+$/u.test(text) ? text.replace(/^0+(?=\d)/u, '') : text
}
class LookupFailure extends Error {
  constructor(readonly reason: 'ambiguousTarget' | 'targetMissing') {
    super(
      reason === 'ambiguousTarget'
        ? 'Several parts match the identifier'
        : 'A matching part is missing',
    )
  }
}
function unique(values: readonly Candidate[]) {
  if (!values.length) {
    throw new LookupFailure('targetMissing')
  }
  if (values.length !== 1) {
    throw new LookupFailure('ambiguousTarget')
  }
  return values[0]!
}
function byNumber(
  list: readonly Candidate[],
  number: FileNumberCondition | undefined,
  label: (p: Candidate) => string | null | undefined,
) {
  if (!number) {
    return [unique(list)]
  }
  if (number.kind === 'single') {
    return [unique(list.filter((row) => normalize(label(row)) === normalize(number.value)))]
  }
  const lo = BigInt(number.start),
    hi = BigInt(number.end)
  if (lo > hi) {
    throw new DesktopError('InvalidInput', 'The range is reversed')
  }
  const found = new Map<bigint, Candidate>()
  for (const row of list) {
    const text = label(row)?.trim()
    if (!text || !/^\d+$/u.test(text)) {
      continue
    }
    const index = BigInt(text)
    if (index < lo || index > hi) {
      continue
    }
    if (found.has(index)) {
      throw new LookupFailure('ambiguousTarget')
    }
    found.set(index, row)
  }
  if (BigInt(found.size) !== hi - lo + 1n) {
    throw new LookupFailure('targetMissing')
  }
  return [...found].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, part]) => part)
}
export function matchParts(
  type: FileWorkType,
  conditions: readonly Condition[],
  source: FileRecognitionSource,
  list: readonly Candidate[],
): FileRecognitionResult {
  if (!conditions.length) {
    return { outcome: 'unmatched' }
  }
  const found = new Map<string, PartRef>()
  try {
    for (const c of conditions) {
      const kind = {
        episode: 'animeEpisode',
        extra: 'animeExtra',
        volume: type === 'comic' ? 'comicVolume' : 'novelVolume',
        chapter: 'comicChapter',
      }[c.kind]
      let choices = list.filter((p) => p.ref.type === kind)
      if (c.name !== undefined) {
        choices = choices.filter((row) => row.name?.trim() === c.name!.trim())
      }
      if (c.kind === 'extra') {
        if ('extraType' in c) {
          choices = choices.filter((p) => p.classification === c.extraType)
        }
        const { ref } = unique(choices)
        found.set(ref.id, ref)
        continue
      }
      if (c.kind === 'episode' && 'episodeType' in c) {
        choices = choices.filter((row) => row.classification === c.episodeType)
      }
      let label = (p: Candidate): string | null | undefined => p.number
      if (c.kind === 'chapter' && c.volume) {
        const scope = c.volume
        const volume = unique(
          list.filter(
            (row) =>
              row.ref.type === 'comicVolume' &&
              (!scope.name || scope.name.trim() === row.name?.trim()) &&
              (!scope.number || normalize(scope.number) === normalize(row.number)),
          ),
        )
        const membership = (p: Candidate) => p.volumes.find((member) => member.id === volume.ref.id)
        choices = choices.filter((p) => membership(p))
        if (c.numberBasis === 'volume') {
          label = (p) => membership(p)?.number
        }
      }
      for (const { ref } of byNumber(choices, c.number, label)) {
        found.set(ref.id, ref)
      }
    }
  } catch (error) {
    if (!(error instanceof LookupFailure)) {
      throw error
    }
    return {
      outcome: 'failed',
      source,
      reason: error.reason,
      error: { code: 'InvalidReference', message: error.message },
    }
  }
  const [first, ...rest] = found.values()
  if (!first) {
    return { outcome: 'unmatched' }
  }
  return {
    outcome: 'matched',
    source,
    conditions: [conditions[0]!, ...conditions.slice(1)],
    parts: [first, ...rest],
  } as FileRecognitionResult
}
