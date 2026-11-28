import type { AnimeExtraType } from '@kisaki3/desktop-contracts/library'
import { byNumber, namedParts, unique, type Candidate } from './lookup'
import { conflict, numeric, sequence, series, stem } from './naming'
import type { Condition } from './rules/output'

const extras: readonly [AnimeExtraType, RegExp][] = [
  ['opening', /^(?:(?:creditless\s+)?(?:nc)?op)(?=\d|\b|\s)/iu],
  ['ending', /^(?:(?:creditless\s+)?(?:nc)?ed)(?=\d|\b|\s)/iu],
  ['promotion', /^(?:(?:pv|cm|trailer|teaser)(?=\d|\b|\s)|预告|預告)/iu],
  ['interview', /^(?:interview\b|访谈|訪談|インタビュー)/iu],
  ['other', /^(?:making\s+of\b|制作花絮|製作花絮|メイキング)/iu],
]

export function animeConditions(base: string): Condition[] {
  const value = stem(base, false),
    segments = value.split(/\s+-\s+/u)
  const content = segments.at(-1)!
  const offsets = [
    0,
    ...[...value.matchAll(/\s+-\s+/gu)].map((match) => match.index + match[0].length),
  ]
  const episodeMarker = new RegExp(
    '^(?:special[ ._-]+episode|(?:特别篇|特別篇|特別編)\\s*第)|^(?:episode|ep|第)?\\s*' +
      series +
      '(?:v\\d+)?(?:[話话集])?$',
    'iu',
  )
  const extraAt = segments.findIndex((part, i) => {
    if (!extras.some(([, marker]) => marker.test(part))) {
      return false
    }
    if (i > 0 || segments.length === 1) {
      return true
    }
    return !segments.slice(1).some((rest) => episodeMarker.test(rest))
  })
  if (extraAt >= 0) {
    if (segments.slice(0, extraAt).some((part, i) => i > 0 && episodeMarker.test(part))) {
      conflict()
    }
    const original = value.slice(offsets[extraAt])
    const kinds = extras.filter(([, marker]) =>
      original.split(/\s+[-+&/]\s+/u).some((piece) => marker.test(piece)),
    )
    if (
      kinds.length !== 1 ||
      segments
        .slice(extraAt + 1)
        .some((p) => /^special[ ._-]+episode|^(?:特别篇|特別篇|特別編)\s*第/iu.test(p))
    ) {
      conflict()
    }
    return [
      {
        kind: 'extra',
        extraType: kinds[0]![0],
        name: original.replace(/(?<=\d)v\d+(?=$|\s)/iu, ''),
      },
    ]
  }
  const special = new RegExp(
    '^(?:special[ ._-]+episode[ ._-]*|(?:特别篇|特別篇|特別編)\\s*(?:第\\s*)?)(' +
      series +
      ')(?:\\s*[話话集])?(?:v\\d+)?$',
    'iu',
  ).exec(content)
  if (special) {
    return sequence(special[1]!).map((number) => ({
      kind: 'episode',
      episodeType: 'special',
      number,
    }))
  }
  if (/^(?:bonus|sp|s00|特典)(?:\d|\b|\s)/iu.test(content) || /(?:^|[ ._-])s0+e\d+/iu.test(value)) {
    conflict()
  }

  const proposals = new Set<string>()
  for (const match of value.matchAll(
    new RegExp('(?:^|[ ._-])s[0-9]+e(' + numeric + ')(?=$|[ ._-])', 'giu'),
  )) {
    proposals.add(match[1]!)
  }
  const bracket = new RegExp('\\[(' + series + ')(?:v\\d+)?\\]$', 'iu').exec(content)
  if (bracket) {
    proposals.add(bracket[1]!)
  }
  const numbered = new RegExp(
    '^(?:(?:episode|ep)[ ._-]*|第\\s*)?(' +
      series +
      ')(?:\\s*[話话集])?(?:v\\d+)?(?:\\s*\\(\\d+\\))?$',
    'iu',
  ).exec(content)
  if (numbered) {
    proposals.add(numbered[1]!)
  }
  if (proposals.size > 1) {
    conflict()
  }
  const [label] = proposals
  return label
    ? sequence(label).map((number) => ({ kind: 'episode', episodeType: 'regular', number }))
    : []
}

export function matchAnime(
  condition: Extract<Condition, { kind: 'extra' | 'episode' }>,
  list: readonly Candidate[],
) {
  if (condition.kind === 'extra') {
    const rows = namedParts(list, 'animeExtra', condition.name)
    return [
      unique(
        'extraType' in condition
          ? rows.filter((row) => row.classification === condition.extraType)
          : rows,
      ),
    ]
  }
  const rows = namedParts(list, 'animeEpisode', condition.name)
  return byNumber(
    'episodeType' in condition
      ? rows.filter((row) => row.classification === condition.episodeType)
      : rows,
    condition.number,
    (row) => row.number,
  )
}
