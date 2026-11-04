/** @fileoverview Checks replacement scope values against root and role applicability. */

import { expect, test } from 'vitest'
import { parseMetadataRelationScope } from './relations'

test('relation scopes reject incompatible medium and character conditions', () => {
  expect(() =>
    parseMetadataRelationScope('novel', 'personWorks', [{ roles: ['voiceActor'] }]),
  ).toThrow()

  expect(() =>
    parseMetadataRelationScope('character', 'personWorks', [{ character: 'none' }]),
  ).toThrow()
})
