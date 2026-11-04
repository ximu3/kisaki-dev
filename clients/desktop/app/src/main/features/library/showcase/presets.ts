/** @fileoverview Builds independent showcase drafts from the fixed catalog and effective translated labels. */

import type { Translate } from '@kisaki3/desktop-localization'
import type {
  ShowcasePreset,
  EntryType,
  EntryCondition,
  EntrySort,
  ShowcaseQuery,
  ShowcaseFields,
} from '@kisaki3/desktop-contracts/library'
import { workTypes } from '@kisaki3/desktop-contracts/library'

/** Return fresh, complete preset values. Applying one to an existing draft preserves its identity, visibility and position. */
export function getShowcasePresets(t: Translate): readonly ShowcasePreset[] {
  function label(
    key:
      | 'recentlyUsed'
      | 'active'
      | 'planned'
      | 'recentlyAdded'
      | 'favoriteWorks'
      | 'rating'
      | 'favoriteCharacters'
      | 'favoritePersons'
      | 'favoriteOrganizations'
      | 'collections',
  ) {
    return {
      name: t(`showcase.presets.${key}.name`),
      description: t(`showcase.presets.${key}.description`),
    }
  }

  function entry(
    types: readonly [EntryType, ...EntryType[]],
    conditions: readonly EntryCondition[],
    sort: EntrySort,
  ): ShowcaseQuery {
    return {
      kind: 'entry',
      scope: { type: 'library' },
      search: '',
      rules: [{ enabled: true, types, filter: { match: 'all', conditions } }],
      sort,
      referenceLabels: [],
    }
  }

  function preset(
    key: string,
    label: { readonly name: string; readonly description: string },
    query: ShowcaseQuery,
    layout: ShowcaseFields['layout'] = 'horizontal',
    limit: number | null = 12,
  ): ShowcasePreset {
    return {
      id: key,
      defaultLocale: 'en',
      ...label,
      initial: {
        name: label.name,
        query,
        layout,
        itemSize: 'md',
        limit,
        openMode: 'page',
        isVisible: true,
      },
    }
  }

  const scope = { type: 'scope' } as const
  const lastActive = { type: 'field', field: 'lastActiveAt', direction: 'desc' } as const
  const added = { type: 'field', field: 'effectiveAddedDate', direction: 'desc' } as const
  const favorite = [{ field: 'favorite', op: 'is', value: true }] as const
  return [
    preset(
      'recently-used-works',
      label('recentlyUsed'),
      entry(workTypes, [{ field: 'lastActiveAt', op: 'present' }], lastActive),
    ),
    preset(
      'active-works',
      label('active'),
      entry(workTypes, [{ field: 'status', op: 'in', values: ['active'] }], lastActive),
    ),
    preset(
      'planned-works',
      label('planned'),
      entry(workTypes, [{ field: 'status', op: 'in', values: ['planned'] }], added),
    ),
    preset(
      'recently-added-works',
      label('recentlyAdded'),
      entry(workTypes, [], added),
      'grid',
      null,
    ),
    preset('favorite-works', label('favoriteWorks'), entry(workTypes, favorite, scope), 'grid', 24),
    preset(
      'personal-rating-ranking',
      label('rating'),
      entry(workTypes, [{ field: 'rating', op: 'present' }], {
        type: 'field',
        field: 'rating',
        direction: 'desc',
      }),
    ),
    preset(
      'favorite-characters',
      label('favoriteCharacters'),
      entry(['character'], favorite, scope),
      'grid',
      24,
    ),
    preset(
      'favorite-persons',
      label('favoritePersons'),
      entry(['person'], favorite, scope),
      'grid',
      24,
    ),
    preset(
      'favorite-organizations',
      label('favoriteOrganizations'),
      entry(['organization'], favorite, scope),
      'grid',
      24,
    ),
    preset('collections', label('collections'), { kind: 'collection', search: '', sort: scope }),
  ]
}
