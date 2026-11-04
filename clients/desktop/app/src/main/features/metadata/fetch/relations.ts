/** @fileoverview Combines successful relation coverage and subtracts unanswered participating scopes. */

import {
  isWorkType,
  workTypes,
  personRoles,
  organizationRoles,
  workRelationTypes,
  canUsePersonRole,
  canUseOrganizationRole,
  canUseWorkRelation,
} from '@kisaki3/desktop-contracts/library'
import type {
  WorkType,
  WorkRelationType,
  EntryType,
  PersonRole,
  OrganizationRole,
} from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

import type {
  ScopedMetadataRelationKey,
  MetadataRelationScopeValues,
  PersonWorkScopeCondition,
  OrganizationWorkMetadataScope,
  WorkRelationMetadataScope,
} from '@kisaki3/desktop-contracts/metadata'
import { parseMetadataRelationScope } from '@kisaki3/desktop-contracts/metadata'

/** A source with unknown actual scope, such as a failed session opening, protects the entire root relation context. */
export type MetadataScopeAnswer<K extends keyof MetadataRelationScopeValues> =
  | {
      readonly status: 'answered'
      readonly empty: boolean
      readonly scope: MetadataRelationScopeValues[K] | null
    }
  | { readonly status: 'unanswered'; readonly scope?: MetadataRelationScopeValues[K] | null }

/**
 * Compute only replacement coverage: selected successful scopes minus participating unanswered scopes.
 * Null/unknown participating scope protects the complete root. Returned members are handled separately by field selection.
 */
export function combineMetadataRelationScope<
  T extends EntryType,
  K extends ScopedMetadataRelationKey<T>,
>(
  root: T,
  relation: K,
  answers: readonly MetadataScopeAnswer<K>[],
  selection: 'first' | 'firstNonEmpty' | 'union',
): MetadataRelationScopeValues[K] | undefined {
  const chosen: MetadataScopeAnswer<K>[] = []
  const missing: MetadataScopeAnswer<K>[] = []
  const considered: MetadataScopeAnswer<K>[] = []
  let firstEmpty: MetadataScopeAnswer<K> | undefined
  for (const answer of answers) {
    considered.push(answer)
    if (answer.status === 'unanswered') {
      missing.push(answer)
      continue
    }
    if (selection === 'union') {
      chosen.push(answer)
      continue
    }
    if (selection === 'first' || !answer.empty) {
      chosen.push(answer)
      break
    }
    firstEmpty ??= answer
  }

  if (chosen.length === 0 && firstEmpty) {
    chosen.push(firstEmpty)
  }
  if (
    chosen.length === 0 ||
    considered.some((answer) => answer.scope === null || answer.scope === undefined)
  ) {
    return undefined
  }

  const allowed = new Map<string, ScopeAtom>()
  for (const answer of chosen) {
    const scope = parseMetadataRelationScope(root, relation, answer.scope)
    for (const atom of scopeAtoms(root, relation, scope)) {
      allowed.set(atomKey(atom), atom)
    }
  }

  for (const answer of missing) {
    const scope = parseMetadataRelationScope(root, relation, answer.scope)
    for (const atom of scopeAtoms(root, relation, scope)) {
      allowed.delete(atomKey(atom))
    }
  }

  if (allowed.size === 0) {
    return undefined
  }
  if (allowed.size === universe(root, relation).length) {
    return 'all' as MetadataRelationScopeValues[K]
  }

  const atoms = [...allowed.values()]
  let result: MetadataRelationScopeValues[keyof MetadataRelationScopeValues]
  if (relation === 'workCharacters') {
    const types = [...new Set(atoms.map((atom) => atom.workType))]
    result = [{ workTypes: [types[0]!, ...types.slice(1)] }]
  } else if (relation === 'personWorks') {
    const conditions = atoms.map((atom): PersonWorkScopeCondition => ({
      workTypes: [atom.workType],
      roles: [atom.role as PersonRole],
      character: atom.character!,
    }))
    result = [conditions[0]!, ...conditions.slice(1)]
  } else if (relation === 'organizationWorks') {
    const conditions = atoms.map((atom): Exclude<OrganizationWorkMetadataScope, 'all'>[number] => ({
      workTypes: [atom.workType],
      roles: [atom.role as OrganizationRole],
    }))
    result = [conditions[0]!, ...conditions.slice(1)]
  } else if (relation === 'workRelations') {
    const conditions = atoms.map((atom): Exclude<WorkRelationMetadataScope, 'all'>[number] => ({
      targetTypes: [atom.targetType!],
      types: [atom.relationType!],
    }))
    result = [conditions[0]!, ...conditions.slice(1)]
  } else {
    result = 'all'
  }

  return result as MetadataRelationScopeValues[K]
}

function atomKey(atom: ScopeAtom): string {
  return JSON.stringify([
    atom.workType,
    atom.role,
    atom.character,
    atom.relationType,
    atom.targetType,
  ])
}

interface ScopeAtom {
  readonly workType: WorkType
  readonly role?: PersonRole | OrganizationRole
  readonly character?: 'none' | 'present'
  readonly relationType?: WorkRelationType
  readonly targetType?: WorkType
}

function universe(
  root: EntryType,
  relation: keyof MetadataRelationScopeValues,
): readonly ScopeAtom[] {
  const types = isWorkType(root) ? [root] : workTypes
  const result: ScopeAtom[] = []
  for (const workType of types) {
    if (relation === 'personWorks') {
      for (const role of personRoles) {
        for (const character of ['none', 'present'] as const) {
          if (
            (root !== 'character' || character === 'present') &&
            canUsePersonRole(role, workType, character === 'present')
          ) {
            result.push({ workType, role, character })
          }
        }
      }
    } else if (relation === 'organizationWorks') {
      for (const role of organizationRoles) {
        if (canUseOrganizationRole(role, workType)) {
          result.push({ workType, role })
        }
      }
    } else if (relation === 'workRelations') {
      for (const targetType of workTypes) {
        for (const relationType of workRelationTypes) {
          if (canUseWorkRelation(relationType, workType, targetType)) {
            result.push({ workType, targetType, relationType })
          }
        }
      }
    } else {
      result.push({ workType })
    }
  }

  return result
}

function scopeAtoms(
  root: EntryType,
  relation: keyof MetadataRelationScopeValues,
  scope: MetadataRelationScopeValues[keyof MetadataRelationScopeValues],
): readonly ScopeAtom[] {
  const all = universe(root, relation)
  if (scope === 'all') {
    return all
  }

  const selected = new Map<string, ScopeAtom>()
  for (const condition of scope) {
    const atoms = all.filter(
      (atom) =>
        (!('workTypes' in condition) ||
          condition.workTypes === undefined ||
          condition.workTypes.includes(atom.workType)) &&
        (!('roles' in condition) ||
          condition.roles === undefined ||
          condition.roles.some((role) => role === atom.role)) &&
        (!('character' in condition) ||
          condition.character === undefined ||
          condition.character === atom.character) &&
        (!('types' in condition) ||
          condition.types === undefined ||
          condition.types.includes(atom.relationType!)) &&
        (!('targetTypes' in condition) ||
          condition.targetTypes === undefined ||
          condition.targetTypes.includes(atom.targetType!)),
    )
    if (atoms.length === 0) {
      throw new DesktopError(
        'InvalidInput',
        'Metadata relation scope contradicts its root, medium or responsibility',
      )
    }

    for (const atom of atoms) {
      selected.set(atomKey(atom), atom)
    }
  }

  return [...selected.values()]
}
