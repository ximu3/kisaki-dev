import type {
  FileRecognitionResult,
  FileRecognitionSource,
  FileWorkType,
  PartRef,
} from '@kisaki3/desktop-contracts/library'
import { animeConditions, matchAnime } from './anime'
import { comicConditions, matchComic } from './comic'
import { LookupFailure, type Candidate } from './lookup'
import { matchNovel, novelConditions } from './novel'
import type { Condition } from './rules/output'

export function builtin(type: FileWorkType, baseName: string, path?: string): Condition[] {
  switch (type) {
    case 'anime':
      return animeConditions(baseName)
    case 'comic':
      return comicConditions(baseName, path)
    case 'novel':
      return novelConditions(baseName, path)
  }
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
    for (const condition of conditions) {
      let matches: readonly Candidate[]
      switch (condition.kind) {
        case 'episode':
        case 'extra':
          matches = matchAnime(condition, list)
          break
        case 'chapter':
          matches = matchComic(condition, list)
          break
        case 'volume':
          matches = type === 'comic' ? matchComic(condition, list) : matchNovel(condition, list)
          break
      }
      for (const { ref } of matches) {
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
