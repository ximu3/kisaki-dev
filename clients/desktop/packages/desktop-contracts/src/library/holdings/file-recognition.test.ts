/** @fileoverview Checks file-recognition definition shape and complete target constraints. */

import { expect, test } from 'vite-plus/test'
import { parseFileRecognitionDefinition } from './file-recognition'

test('disabled rules still require legal target fields and complete chapter scope', () => {
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
