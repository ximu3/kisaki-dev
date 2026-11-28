import { sql, type SQL } from 'drizzle-orm'
import type { EntryCondition, EntryRule } from '@kisaki3/desktop-contracts/library'
import { searchText } from '../../../../infrastructure/database/search-text'
import { compareRange, dateTest, instantTest } from './dates'
import { oneOf, partCount, scalar } from './fields'
import { linkCondition, setCondition, textCondition, type Visibility } from './relations'

export function filterEntry(condition: EntryCondition, view: Visibility): SQL {
  if ('targets' in condition) {
    return linkCondition(condition, view)
  }
  switch (condition.field) {
    case 'parts':
      return compareRange(partCount(condition.scope, condition.measure), condition.bounds)
    case 'tags': {
      const nsfw = view.sensitive ? sql.empty() : sql`and not t.is_nsfw`
      const spoilers = view.spoilers ? sql.empty() : sql`and not l.is_spoiler`
      return setCondition(
        condition,
        sql`select l.tag_id target from entry_tags l join tags t on t.id=l.tag_id where l.entry_id=e.id ${nsfw} ${spoilers}`,
      )
    }
    case 'manualCollections':
      return setCondition(
        condition,
        sql`select m.collection_id target from collection_members m join collections c on c.id=m.collection_id where m.entry_id=e.id ${view.sensitive ? sql.empty() : sql`and not c.is_nsfw`}`,
      )
    case 'sources':
      return setCondition(
        condition,
        sql`select source target from entry_external_identities where entry_id=e.id`,
      )
    case 'originalLanguages':
      return setCondition(
        condition,
        sql`select value target from json_each(${scalar('originalLanguages')})`,
      )
    case 'completions': {
      const checks = [sql`r.work_id=e.id`]
      if (condition.where.note) {
        checks.push(textCondition(sql`r.note`, condition.where.note))
      }
      if (condition.where.completedDate) {
        checks.push(dateTest(sql`r.completed_date`, condition.where.completedDate))
      }
      const match = sql`exists(select 1 from work_completion_records r where ${sql.join(checks, sql` and `)})`
      return condition.match === 'exists' ? match : sql`not ${match}`
    }
    case 'createdAt':
    case 'updatedAt':
    case 'lastActiveAt':
      return instantTest(scalar(condition.field), condition)
    case 'birthDate':
    case 'releaseDate':
    case 'effectiveAddedDate':
    case 'releaseEndDate':
    case 'deathDate':
    case 'foundedDate':
    case 'dissolvedDate':
    case 'firstCompletedDate':
    case 'lastCompletedDate':
      return dateTest(scalar(condition.field), condition)
    case 'status':
    case 'releaseStatus':
    case 'gender':
    case 'bloodType': {
      const included = oneOf(scalar(condition.field), condition.values)
      return condition.op === 'in' ? included : sql`not ${included}`
    }
    case 'age':
    case 'height':
    case 'weight':
    case 'bust':
    case 'waist':
    case 'hips': {
      const value = scalar(condition.field)
      const kind = sql`json_extract(${value},'$.kind')`
      const contents = sql`json_extract(${value},'$.value')`
      if (condition.op === 'kind') {
        return sql`${kind}=${condition.value}`
      }
      if (condition.op === 'range') {
        return sql`(${kind}='number' and ${compareRange(contents, condition.bounds)})`
      }
      if (condition.op === 'contains' || condition.op === 'equals') {
        return sql`(${kind}='text' and ${textCondition(contents, condition)})`
      }
      return condition.op === 'present' ? sql`${value} is not null` : sql`${value} is null`
    }
    case 'cupSize':
    case 'originalName':
    case 'sortName':
    case 'description':
      return textCondition(scalar(condition.field), condition)
    case 'aliases':
    case 'externalLinks':
      return condition.op === 'present'
        ? sql`json_array_length(${scalar(condition.field)})>0`
        : sql`json_array_length(${scalar(condition.field)})=0`
    case 'accessibleFileCount':
    case 'addedDate':
    case 'additionalCompletionCount':
    case 'additionalDurationMs':
    case 'completionCount':
    case 'declaredChapterCount':
    case 'declaredDurationMs':
    case 'declaredPageCount':
    case 'declaredRegularEpisodeCount':
    case 'declaredSpecialEpisodeCount':
    case 'declaredVolumeCount':
    case 'favorite':
    case 'hasBackdrop':
    case 'hasIcon':
    case 'hasNotes':
    case 'hasPrimaryImage':
    case 'hasTitleLogo':
    case 'isNsfw':
    case 'rating':
    case 'registeredFileCount':
    case 'totalDurationMs':
    case 'uncheckedFileCount': {
      const value = scalar(condition.field)
      if (condition.op === 'range') {
        return compareRange(value, condition.bounds)
      }
      if (condition.op === 'is') {
        return sql`${value}=${Number(condition.value)}`
      }
      return condition.op === 'present' ? sql`${value} is not null` : sql`${value} is null`
    }
  }
}

export function rulePredicate(rules: readonly EntryRule[], search: string, view: Visibility) {
  const clauses: SQL[] = []
  for (const rule of rules) {
    if (!rule.enabled) {
      continue
    }
    const types = sql`e.type in (select value from json_each(${JSON.stringify(rule.types)}))`
    const tests = rule.filter.conditions.map((input) => filterEntry(input, view))
    const join = rule.filter.match === 'all' ? sql` and ` : sql` or `
    clauses.push(tests.length ? sql`(${types} and (${sql.join(tests, join)}))` : types)
  }
  if (!clauses.length) {
    return sql`0`
  }
  const checks = [sql`(${sql.join(clauses, sql` or `)})`]
  if (!view.sensitive) {
    checks.push(sql`not e.is_nsfw`)
  }
  for (const word of searchText(search).trim().split(/\s+/u).filter(Boolean)) {
    checks.push(
      sql`(instr(library_text(e.name),${word}) or instr(library_text(e.original_name),${word}) or instr(library_text(e.sort_name),${word}) or exists(select 1 from json_each(e.aliases) alias where instr(library_text(alias.value),${word})) or instr(library_markdown(e.description),${word}))`,
    )
  }
  return sql.join(checks, sql` and `)
}
