/** @fileoverview Verifies fixed showcase presets and explicit all-or-nothing section edits. */

import { describe, expect, it } from 'vitest'
import {
  createShowcasePresets,
  parseShowcaseChanges,
  parseShowcaseConfiguration,
  parseShowcaseQuery,
} from './showcase'

describe('showcase configuration', () => {
  it('provides ten valid independent presets and preserves the unlimited recently-added range', () => {
    const presets = createShowcasePresets()
    expect(presets).toHaveLength(10)
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(10)
    for (const preset of presets) {
      expect(() => parseShowcaseConfiguration(preset.configuration)).not.toThrow()
    }
    expect(
      presets.find((preset) => preset.id === 'recently-added-works')?.configuration,
    ).toMatchObject({ layout: 'grid', limit: null })
    expect(
      presets.find((preset) => preset.id === 'personal-rating-ranking')?.configuration.query,
    ).toMatchObject({ rules: [{ filter: { conditions: [{ field: 'rating', op: 'present' }] } }] })
  })

  it('rejects wrong query fields and missing queries instead of using empty filters', () => {
    expect(() =>
      parseShowcaseQuery({
        kind: 'tag',
        search: '',
        sort: { type: 'scope' },
        membershipMode: 'manual',
      }),
    ).toThrow()
    expect(() =>
      parseShowcaseConfiguration({
        name: 'Section',
        layout: 'grid',
        itemSize: 'md',
        openMode: 'page',
        limit: 12,
        isVisible: true,
      }),
    ).toThrow()
  })

  it('requires independent changed baselines and complete draft-key order membership', () => {
    const configuration = createShowcasePresets()[0]!.configuration
    expect(() =>
      parseShowcaseChanges({
        update: [{ id: 's', changes: { name: 'New' }, expected: { layout: 'grid' } }],
      }),
    ).toThrow()
    expect(() =>
      parseShowcaseChanges({
        create: [{ key: 'new', ...configuration }],
        order: { items: [], expected: { order: [] } },
      }),
    ).toThrow()
    expect(() =>
      parseShowcaseChanges({
        update: [{ id: 's', changes: { name: 'New' } }],
        delete: [{ id: 's' }],
      }),
    ).toThrow()
    expect(
      parseShowcaseChanges({
        create: [{ key: 'new', ...configuration }],
        order: { items: [{ key: 'new' }], expected: { order: [] } },
      }).order?.items,
    ).toEqual([{ key: 'new' }])
  })
})
