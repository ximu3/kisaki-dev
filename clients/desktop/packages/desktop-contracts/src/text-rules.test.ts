/** @fileoverview Verifies finite templates, complete clue output, and medium-specific file rule values. */

import { describe, expect, it } from 'vitest'
import {
  applyFileNumberOffset,
  fileNumberLabelsEqual,
  parseFileRecognitionDefinition,
} from './library/file-recognition'
import {
  expandClueOutput,
  parseClueExtractionRule,
  validateClueOutputReferences,
} from './scanner/rules'
import { expandTextTemplate, parseTextTemplate } from './text-rules'

describe('capture templates and clues', () => {
  it('keeps missing captures distinct from captured empty strings and supports only named references', () => {
    expect(expandTextTemplate('prefix-$<value>-suffix', { value: undefined })).toBeUndefined()
    expect(expandTextTemplate('prefix-$<value>-suffix', { value: '' })).toBe('prefix--suffix')
    expect(expandTextTemplate('$$$<value>', { value: 'x' })).toBe('$x')
    for (const template of ['$1', '$&', '$', '$<>', '$<unclosed']) {
      expect(() => parseTextTemplate(template)).toThrow()
    }
    expect(() => validateClueOutputReferences({ name: '$<unknown>' }, new Set(['known']))).toThrow()
  })

  it('generates independent names, partial dates and exact identities without inventing missing facts', () => {
    expect(
      expandClueOutput(
        {
          name: '$<name>',
          releaseDate: { month: '02', day: '29' },
          externalIdentities: [
            { source: 'bangumi', sourceId: 'subject/$<id>' },
            { source: 'bangumi', sourceId: 'subject/$<id>' },
          ],
        },
        { name: '  Name  A  ', id: '123' },
      ),
    ).toEqual({
      name: 'Name  A',
      releaseDate: { month: 2, day: 29 },
      externalIdentities: [{ source: 'bangumi', sourceId: 'subject/123' }],
    })
    expect(expandClueOutput({ releaseDate: { year: '-0' } }, {})).toEqual({
      releaseDate: { year: 0 },
    })
    expect(expandClueOutput({ releaseDate: { year: '9007199254740991' } }, {})).toEqual({
      releaseDate: { year: Number.MAX_SAFE_INTEGER },
    })
    expect(() => expandClueOutput({ releaseDate: { year: '9007199254740992' } }, {})).toThrow()
    expect(() =>
      expandClueOutput({ releaseDate: { year: '2023', month: '02', day: '29' } }, {}),
    ).toThrow()
    expect(() => expandClueOutput({ releaseDate: { year: '12x' } }, {})).toThrow()
    expect(() =>
      expandClueOutput(
        { externalIdentities: [{ source: 'vndb', sourceId: '$<id>' }] },
        { id: undefined },
      ),
    ).toThrow()
    expect(() => expandClueOutput({ name: '$<name>' }, { name: ' ' })).toThrow()
    expect(() => expandClueOutput({ name: '$<name>' }, { name: undefined })).toThrow()
  })

  it('does not treat disabled malformed output as valid saved rule structure', () => {
    const base = {
      id: 'a',
      name: 'Rule',
      enabled: false,
      input: 'baseName',
      pattern: '.*',
      ignoreCase: false,
    }
    expect(() => parseClueExtractionRule({ ...base, output: {} })).toThrow()
    expect(() => parseClueExtractionRule({ ...base, output: { releaseDate: {} } })).toThrow()
    expect(() => parseClueExtractionRule({ ...base, output: { name: '$1' } })).toThrow()
    expect(() => parseClueExtractionRule({ ...base, output: { externalIdentities: [] } })).toThrow()
  })
})

describe('file recognition values', () => {
  const base = {
    id: 'a',
    name: 'Rule',
    enabled: true,
    input: 'path',
    pattern: '.*',
    ignoreCase: false,
  }
  const number = { kind: 'single', value: '$<n>', offset: 0 }
  it('requires explicit whole targets and correct chapter numbering scope', () => {
    expect(
      parseFileRecognitionDefinition('comic', {
        rules: [
          {
            ...base,
            output: {
              targets: [
                {
                  kind: 'chapter',
                  number,
                  numberBasis: 'volume',
                  volume: { number: { value: '$<v>', offset: 0 } },
                },
              ],
            },
          },
        ],
      }).rules,
    ).toHaveLength(1)
    for (const target of [
      { kind: 'chapter', number },
      { kind: 'chapter', number, numberBasis: 'volume' },
      { kind: 'chapter', name: 'One', numberBasis: 'work' },
      { kind: 'volume' },
    ]) {
      expect(() =>
        parseFileRecognitionDefinition('comic', {
          rules: [{ ...base, output: { targets: [target] } }],
        }),
      ).toThrow()
    }
    expect(() =>
      parseFileRecognitionDefinition('anime', {
        rules: [{ ...base, output: { targets: [{ kind: 'extra', number, name: 'Opening' }] } }],
      }),
    ).toThrow()
    expect(() =>
      parseFileRecognitionDefinition('novel', { rules: [{ ...base, output: { targets: [] } }] }),
    ).toThrow()
  })

  it('uses exact integer offsets and retains meaningful fractional text', () => {
    expect(applyFileNumberOffset('013.10', 12)).toBe('1.10')
    expect(applyFileNumberOffset(' 013.10 ', 0)).toBe(' 013.10 ')
    expect(applyFileNumberOffset('900719925474099212345', 1)).toBe('900719925474099212344')
    expect(applyFileNumberOffset('1', -12)).toBe('13')
    expect(() => applyFileNumberOffset('SP13', 1)).toThrow()
    expect(() => applyFileNumberOffset('1', 2)).toThrow()
    expect(fileNumberLabelsEqual('03', '3')).toBe(true)
    expect(fileNumberLabelsEqual('1.10', '1.1')).toBe(false)
    expect(fileNumberLabelsEqual('SP01', 'SP1')).toBe(false)
  })
})
