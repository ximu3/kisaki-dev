/** @fileoverview Constrains four relation families to their real endpoints, roles and independent ordering sides. */

import { sql } from 'drizzle-orm'
import {
  primaryKey,
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import {
  canUseOrganizationRole,
  canUsePersonRole,
  characterRoles,
  organizationRoles,
  personRoles,
  workTypes,
} from '@kisaki3/desktop-contracts/library'
import type { StoredWorkRelationType } from '@kisaki3/desktop-contracts/library'
import { entries, characters, persons, organizations } from './catalog'
import { booleanValue, enumValue, idColumn, safeInteger } from './constraints'

/** Creates common work endpoint and relationship attributes. */
function participationFields() {
  return {
    id: idColumn(),
    workId: text('work_id').notNull(),
    workType: text('work_type', { enum: workTypes }).notNull(),
    note: text('note'),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    orderInWork: integer('order_in_work').notNull().default(0),
  }
}

export const workCharacterLinks = sqliteTable(
  'work_character_links',
  {
    ...participationFields(),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.entryId, { onDelete: 'cascade' }),
    role: text('role', { enum: characterRoles }),
    orderInCharacter: integer('order_in_character').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    foreignKey({
      columns: [table.workId, table.workType],
      foreignColumns: [entries.id, entries.type],
    }).onDelete('cascade'),
    unique('work_character_links_identity').on(table.workId, table.characterId),
    enumValue('work_character_links_work_type', table.workType, workTypes),
    enumValue('work_character_links_role', table.role, characterRoles),
    booleanValue('work_character_links_spoiler', table.isSpoiler),
    safeInteger('work_character_links_work_order', table.orderInWork),
    safeInteger('work_character_links_character_order', table.orderInCharacter),
    index('work_character_links_work').on(table.workId, table.orderInWork, table.id),
    index('work_character_links_character').on(table.characterId, table.orderInCharacter, table.id),
  ],
)

const personRoleCompatibility = workTypes
  .map((type) => {
    const unrestricted = personRoles
      .filter((role) => canUsePersonRole(role, type, false))
      .map((role) => `'${role}'`)
      .join(',')
    const withCharacter = personRoles
      .filter((role) => canUsePersonRole(role, type, true))
      .map((role) => `'${role}'`)
      .join(',')
    return `("work_type" = '${type}' and "role" in (${unrestricted}) and ("character_id" is null or "role" in (${withCharacter})))`
  })
  .join(' or ')

export const workPersonLinks = sqliteTable(
  'work_person_links',
  {
    ...participationFields(),
    personId: text('person_id')
      .notNull()
      .references(() => persons.entryId, { onDelete: 'cascade' }),
    characterId: text('character_id'),
    role: text('role', { enum: personRoles }).notNull(),
    orderInPerson: integer('order_in_person').notNull().default(0),
    orderInCharacter: integer('order_in_character'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    foreignKey({
      columns: [table.workId, table.workType],
      foreignColumns: [entries.id, entries.type],
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workId, table.characterId],
      foreignColumns: [workCharacterLinks.workId, workCharacterLinks.characterId],
    }).onDelete('cascade'),
    uniqueIndex('work_person_links_general_identity')
      .on(table.workId, table.personId, table.role)
      .where(sql`${table.characterId} is null`),
    uniqueIndex('work_person_links_character_identity')
      .on(table.workId, table.personId, table.role, table.characterId)
      .where(sql`${table.characterId} is not null`),
    check('work_person_links_role', sql.raw(personRoleCompatibility)),
    check(
      'work_person_links_character_order_present',
      sql`(${table.characterId} is null) = (${table.orderInCharacter} is null)`,
    ),
    booleanValue('work_person_links_spoiler', table.isSpoiler),
    safeInteger('work_person_links_work_order', table.orderInWork),
    safeInteger('work_person_links_person_order', table.orderInPerson),
    safeInteger('work_person_links_character_order', table.orderInCharacter),
    index('work_person_links_work').on(table.workId, table.orderInWork, table.id),
    index('work_person_links_person').on(table.personId, table.role, table.workId),
    index('work_person_links_person_ordered').on(table.personId, table.orderInPerson, table.id),
    index('work_person_links_character').on(table.characterId, table.orderInCharacter, table.id),
  ],
)

