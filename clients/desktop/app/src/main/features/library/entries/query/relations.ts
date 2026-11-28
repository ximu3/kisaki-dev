import { sql, type SQL } from 'drizzle-orm'
import { reverseWorkRelationType, type EntryCondition } from '@kisaki3/desktop-contracts/library'
import { oneOf } from './fields'

export interface Visibility {
  sensitive: boolean
  spoilers: boolean
}

type LinkCondition = Extract<EntryCondition, { targets: unknown }>
const links = {
  workCharacters: ['work_character_links', 'work_id', 'character_id'],
  characterWorks: ['work_character_links', 'character_id', 'work_id'],
  workPersons: ['work_person_links', 'work_id', 'person_id'],
  workCharacterPersons: ['work_person_links', 'work_id', 'person_id'],
  characterPersons: ['work_person_links', 'character_id', 'person_id'],
  personWorks: ['work_person_links', 'person_id', 'work_id'],
  personCharacters: ['work_person_links', 'person_id', 'character_id'],
  workOrganizations: ['work_organization_links', 'work_id', 'organization_id'],
  organizationWorks: ['work_organization_links', 'organization_id', 'work_id'],
} as const

export function setCondition(
  targets: { op: 'any' | 'all' | 'none'; values: readonly string[] } | { op: 'empty' | 'notEmpty' },
  relation: SQL,
) {
  if (targets.op === 'empty') {
    return sql`not exists(${relation})`
  }
  if (targets.op === 'notEmpty') {
    return sql`exists(${relation})`
  }
  if (!('values' in targets)) {
    throw new TypeError('Expected selected values')
  }
  const ids = JSON.stringify(targets.values)
  if (targets.op === 'all') {
    return sql`not exists(select value from json_each(${ids}) except select target from (${relation}))`
  }
  const match = sql`exists(select 1 from (${relation}) where target in (select value from json_each(${ids})))`
  return targets.op === 'none' ? sql`not ${match}` : match
}

export function textCondition(
  value: SQL,
  test: { op: 'equals' | 'contains'; value: string } | { op: 'present' | 'absent' },
) {
  if (test.op === 'present') {
    return sql`nullif(trim(${value}),'') is not null`
  }
  if (test.op === 'absent') {
    return sql`nullif(trim(${value}),'') is null`
  }
  if (!('value' in test)) {
    throw new TypeError('Expected text')
  }
  const text = test.value.normalize('NFKC').toLowerCase()
  return test.op === 'equals'
    ? sql`library_text(${value})=${text}`
    : sql`instr(library_text(${value}),${text})>0`
}

function visibleEntry(id: SQL, view: Visibility) {
  return view.sensitive
    ? sql`1`
    : sql`exists(select 1 from entries visible where visible.id=${id} and not visible.is_nsfw)`
}

export function linkCondition(condition: LinkCondition, view: Visibility) {
  const { field, targets, where } = condition
  const selection =
    'values' in targets ? { op: targets.op, values: targets.values.map((ref) => ref.id) } : targets
  if (field === 'relatedWorks') {
    const edge = (reverse: boolean) => {
      const owner = reverse ? sql`l.to_id` : sql`l.from_id`
      const target = reverse ? sql`l.from_id` : sql`l.to_id`
      const predicates = [sql`${owner}=e.id`, visibleEntry(target, view)]
      if (where?.note) {
        predicates.push(textCondition(sql`l.note`, where.note))
      }
      if (where?.workTypes) {
        predicates.push(oneOf(reverse ? sql`l.from_type` : sql`l.to_type`, where.workTypes))
      }
      if (where?.relationTypes) {
        predicates.push(
          oneOf(
            sql`l.type`,
            reverse ? where.relationTypes.map(reverseWorkRelationType) : where.relationTypes,
          ),
        )
      }
      return sql`select ${target} target from work_relations l where ${sql.join(predicates, sql` and `)}`
    }
    return setCondition(selection, sql`${edge(false)} union all ${edge(true)}`)
  }

  const [table, ownerKey, targetKey] = links[field]
  const target = sql`l.${sql.identifier(targetKey)}`
  const predicates = [
    sql`l.${sql.identifier(ownerKey)}=e.id`,
    sql`${target} is not null`,
    visibleEntry(target, view),
  ]
  const join =
    table === 'work_person_links'
      ? sql`left join work_character_links cast_link on cast_link.work_id=l.work_id and cast_link.character_id=l.character_id`
      : sql.empty()
  if (!view.spoilers) {
    predicates.push(sql`not l.is_spoiler`)
  }
  if (table === 'work_person_links') {
    predicates.push(visibleEntry(sql`l.work_id`, view))
    const visibleCast = [visibleEntry(sql`l.character_id`, view)]
    if (!view.spoilers) {
      visibleCast.push(sql`not cast_link.is_spoiler`)
    }
    predicates.push(sql`(l.character_id is null or (${sql.join(visibleCast, sql` and `)}))`)
  }
  if (field === 'workCharacterPersons') {
    predicates.push(sql`l.character_id is not null`)
  }
  if (where?.note) {
    predicates.push(textCondition(sql`l.note`, where.note))
  }
  if (where && 'workTypes' in where && where.workTypes) {
    predicates.push(oneOf(sql`l.work_type`, where.workTypes))
  }
  if (where && 'works' in where && where.works) {
    predicates.push(
      oneOf(
        sql`l.work_id`,
        where.works.map((ref) => ref.id),
      ),
    )
  }
  if (where && 'personRoles' in where && where.personRoles) {
    predicates.push(oneOf(sql`l.role`, where.personRoles))
  }
  if (where && 'organizationRoles' in where && where.organizationRoles) {
    predicates.push(oneOf(sql`l.role`, where.organizationRoles))
  }
  if (where && 'characterRoles' in where && where.characterRoles) {
    const role = table === 'work_person_links' ? sql`cast_link.role` : sql`l.role`
    predicates.push(oneOf(role, where.characterRoles))
    if (table === 'work_person_links') {
      predicates.push(sql`l.character_id is not null`)
    }
  }
  if (field === 'workPersons' || field === 'workCharacterPersons' || field === 'personWorks') {
    const character = condition.where?.character
    if (character?.type === 'oneOf') {
      predicates.push(
        oneOf(
          sql`l.character_id`,
          character.refs.map((ref) => ref.id),
        ),
      )
    } else if (character) {
      predicates.push(
        character.type === 'none' ? sql`l.character_id is null` : sql`l.character_id is not null`,
      )
    }
  }

  return setCondition(
    selection,
    sql`select ${target} target from ${sql.identifier(table)} l ${join} where ${sql.join(predicates, sql` and `)}`,
  )
}
