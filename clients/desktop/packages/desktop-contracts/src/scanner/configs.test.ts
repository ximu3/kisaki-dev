/** @fileoverview Verifies saved scan scope, immutable work type, and explicit qualified recognizer selection. */

import { expect, it } from 'vitest'
import {
  createScanDefinition,
  parseScanConfigCreate,
  parseScanConfigUpdate,
  parseScanDefinition,
} from './configs'
import { parseWorkClues } from '../metadata/identification'

it('requires a real root, profile, and input kind without enabling all registered recognizers', () => {
  const definition = createScanDefinition(['directory'])
  expect(definition.identification).toEqual({ rules: [], recognizerIds: [] })
  expect(
    parseScanConfigCreate({
      name: 'Root',
      workType: 'game',
      rootPath: '/games',
      metadataProfileId: 'profile',
      definition,
    }),
  ).toMatchObject({ workType: 'game' })
  expect(() => parseScanDefinition({ ...definition, entryDepth: 0 })).toThrow()
  expect(() => parseScanDefinition({ ...definition, inputKinds: [] })).toThrow()
  expect(() =>
    parseScanDefinition({
      ...definition,
      identification: { rules: [], recognizerIds: ['unqualified'] },
    }),
  ).toThrow()
  expect(() => parseScanConfigUpdate({ changes: { workType: 'novel' } })).toThrow()
  expect(() =>
    parseScanConfigUpdate({ changes: { name: 'New' }, expected: { rootPath: '/games' } }),
  ).toThrow()
})

it('rejects clues outside the recognizer vocabulary instead of adopting arbitrary source metadata', () => {
  expect(parseWorkClues({ name: 'Work', releaseDate: { year: 0 } })).toMatchObject({
    releaseDate: { year: 0 },
  })
  expect(() => parseWorkClues({ releaseEndDate: { year: 2026 } })).toThrow()
  expect(() => parseWorkClues({ aliases: ['Other'] })).toThrow()
})
