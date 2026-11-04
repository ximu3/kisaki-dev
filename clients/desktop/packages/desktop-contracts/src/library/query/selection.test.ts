/** @fileoverview Verifies selection behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { parseEntrySelection } from './selection'
import { parseEntryGroupsResult } from './listing'
import { parseDynamicRules } from './definition'

test('fixed group ranges require real expanded endpoints and preserve failed groups', () => {
  const group = { type: 'collection', id: 'c' } as const
  const endpoint = { group, ref: { type: 'game', id: 'g' } } as const

  expect(() =>
    parseEntrySelection({
      type: 'groupRange',
      anchor: endpoint,
      focus: endpoint,
      expandedGroups: [],
    }),
  ).toThrow()

  expect(
    parseEntrySelection({
      type: 'groupRange',
      anchor: endpoint,
      focus: endpoint,
      expandedGroups: [group],
    }),
  ).toMatchObject({ expandedGroups: [group] })

  const groups = {
    total: 2,
    groups: [
      {
        key: group,
        status: 'failed',
        error: { code: 'InvalidQuery', message: 'Invalid saved rule' },
      },
      {
        key: { type: 'unclassified' },
        status: 'failed',
        error: { code: 'InvalidQuery', message: 'Membership cannot be determined' },
      },
    ],
  }

  expect(parseEntryGroupsResult(groups)).toEqual(groups)

  expect(() =>
    parseDynamicRules({ search: '', rules: [], sort: { type: 'scope' }, referenceLabels: [] }),
  ).toThrow()
})
