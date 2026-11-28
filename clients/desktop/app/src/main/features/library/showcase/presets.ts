import {
  workTypes,
  type EntryCondition,
  type EntryRule,
  type EntrySort,
  type ShowcaseFields,
  type ShowcasePreset,
  type ShowcaseQuery,
} from '@kisaki3/desktop-contracts/library'
import { createTranslator, type Translate } from '@kisaki3/desktop-localization'

const english = createTranslator('en', {})
const recent: EntrySort = { type: 'field', field: 'lastActiveAt', direction: 'desc' }
const added: EntrySort = { type: 'field', field: 'effectiveAddedDate', direction: 'desc' }
const scope: EntrySort = { type: 'scope' }

function entries(
  types: EntryRule['types'],
  conditions: EntryCondition[],
  sort: EntrySort,
): ShowcaseQuery {
  return {
    kind: 'entry',
    scope: { type: 'library' },
    search: '',
    sort,
    referenceLabels: [],
    rules: [{ enabled: true, types, filter: { match: 'all', conditions } }],
  }
}
function favorites(types: EntryRule['types']) {
  return entries(types, [{ field: 'favorite', op: 'is', value: true }], scope)
}

const definitions = [
  [
    'recently-used-works',
    'recentlyUsed',
    entries(workTypes, [{ field: 'lastActiveAt', op: 'present' }], recent),
    'horizontal',
    12,
  ],
  [
    'active-works',
    'active',
    entries(workTypes, [{ field: 'status', op: 'in', values: ['active'] }], recent),
    'horizontal',
    12,
  ],
  [
    'planned-works',
    'planned',
    entries(workTypes, [{ field: 'status', op: 'in', values: ['planned'] }], added),
    'horizontal',
    12,
  ],
  ['recently-added-works', 'recentlyAdded', entries(workTypes, [], added), 'grid', null],
  ['favorite-works', 'favoriteWorks', favorites(workTypes), 'grid', 24],
  [
    'personal-rating-ranking',
    'rating',
    entries(workTypes, [{ field: 'rating', op: 'present' }], {
      type: 'field',
      field: 'rating',
      direction: 'desc',
    }),
    'horizontal',
    12,
  ],
  ['favorite-characters', 'favoriteCharacters', favorites(['character']), 'grid', 24],
  ['favorite-persons', 'favoritePersons', favorites(['person']), 'grid', 24],
  ['favorite-organizations', 'favoriteOrganizations', favorites(['organization']), 'grid', 24],
  ['collections', 'collections', { kind: 'collection', sort: scope, search: '' }, 'horizontal', 12],
] as const satisfies readonly (readonly [
  string,
  string,
  ShowcaseQuery,
  ShowcaseFields['layout'],
  number | null,
])[]

export function showcasePresets(locale: string, t: Translate): readonly ShowcasePreset[] {
  return definitions.map(([id, key, query, layout, limit]) => {
    const title = t(`showcase.presets.${key}.name`)
    return {
      id,
      defaultLocale: 'en',
      name: { en: english(`showcase.presets.${key}.name`), [locale]: title },
      description: {
        en: english(`showcase.presets.${key}.description`),
        [locale]: t(`showcase.presets.${key}.description`),
      },
      initial: {
        name: title,
        layout,
        limit,
        query: structuredClone(query),
        itemSize: 'md',
        openMode: 'page',
        isVisible: true,
      },
    }
  })
}
