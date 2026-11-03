/** @fileoverview Checks finite glob semantics and complete full-string template interpretations on synthetic inputs. */

import { expect, test } from 'vitest'
import { fileRuleBaseName, matchesPathFilter, parsePathFilter } from '../src/paths'
import {
  expandTextTemplate,
  inspectTextPattern,
  matchTextPattern,
  parseTextTemplate,
} from '../src/text-rules'
import {
  applyFileNumberOffset,
  expandFileNumberRange,
  fileNumberKey,
  parseFileRecognitionDefinition,
} from '../src/library/file-recognition'
import { interpretFileRules } from '../src/library/file-recognition-output'

test('glob recursion matches zero levels and question marks count Unicode code points', () => {
  const equals = (a: string, b: string): boolean => a === b
  const filter = { kind: 'glob', pattern: '**/*.cbz', ignoreCase: false } as const
  expect(matchesPathFilter(filter, '01.cbz', equals)).toBe(true)
  expect(matchesPathFilter(filter, 'a/b/01.cbz', equals)).toBe(true)
  expect(matchesPathFilter(filter, '01.CBZ', equals)).toBe(false)
  expect(matchesPathFilter({ ...filter, ignoreCase: true }, '01.CBZ', equals)).toBe(true)
  expect(
    matchesPathFilter({ kind: 'glob', pattern: '?.cbz', ignoreCase: false }, '😀.cbz', equals),
  ).toBe(true)
  expect(matchesPathFilter({ kind: 'path', path: '[group]/*.cbz' }, '[group]/01.cbz', equals)).toBe(
    false,
  )
  expect(() => parsePathFilter({ kind: 'glob', pattern: 'a**b', ignoreCase: false })).toThrow()
  expect(() => parsePathFilter({ kind: 'path', path: '../outside' })).toThrow()
  expect(fileRuleBaseName('.hidden', 'file')).toBe('.hidden')
  expect(fileRuleBaseName('book.tar.gz', 'file')).toBe('book.tar')
})

test('complete matching backtracks alternatives and rejects a final newline skipped by dollar anchors', () => {
  expect(matchTextPattern(inspectTextPattern('(?<name>a|ab)', false), 'ab')).toEqual({ name: 'ab' })
  expect(matchTextPattern(inspectTextPattern('(?<name>.+)$', false), 'book\n')).toBeNull()
  expect(matchTextPattern(inspectTextPattern('(?<name>[\\s\\S]+)', false), 'book\n')).toEqual({
    name: 'book\n',
  })
  expect(() => parseTextTemplate('$1', ['name'])).toThrow()
  expect(() => parseTextTemplate('$<missing>', ['name'])).toThrow()
  expect(expandTextTemplate('prefix-$<missing>', {})).toBeUndefined()
  expect(expandTextTemplate('prefix-$<name>$$', { name: '' })).toBe('prefix-$')
})

test('number offsets preserve dotted text and use exact integer arithmetic', () => {
  expect(fileNumberKey(' 003 ')).toBe('3')
  expect(fileNumberKey('1.10')).not.toBe(fileNumberKey('1.1'))
  expect(applyFileNumberOffset('013.10', 0)).toBe('013.10')
  expect(applyFileNumberOffset('013.10', 12)).toBe('1.10')
  expect(applyFileNumberOffset('900719925474099300', -1)).toBe('900719925474099301')
  expect(() => applyFileNumberOffset('SP13', 1)).toThrow()
  expect(() => applyFileNumberOffset('1', 2)).toThrow()
  expect(expandFileNumberRange('01', '03', 3)).toEqual(['1', '2', '3'])
  expect(() => expandFileNumberRange('1', '900719925474099300', 100)).toThrow()
})

test('a matched rule must produce every complete target, with no fallback to later rules', () => {
  const rule = {
    id: 'r',
    name: 'Synthetic rule',
    enabled: true,
    input: 'baseName',
    pattern: '(?<number>[0-9]+)(?: - (?<name>.+))?',
    ignoreCase: false,
    output: {
      targets: [
        {
          kind: 'episode',
          number: { kind: 'single', value: '$<number>', offset: 0 },
          name: '$<name>',
          episodeType: 'regular',
        },
      ],
    },
  }
  const definition = parseFileRecognitionDefinition('anime', { rules: [rule] })
  expect(interpretFileRules(definition, { baseName: '03', path: 'Work/03.mkv' })).toMatchObject({
    status: 'matched',
    targets: [{ kind: 'episode', number: { kind: 'single', value: '03' }, episodeType: 'regular' }],
  })
  const invalid = parseFileRecognitionDefinition('anime', {
    rules: [
      { ...rule, output: { targets: [{ kind: 'extra', name: '$<name>' }] } },
      { ...rule, id: 'next' },
    ],
  })
  expect(() => interpretFileRules(invalid, { baseName: '03', path: 'Work/03.mkv' })).toThrow()
  expect(() =>
    parseFileRecognitionDefinition('anime', {
      rules: [
        {
          ...rule,
          enabled: false,
          output: {
            targets: [
              { kind: 'extra', number: { kind: 'single', value: '1', offset: 0 }, name: 'OP' },
            ],
          },
        },
      ],
    }),
  ).toThrow()
  expect(() =>
    parseFileRecognitionDefinition('comic', {
      rules: [
        {
          ...rule,
          output: {
            targets: [
              {
                kind: 'chapter',
                number: { kind: 'single', value: '$<number>', offset: 0 },
                numberBasis: 'volume',
              },
            ],
          },
        },
      ],
    }),
  ).toThrow()
})
