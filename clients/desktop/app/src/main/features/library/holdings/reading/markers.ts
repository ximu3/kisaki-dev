import { numberKey, conflict } from '../recognition/naming'

function marker(text: string, kind: 'volume' | 'chapter') {
  const label = '(?:[0-9]+[A-Za-z0-9.]*|[上中下])'
  const number = '(' + label + '(?:[-–~〜～+]' + label + ')*)'
  const prefix = kind === 'volume' ? '(?:vol(?:ume)?\\.?|v)' : '(?:chapter|ch\\.?|c)'
  const suffix = kind === 'volume' ? '[巻卷册冊]' : '[話话章]'
  const west = new RegExp('(?:^|[ ._-])' + prefix + '\\s*' + number + '(?=$|[ \\t])', 'giu')
  const east = new RegExp('(?:第\\s*)?' + number + '\\s*' + suffix, 'gu')
  const values = new Map<string, string>()
  for (const match of [...text.matchAll(west), ...text.matchAll(east)]) {
    const label = match[1]!
    values.set(numberKey(label)!, label)
  }
  if (values.size > 1) {
    conflict()
  }
  return values.values().next().value
}

export function bookMarkers(content: string, path?: string) {
  const chapter = marker(content, 'chapter')
  const volume = marker(content, 'volume')
  const parent = path?.split('/').at(-2)
  const folder = parent ? marker(parent, 'volume') : undefined
  if (folder && volume && numberKey(folder) !== numberKey(volume)) {
    conflict()
  }
  return { chapter, volume, folder }
}