const organizationRoleCompatibility = workTypes
  .map((type) => {
    const roles = organizationRoles
      .filter((role) => canUseOrganizationRole(role, type))
      .map((role) => `'${role}'`)
      .join(',')
    return `("work_type" = '${type}' and "role" in (${roles}))`
  })
  .join(' or ')

export const workOrganizationLinks = sqliteTable(
  'work_organization_links',
  {
    ...participationFields(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.entryId, { onDelete: 'cascade' }),
    role: text('role', { enum: organizationRoles }).notNull(),
    orderInOrganization: integer('order_in_organization').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    foreignKey({
      columns: [table.workId, table.workType],
      foreignColumns: [entries.id, entries.type],
    }).onDelete('cascade'),
    unique('work_organization_links_identity').on(table.workId, table.organizationId, table.role),
    check('work_organization_links_role', sql.raw(organizationRoleCompatibility)),
    booleanValue('work_organization_links_spoiler', table.isSpoiler),
    safeInteger('work_organization_links_work_order', table.orderInWork),
    safeInteger('work_organization_links_organization_order', table.orderInOrganization),
    index('work_organization_links_work').on(table.workId, table.orderInWork, table.id),
    index('work_organization_links_organization').on(
      table.organizationId,
      table.role,
      table.workId,
    ),
    index('work_organization_links_organization_ordered').on(
      table.organizationId,
      table.orderInOrganization,
      table.id,
    ),
  ],
)

const storedRelationTypes = [
  'sequel',
  'sideStory',
  'spinOff',
  'summary',
  'adaptation',
  'remake',
  'remaster',
  'port',
  'expansion',
  'compilation',
  'alternativeVersion',
  'related',
] as const satisfies readonly StoredWorkRelationType[]

export const workRelations = sqliteTable(
  'work_relations',
  {
    id: idColumn(),
    fromId: text('from_id').notNull(),
    fromType: text('from_type', { enum: workTypes }).notNull(),
    toId: text('to_id').notNull(),
    toType: text('to_type', { enum: workTypes }).notNull(),
    type: text('type', { enum: storedRelationTypes }).notNull(),
    note: text('note'),
    orderInFrom: integer('order_in_from').notNull().default(0),
    orderInTo: integer('order_in_to').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    foreignKey({
      columns: [table.fromId, table.fromType],
      foreignColumns: [entries.id, entries.type],
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.toId, table.toType],
      foreignColumns: [entries.id, entries.type],
    }).onDelete('cascade'),
    unique('work_relations_identity').on(table.fromId, table.toId, table.type),
    enumValue('work_relations_from_type', table.fromType, workTypes),
    enumValue('work_relations_to_type', table.toType, workTypes),
    enumValue('work_relations_type', table.type, storedRelationTypes),
    check('work_relations_distinct', sql`${table.fromId} <> ${table.toId}`),
    check(
      'work_relations_symmetric_order',
      sql`${table.type} not in ('alternativeVersion', 'related') or ${table.fromId} < ${table.toId} collate binary`,
    ),
    check(
      'work_relations_same_medium',
      sql`${table.type} not in ('remake', 'remaster') or ${table.fromType} = ${table.toType}`,
    ),
    check(
      'work_relations_game_only',
      sql`${table.type} not in ('port', 'expansion') or (${table.fromType} = 'game' and ${table.toType} = 'game')`,
    ),
    safeInteger('work_relations_from_order', table.orderInFrom),
    safeInteger('work_relations_to_order', table.orderInTo),
    index('work_relations_from').on(table.fromId, table.orderInFrom, table.id),
    index('work_relations_to').on(table.toId, table.orderInTo, table.id),
  ],
)
