import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  AnimeExtraType,
  FileNumberCondition,
  FileWorkType,
} from '@kisaki3/desktop-contracts/library'
import type { Condition } from './output'

const numeric = '[0-9]+(?:\\.[0-9]+)?'
const series = numeric + '(?:(?:[-–~〜～+])' + numeric + ')*'
const suffix =
  /^(?:[0-9a-f]{8}|(?:ma)?(?:8|10|12)(?:p|bit)|(?:360|480|576|720|1080|1440|2160)[pi]|[0-9]{3,4}x[0-9]{3,4}|uhd|4k|hdr(?:10)?|bluray|bd(?:rip)?|web(?:[ .-]?dl|rip)?|tv|dvd|hevc|avc|av1|x26[45]|h[ .]?26[45]|aac|flac|opus|ac3|dts)$/iu
function conflict(): never {
  throw new DesktopError('Conflict', 'The filename contains conflicting part identifiers')
}
function sequence(value: string): FileNumberCondition[] {
  if (value.includes('+')) {
    const labels = value.split('+')
    if (labels.some((item) => /[-–~〜～]/u.test(item))) {
      conflict()
    }
    return labels.map((label) => ({ kind: 'single', value: label }))
  }
  const ends = value.split(/[-–~〜～]/u)
  if (ends.length === 1) {
    return [{ kind: 'single', value }]
  }
  if (
    ends.length !== 2 ||
    ends.some((label) => !/^\d+$/u.test(label)) ||
    BigInt(ends[0]!) > BigInt(ends[1]!)
  ) {
    conflict()
  }
  return [{ kind: 'range', start: ends[0]!, end: ends[1]! }]
}
function stem(input: string, book: boolean) {
  let value = input.trim().replace(/^\[[^\]]+\]\s+(?=\S)/u, '')
  while (true) {
    const tail = /\s*\[([^\]]+)\]\s*$/u.exec(value)
    if (!tail) {
      break
    }
    const tokens = tail[1]!.split(/[\s_+]+/u)
    if (!tokens.every((token) => suffix.test(token)) && !(book && !/\d/u.test(tail[1]!))) {
      break
    }
    value = value.slice(0, tail.index).trimEnd()
  }
  return value
}
const extras: readonly [AnimeExtraType, RegExp][] = [
  ['opening', /^(?:(?:creditless\s+)?(?:nc)?op)(?=\d|\b|\s)/iu],
  ['ending', /^(?:(?:creditless\s+)?(?:nc)?ed)(?=\d|\b|\s)/iu],
  ['promotion', /^(?:(?:pv|cm|trailer|teaser)(?=\d|\b|\s)|预告|預告)/iu],
  ['interview', /^(?:interview\b|访谈|訪談|インタビュー)/iu],
  ['other', /^(?:making\s+of\b|制作花絮|製作花絮|メイキング)/iu],
]
function anime(base: string): Condition[] {
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
function marker(text: string, kind: 'volume' | 'chapter') {
  const label = '(?:[0-9]+[A-Za-z0-9.]*|[上中下])'
  const number = '(' + label + '(?:[-–~〜～+]' + label + ')*)'
  const prefix = kind === 'volume' ? '(?:vol(?:ume)?\\.?|v)' : '(?:chapter|ch\\.?|c)'
  const suffix = kind === 'volume' ? '[巻卷册冊]' : '[話话章]'
  const west = new RegExp('(?:^|[ ._-])' + prefix + '\\s*' + number + '(?=$|[ \\t])', 'giu')
  const east = new RegExp('(?:第\\s*)?' + number + '\\s*' + suffix, 'gu')
  const values = new Set([...text.matchAll(west), ...text.matchAll(east)].map((row) => row[1]!))
  if (values.size > 1) {
    conflict()
  }
  return values.values().next().value
}
export function builtin(type: FileWorkType, baseName: string, path?: string): Condition[] {
  if (type === 'anime') {
    return anime(baseName)
  }
  const content = stem(baseName, true)
  if (type === 'comic') {
    const source = new RegExp('(?:^|[ ._-])c(' + numeric + ')\\s*\\(v\\d+\\)$', 'iu').exec(content)
    if (source) {
      return [
        { kind: 'chapter', numberBasis: 'work', number: { kind: 'single', value: source[1]! } },
      ]
    }
  }
  const chapter = marker(content, 'chapter')
  const volume = marker(content, 'volume')
  const parent = path?.split('/').at(-2)
  const folder = parent ? marker(parent, 'volume') : undefined
  if (folder && volume && folder !== volume) {
    conflict()
  }
  if (chapter) {
    if (type === 'novel') {
      return []
    }
    const scope = volume ?? folder
    return sequence(chapter).map((number) => ({
      kind: 'chapter',
      numberBasis: scope ? 'volume' : 'work',
      number,
      ...(scope && { volume: { number: scope } }),
    }))
  }
  return volume ? sequence(volume).map((number) => ({ kind: 'volume', number })) : []
}
