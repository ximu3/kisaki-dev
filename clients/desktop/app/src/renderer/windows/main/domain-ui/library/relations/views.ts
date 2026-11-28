import {
  isWorkType,
  reverseWorkRelationType,
  type EntryRef,
} from '@kisaki3/desktop-contracts/library'
import type {
  LibraryFact,
  LibraryRelationScope,
  RelationFamily,
} from '../../../../../../shared/window-api/library'

export interface RelationView {
  family: RelationFamily
  scope: LibraryRelationScope
  target: 'work' | 'character' | 'person' | 'organization' | 'from' | 'to'
}
export type RelationTab = 'characters' | 'persons' | 'organizations' | 'related' | 'works'
export function relationTabs(ref: EntryRef): RelationTab[] {
  if (isWorkType(ref.type)) {
    return ['characters', 'persons', 'organizations', 'related']
  }
  if (ref.type === 'character') {
    return ['persons', 'works']
  }
  if (ref.type === 'person') {
    return ['characters', 'works']
  }
  return ['works']
}
export function relationViews(ref: EntryRef, tab: RelationTab): RelationView[] {
  if (isWorkType(ref.type)) {
    const work = { id: ref.id, type: ref.type },
      scope = { side: 'work' as const, work }
    switch (tab) {
      case 'characters':
        return [{ family: 'workCharacters', scope, target: 'character' }]
      case 'persons':
        return [{ family: 'personWorks', scope, target: 'person' }]
      case 'organizations':
        return [{ family: 'organizationWorks', scope, target: 'organization' }]
      case 'related':
        return [
          { family: 'workRelations', scope: { side: 'from', work }, target: 'to' },
          { family: 'workRelations', scope: { side: 'to', work }, target: 'from' },
        ]
      case 'works':
        return []
    }
  }
  if (ref.type === 'person') {
    return [
      {
        family: 'personWorks',
        scope: { side: 'person', personId: ref.id },
        target: tab === 'works' ? 'work' : 'character',
      },
    ]
  }
  if (ref.type === 'character') {
    const scope = { side: 'character' as const, characterId: ref.id }
    return tab === 'works'
      ? [{ family: 'workCharacters', scope, target: 'work' }]
      : [{ family: 'personWorks', scope, target: 'person' }]
  }
  return [
    {
      family: 'organizationWorks',
      scope: { side: 'organization', organizationId: ref.id },
      target: 'work',
    },
  ]
}
export function relatedRef(fact: LibraryFact, view: RelationView): EntryRef | null {
  if ('from' in fact) {
    return view.target === 'from' ? fact.from : fact.to
  }
  if (view.target === 'work') {
    return fact.work
  }
  if (view.target === 'person' && 'person' in fact) {
    return fact.person
  }
  if (view.target === 'organization' && 'organization' in fact) {
    return fact.organization
  }
  if ('character' in fact) {
    return fact.character
  }
  return null
}
export function roleOf(fact: LibraryFact, view: RelationView) {
  if ('from' in fact) {
    return view.target === 'from' ? reverseWorkRelationType(fact.type) : fact.type
  }
  return fact.role ?? 'unknown'
}
