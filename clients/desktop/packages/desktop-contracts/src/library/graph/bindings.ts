import * as v from 'valibot'
import { DesktopError } from '../../errors'
import { fromParser, id, optionalFields } from '../../validation'
import { workTypes } from '../catalog'
import {
  characterRoles,
  personRoles,
  organizationRoles,
  workRelationTypes,
  canUsePersonRole,
  canUseOrganizationRole,
  canonicalWorkRelation,
  validateWorkRelation,
  parseWorkCharacterBinding,
  parsePersonWorkBinding,
  parseOrganizationWorkBinding,
  parseStoredWorkRelationBinding,
} from '../relations'
import { entryKey } from './nodes'
import {
  actions,
  properties,
  relationEdit,
  type GraphPersonWorkAdd,
  type GraphOrganizationWorkAdd,
  type GraphWorkRelationAdd,
  type GraphWorkCharacterAdd,
  type GraphRelations,
} from './relations'
import type { GraphReferences } from './references'

function characterKey(value: Pick<GraphWorkCharacterAdd, 'work' | 'character'>): string {
  return JSON.stringify([entryKey(value.work), entryKey(value.character)])
}

function personKey(value: GraphPersonWorkAdd): string {
  return JSON.stringify([
    entryKey(value.work),
    entryKey(value.person),
    value.role,
    value.character === null ? null : entryKey(value.character),
  ])
}

function organizationKey(value: GraphOrganizationWorkAdd): string {
  return JSON.stringify([entryKey(value.work), entryKey(value.organization), value.role])
}

export function bindingEdits({ entryReference, workType }: GraphReferences) {
  const work = entryReference(workTypes)
  const character = entryReference(['character'] as const)
  const person = entryReference(['person'] as const)
  const organization = entryReference(['organization'] as const)

  const characterFields = { work, character, role: v.nullable(v.picklist(characterRoles)) }
  const personFields = {
    work,
    person,
    character: v.nullable(character),
    role: v.picklist(personRoles),
  }
  const organizationFields = { work, organization, role: v.picklist(organizationRoles) }
  const relationFields = { from: work, to: work, type: v.picklist(workRelationTypes) }

  function checkPerson(value: Partial<GraphPersonWorkAdd>): void {
    if (
      value.work &&
      value.role &&
      value.character !== undefined &&
      !canUsePersonRole(value.role, workType(value.work), value.character !== null)
    ) {
      throw new DesktopError(
        'InvalidInput',
        'Person responsibility is not applicable to its graph work or character',
      )
    }
  }

  function checkOrganization(value: Partial<GraphOrganizationWorkAdd>): void {
    if (value.work && value.role && !canUseOrganizationRole(value.role, workType(value.work))) {
      throw new DesktopError(
        'InvalidInput',
        'Organization responsibility is not applicable to its graph work',
      )
    }
  }

  function workRelationBinding(value: GraphWorkRelationAdd) {
    return {
      from: { type: workType(value.from), id: entryKey(value.from) },
      to: { type: workType(value.to), id: entryKey(value.to) },
      type: value.type,
    }
  }

  // Inverse presentations of the same relationship share one key.
  function relationKey(value: GraphWorkRelationAdd): string {
    const normalized = canonicalWorkRelation(workRelationBinding(value))
    return JSON.stringify([normalized.from.id, normalized.to.id, normalized.type])
  }

  function checkRelation(value: Partial<GraphWorkRelationAdd>): void {
    if (value.from && value.to && value.type) {
      validateWorkRelation(
        workRelationBinding({ from: value.from, to: value.to, type: value.type }),
      )
    }
  }

  const characterBinding = fromParser(parseWorkCharacterBinding)
  const personBinding = fromParser(parsePersonWorkBinding)
  const organizationBinding = fromParser(parseOrganizationWorkBinding)
  const relationBinding = fromParser(parseStoredWorkRelationBinding)

  const characterAdd = v.strictObject({ ...characterFields, ...optionalFields(properties) })
  const personAdd = v.pipe(
    v.strictObject({ ...personFields, ...optionalFields(properties) }),
    v.transform((value) => {
      checkPerson(value)
      return value
    }),
  )
  const organizationAdd = v.pipe(
    v.strictObject({ ...organizationFields, ...optionalFields(properties) }),
    v.transform((value) => {
      checkOrganization(value)
      return value
    }),
  )
  const relationAdd = v.pipe(
    v.strictObject({ ...relationFields, note: v.exactOptional(properties.note) }),
    v.transform((value) => {
      checkRelation(value)
      return value
    }),
  )

  const personEdit = v.pipe(
    relationEdit(personFields, personBinding, true),
    v.transform((value) => {
      checkPerson({ ...value.expected?.binding, ...value.changes })
      return value
    }),
  )
  const organizationEdit = v.pipe(
    relationEdit(organizationFields, organizationBinding, true),
    v.transform((value) => {
      checkOrganization({ ...value.expected?.binding, ...value.changes })
      return value
    }),
  )
  const workRelationEdit = v.pipe(
    relationEdit(relationFields, relationBinding, false),
    v.transform((value) => {
      checkRelation({ ...value.expected?.binding, ...value.changes })
      return value
    }),
  )

  return {
    workCharacters: v.exactOptional(
      actions(
        characterAdd,
        relationEdit(characterFields, characterBinding, true),
        v.strictObject({ id, binding: characterBinding, ...properties }),
        characterKey,
      ),
    ),
    personWorks: v.exactOptional(
      actions(
        personAdd,
        personEdit,
        v.strictObject({ id, binding: personBinding, ...properties }),
        personKey,
      ),
    ),
    organizationWorks: v.exactOptional(
      actions(
        organizationAdd,
        organizationEdit,
        v.strictObject({ id, binding: organizationBinding, ...properties }),
        organizationKey,
      ),
    ),
    workRelations: v.exactOptional(
      actions(
        relationAdd,
        workRelationEdit,
        v.strictObject({ id, binding: relationBinding, note: properties.note }),
        relationKey,
      ),
    ),
  }
}

export function checkRemovedCharacterBindings(relations: GraphRelations | undefined) {
  const removedCharacterBindings = new Set(
    (relations?.workCharacters?.expected ?? []).map((item) => characterKey(item.binding)),
  )
  for (const item of relations?.personWorks?.add ?? []) {
    if (
      item.character &&
      removedCharacterBindings.has(characterKey({ work: item.work, character: item.character }))
    ) {
      throw new DesktopError(
        'InvalidInput',
        'A character-specific work cannot depend on a removed work-character relation',
      )
    }
  }
}
