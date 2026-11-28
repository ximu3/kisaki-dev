import { test, expect } from 'vite-plus/test'
import { builtin } from '../../../src/main/features/library/holdings/recognition/builtin'

test('recognition preserves episode precision, extra titles and reading scopes from explicit tokens', () => {
  const episode = (value: string) => [
    { kind: 'episode', episodeType: 'regular', number: { kind: 'single', value } },
  ]
  for (const name of ['[Group] 86 - 03v2 [1080p][A1B2C3D4]', 'Title.S02E03.1080p.WEB-DL']) {
    expect(builtin('anime', name)).toEqual(episode('03'))
  }
  expect(builtin('anime', '[Group] Title [13.10][Ma10p_1080p]')).toEqual(episode('13.10'))
  for (const [name, expected] of [
    ['NCOP01v2 [BD 2160p]', 'NCOP01'],
    ['NCOP01  -  Song [1080p]', 'NCOP01  -  Song'],
  ]) {
    expect(builtin('anime', name!)).toEqual([
      { kind: 'extra', extraType: 'opening', name: expected },
    ])
  }
  expect(builtin('anime', 'Interview - Guest [1080p]')).toEqual([
    { kind: 'extra', extraType: 'interview', name: 'Interview - Guest' },
  ])
  expect(builtin('anime', 'Title - Special Episode 01')).toEqual([
    { kind: 'episode', episodeType: 'special', number: { kind: 'single', value: '01' } },
  ])
  expect(() => builtin('anime', 'Title - Special Episode 01 - NCOP01')).toThrow()
  expect(builtin('comic', 'Ch.01', 'Title/Vol.02/Ch.01.cbz')).toEqual([
    {
      kind: 'chapter',
      numberBasis: 'volume',
      number: { kind: 'single', value: '01' },
      volume: { number: '02' },
    },
  ])
  expect(builtin('comic', 'Vol.2 Ch.01', 'Vol.02/Vol.2 Ch.01.cbz')).toEqual(
    builtin('comic', 'Vol.2 Ch.01', 'Vol.2/Vol.2 Ch.01.cbz'),
  )
  expect(() => builtin('comic', 'Vol.2 Ch.01', 'Vol.3/Vol.2 Ch.01.cbz')).toThrow()
  expect(builtin('comic', 'c012 (v02)')).toEqual([
    { kind: 'chapter', numberBasis: 'work', number: { kind: 'single', value: '012' } },
  ])
  for (const label of ['153b', '013x1', '13.10']) {
    expect(builtin('comic', 'Ch.' + label)).toEqual([
      { kind: 'chapter', numberBasis: 'work', number: { kind: 'single', value: label } },
    ])
  }
  expect(builtin('novel', '上卷')).toEqual([
    { kind: 'volume', number: { kind: 'single', value: '上' } },
  ])
  expect(builtin('novel', '03')).toEqual([])
})
