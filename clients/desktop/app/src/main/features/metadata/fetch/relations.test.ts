/** @fileoverview Verifies relations behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { combineMetadataRelationScope } from './relations'
import { parseMetadataRelationScope } from '@kisaki3/desktop-contracts/metadata'

test('replacement coverage subtracts only affected failed ranges and respects member selection', () => {
  const studio = [{ roles: ['studio'] }] as const
  const publisher = [{ roles: ['publisher'] }] as const

  expect(
    combineMetadataRelationScope(
      'anime',
      'organizationWorks',
      [
        { status: 'answered', empty: false, scope: studio },
        { status: 'unanswered', scope: publisher },
      ],
      'union',
    ),
  ).toEqual([{ workTypes: ['anime'], roles: ['studio'] }])

  expect(
    combineMetadataRelationScope(
      'anime',
      'organizationWorks',
      [
        { status: 'answered', empty: false, scope: studio },
        { status: 'unanswered', scope: studio },
      ],
      'union',
    ),
  ).toBeUndefined()

  expect(
    combineMetadataRelationScope(
      'anime',
      'organizationWorks',
      [{ status: 'answered', empty: true, scope: 'all' }, { status: 'unanswered' }],
      'first',
    ),
  ).toBe('all')

  expect(
    combineMetadataRelationScope(
      'anime',
      'organizationWorks',
      [
        { status: 'answered', empty: true, scope: null },
        { status: 'answered', empty: false, scope: 'all' },
      ],
      'firstNonEmpty',
    ),
  ).toBeUndefined()

  expect(() =>
    parseMetadataRelationScope('novel', 'personWorks', [{ roles: ['voiceActor'] }]),
  ).toThrow()

  expect(() =>
    parseMetadataRelationScope('character', 'personWorks', [{ character: 'none' }]),
  ).toThrow()
})
