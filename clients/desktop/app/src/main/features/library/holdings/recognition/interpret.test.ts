/** @fileoverview Verifies interpret behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'
import { parseFileRecognitionDefinition } from '@kisaki3/desktop-contracts/library'

import { interpretFileRules } from './interpret'

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
