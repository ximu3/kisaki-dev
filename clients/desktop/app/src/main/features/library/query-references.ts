import type {
  DynamicRules,
  EntryRule,
  EntryScope,
  QueryReferenceLabel,
  ShowcaseQuery,
} from '@kisaki3/desktop-contracts/library'

export type QueryTarget = QueryReferenceLabel['target']

type Visit = (target: QueryTarget, manual?: boolean) => string

function mapRule(rule: EntryRule, visit: Visit) {
  function refs(values: readonly QueryTarget[]) {
    const seen = new Set<string>()
    return values.flatMap((ref) => {
      const id = visit(ref),
        key = JSON.stringify([ref.type, id])
      if (seen.has(key)) {
        return []
      }
      seen.add(key)
      return [id === ref.id ? ref : { ...ref, id }]
    })
  }
  const conditions = rule.filter.conditions.map((condition) => {
    if (
      (condition.field === 'tags' || condition.field === 'manualCollections') &&
      'values' in condition
    ) {
      const manual = condition.field === 'manualCollections',
        type = manual ? 'collection' : 'tag'
      return {
        ...condition,
        values: [...new Set(condition.values.map((id) => visit({ type, id }, manual)))],
      }
    }
    if (!('targets' in condition)) {
      return condition
    }
    const targets = condition.targets
    const where = condition.where
    const character = where && 'character' in where ? where.character : undefined
    return {
      ...condition,
      targets: 'values' in targets ? { ...targets, values: refs(targets.values) } : targets,
      ...(where && {
        where: {
          ...where,
          ...('works' in where && where.works && { works: refs(where.works) }),
          ...(character?.type === 'oneOf' && {
            character: { ...character, refs: refs(character.refs) },
          }),
        },
      }),
    }
  })
  return { ...rule, filter: { ...rule.filter, conditions } }
}

export interface QueryReference {
  target: QueryTarget
  required: boolean
  manual: boolean
}

export function referencedTargets(scope: EntryScope, rules: readonly EntryRule[]) {
  const targets = new Map<string, QueryReference>()
  function add(target: QueryTarget, required: boolean, manual = false) {
    const key = JSON.stringify([target.type, target.id]),
      old = targets.get(key)
    targets.set(key, {
      target,
      required: required || !!old?.required,
      manual: manual || !!old?.manual,
    })
    return target.id
  }
  if ('id' in scope) {
    add(scope, true)
  }
  for (const rule of rules) {
    mapRule(rule, (ref, manual) => add(ref, rule.enabled, manual))
  }
  return targets.values()
}

export function replaceQueryReference(
  input: DynamicRules | ShowcaseQuery,
  from: QueryTarget,
  to: QueryTarget,
  name: string,
) {
  if ('kind' in input && input.kind !== 'entry') {
    return input
  }
  let changed = false
  function replace(ref: QueryTarget) {
    if (ref.type !== from.type || ref.id !== from.id) {
      return ref.id
    }
    changed = true
    return to.id
  }
  const rules = input.rules.map((rule) => mapRule(rule, replace))
  const scope =
    'scope' in input && 'id' in input.scope
      ? { ...input.scope, id: replace(input.scope) }
      : undefined
  const seen = new Set<string>()
  const referenceLabels = input.referenceLabels.flatMap((label) => {
    const id = replace(label.target),
      key = JSON.stringify([label.target.type, id])
    if (seen.has(key)) {
      return []
    }
    seen.add(key)
    return [id === label.target.id ? label : { target: to, name }]
  })
  return changed ? { ...input, rules, referenceLabels, ...(scope && { scope }) } : input
}
