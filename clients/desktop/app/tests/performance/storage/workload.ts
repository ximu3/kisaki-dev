import { setImmediate } from 'node:timers/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  entryTypes,
  personRoles,
  organizationRoles,
  canUsePersonRole,
  canUseOrganizationRole,
  parseDynamicRules,
  type EntryType,
  type WorkType,
} from '@kisaki3/desktop-contracts/library'
import type { initializeDatabase } from '../../../src/main/infrastructure/database'

/** Fixed simultaneous object counts and sampling policy, selected before measurement. */
export const workload = {
  revision: 2,
  entries: {
    game: 8000,
    anime: 10000,
    comic: 9000,
    novel: 8000,
    character: 5000,
    person: 5000,
    organization: 5000,
  },
  parts: {
    anime_episodes: 80000,
    anime_extras: 20000,
    comic_volumes: 40000,
    comic_chapters: 40000,
    novel_volumes: 20000,
  },
  relations: {
    work_character_links: 140000,
    work_person_links: 160000,
    work_organization_links: 100000,
    work_relations: 100000,
  },
  files: { anime_files: 50000, comic_files: 30000, novel_files: 20000 },
  activities: 500000,
  tags: 200,
  tagApplications: 100000,
  manualCollections: 20,
  manualMembers: 10000,
  dynamicCollections: 100,
  warmups: 3,
  samples: 31,
} as const

export const workerMedianBudgetMs = 100

export interface FixtureEntry {
  readonly id: string
  readonly type: EntryType
  readonly ordinal: number
  readonly local: number
  readonly name: string
}

export function fixtureId(kind: string, index: number): string {
  return `${kind}:${String(index).padStart(7, '0')}`
}

export function isFixtureWork(
  entry: FixtureEntry,
): entry is FixtureEntry & { readonly type: WorkType } {
  return (
    entry.type === 'game' ||
    entry.type === 'anime' ||
    entry.type === 'comic' ||
    entry.type === 'novel'
  )
}

/** Builds the fixed tables before sampling, with foreign keys and FULL durability enabled. */
export async function prepareWorkload(
  storage: ReturnType<typeof initializeDatabase>,
  directory: string,
) {
  const start = performance.now()
  const connection = storage.db.$client
  const inputHash = createHash('sha256').update(JSON.stringify(workload))
  const entries: FixtureEntry[] = []
  for (const type of entryTypes) {
    for (let local = 0; local < workload.entries[type]; local += 1) {
      const ordinal = entries.length
      const name = `${['作品', 'Item', 'Ｉｔｅｍ'][ordinal % 3]} ${local}`
      entries.push({
        id: fixtureId(type, local),
        type,
        ordinal,
        local,
        name,
      })
    }
  }
  const works = entries.filter(isFixtureWork)
  const voiceWorks = new Set<string>()
  const animeStatistics = entries
    .filter((entry) => entry.type === 'anime')
    .map(({ id }) => ({ id, duration: 0, parts: 0, files: 0 }))

  /** Commits one fixture table at a time and yields the worker between prepared statements. */
  async function insert(
    statement: string,
    count: number,
    values: (index: number) => readonly unknown[],
  ): Promise<void> {
    const prepared = connection.prepare(statement)
    inputHash.update(statement)

    const populate = connection.transaction(() => {
      for (let index = 0; index < count; index += 1) {
        const row = values(index)
        inputHash.update(
          JSON.stringify(
            row.map((value) =>
              typeof value === 'string' && value.startsWith(directory)
                ? `<fixture>${value.slice(directory.length).replaceAll('\\', '/')}`
                : value,
            ),
          ),
        )
        prepared.run(...row)
      }
    })

    populate()
    await setImmediate()
  }

  await insert(
    'insert into entries (id,type,name,aliases,description,created_at,updated_at) values (?,?,?,?,?,?,?)',
    entries.length,
    (index) => {
      const entry = entries[index]!
      return [
        entry.id,
        entry.type,
        entry.name,
        JSON.stringify([`別名 ${entry.local}`, `Alias ${entry.local}`]),
        '代表資料の本文。'.repeat(12),
        index,
        index,
      ]
    },
  )
  for (const [type, table] of [
    ['game', 'games'],
    ['anime', 'animes'],
    ['comic', 'comics'],
    ['novel', 'novels'],
    ['character', 'characters'],
    ['person', 'persons'],
    ['organization', 'organizations'],
  ] as const) {
    await insert(`insert into ${table} (entry_id) values (?)`, workload.entries[type], (index) => [
      fixtureId(type, index),
    ])
  }
  await insert(
    'insert into entry_evaluations (entry_id,rating,favorite) values (?,?,?)',
    entries.length,
    (index) => [entries[index]!.id, index % 101, Number(index % 7 === 0)],
  )
  await insert(
    'insert into entry_external_identities (source,source_id,entry_id) values (?,?,?)',
    entries.length,
    (index) => ['fixture-source', `source-${index}`, entries[index]!.id],
  )
  await insert(
    'insert into work_completion_records (id,work_id,work_type,completed_date,created_at,updated_at) values (?,?,?,?,?,?)',
    works.length,
    (index) => [
      fixtureId('completion', index),
      works[index]!.id,
      works[index]!.type,
      JSON.stringify({ year: 2000 + (index % 27), month: 1 + (index % 12), day: 1 + (index % 28) }),
      index,
      index,
    ],
  )

  for (const [table, owner, type] of [
    ['anime_episodes', 'anime_id', 'anime'],
    ['anime_extras', 'anime_id', 'anime'],
    ['comic_volumes', 'comic_id', 'comic'],
    ['comic_chapters', 'comic_id', 'comic'],
    ['novel_volumes', 'novel_id', 'novel'],
  ] as const) {
    await insert(
      `insert into ${table} (id,${owner},name,sort_order,created_at,updated_at) values (?,?,?,?,?,?)`,
      workload.parts[table],
      (index) => {
        const local = index % workload.entries[type]
        if (type === 'anime') {
          animeStatistics[local]!.parts += 1
        }
        return [
          fixtureId(table, index),
          fixtureId(type, local),
          `分部 ${index}`,
          Math.floor(index / workload.entries[type]),
          index,
          index,
        ]
      },
    )
  }
  await insert(
    'insert into work_character_links (id,work_id,work_type,character_id,role) values (?,?,?,?,?)',
    workload.relations.work_character_links,
    (index) => {
      const work = works[index % works.length]!
      return [
        fixtureId('cast', index),
        work.id,
        work.type,
        fixtureId(
          'character',
          ((index % works.length) + Math.floor(index / works.length) * 211) % 5000,
        ),
        'main',
      ]
    },
  )
  await insert(
    'insert into work_person_links (id,work_id,work_type,person_id,role,character_id,order_in_character) values (?,?,?,?,?,?,?)',
    workload.relations.work_person_links,
    (index) => {
      const offset = index % works.length
      const work = works[offset]!
      const person = (offset + Math.floor(index / works.length) * 419) % 5000
      const voice = work.type === 'anime' && offset % 2 === 0
      if (voice && person === 0) {
        voiceWorks.add(work.id)
      }
      return [
        fixtureId('person-link', index),
        work.id,
        work.type,
        fixtureId('person', person),
        voice
          ? 'voiceActor'
          : personRoles.find((role) => canUsePersonRole(role, work.type, false))!,
        voice ? fixtureId('character', offset % 5000) : null,
        voice ? 0 : null,
      ]
    },
  )
  await insert(
    'insert into work_organization_links (id,work_id,work_type,organization_id,role) values (?,?,?,?,?)',
    workload.relations.work_organization_links,
    (index) => {
      const work = works[index % works.length]!
      return [
        fixtureId('organization-link', index),
        work.id,
        work.type,
        fixtureId(
          'organization',
          ((index % works.length) + Math.floor(index / works.length) * 313) % 5000,
        ),
        organizationRoles.find((role) => canUseOrganizationRole(role, work.type))!,
      ]
    },
  )
  await insert(
    'insert into work_relations (id,from_id,from_type,to_id,to_type,type) values (?,?,?,?,?,?)',
    workload.relations.work_relations,
    (index) => {
      const first = works[index % works.length]!
      const second =
        works[((index % works.length) + 1 + Math.floor(index / works.length) * 17) % works.length]!
      const [from, to] = first.id < second.id ? [first, second] : [second, first]
      return [fixtureId('relation', index), from.id, from.type, to.id, to.type, 'related']
    },
  )

  for (const [table, owner, type, extension] of [
    ['anime_files', 'anime_id', 'anime', 'mkv'],
    ['comic_files', 'comic_id', 'comic', 'pdf'],
    ['novel_files', 'novel_id', 'novel', 'epub'],
  ] as const) {
    await insert(
      `insert into ${table} (id,${owner},path,availability,created_at,updated_at${type === 'anime' ? '' : ',kind'}) values (?,?,?,?,?,?${type === 'anime' ? '' : ',?'})`,
      workload.files[table],
      (index) => {
        const local = index % workload.entries[type]
        if (type === 'anime') {
          animeStatistics[local]!.files += 1
        }
        const values = [
          fixtureId(table, index),
          fixtureId(type, local),
          join(directory, 'media', `中文・深層/${type}/${index}.${extension}`),
          JSON.stringify(
            index % 2 ? { status: 'unchecked' } : { status: 'accessible', checkedAt: 1 },
          ),
          index,
          index,
        ]
        return type === 'anime' ? values : [...values, 'file']
      },
    )
  }
  await insert(
    'insert into anime_file_episodes (anime_id,file_id,episode_id) values (?,?,?)',
    workload.files.anime_files,
    (index) => [
      fixtureId('anime', index % workload.entries.anime),
      fixtureId('anime_files', index),
      fixtureId('anime_episodes', index),
    ],
  )
  await insert(
    'insert into comic_file_volumes (comic_id,file_id,volume_id) values (?,?,?)',
    workload.files.comic_files,
    (index) => [
      fixtureId('comic', index % workload.entries.comic),
      fixtureId('comic_files', index),
      fixtureId('comic_volumes', index),
    ],
  )
  await insert(
    'insert into novel_file_volumes (novel_id,file_id,volume_id) values (?,?,?)',
    workload.files.novel_files,
    (index) => [
      fixtureId('novel', index % workload.entries.novel),
      fixtureId('novel_files', index),
      fixtureId('novel_volumes', index),
    ],
  )

  const activities = {
    game: 'game_play_activity',
    anime: 'anime_watch_activity',
    comic: 'comic_reading_activity',
    novel: 'novel_reading_activity',
  } as const
  const activityInputs: Record<WorkType, number[]> = { game: [], anime: [], comic: [], novel: [] }
  for (let index = 0; index < workload.activities; index += 1) {
    const work = works[index % works.length]!
    activityInputs[work.type].push(index)
  }
  for (const type of ['game', 'anime', 'comic', 'novel'] as const) {
    await insert(
      `insert into ${activities[type]} (id,${type}_id,started_at,ended_at,duration_ms,context_names) values (?,?,?,?,?,?)`,
      activityInputs[type].length,
      (offset) => {
        const index = activityInputs[type][offset]!
        const work = works[index % works.length]!
        const duration = 500 + (index % 500)
        if (work.type === 'anime') {
          animeStatistics[work.local]!.duration += duration
        }
        return [
          fixtureId('activity', index),
          work.id,
          index * 1000,
          index * 1000 + 1000,
          duration,
          JSON.stringify(
            type === 'game'
              ? { launchConfigName: '保存時の設定' }
              : { fileName: '保存時のファイル' },
          ),
        ]
      },
    )
  }

  await insert(
    'insert into tags (id,name,name_key,created_at,updated_at) values (?,?,?,?,?)',
    workload.tags,
    (index) => [fixtureId('tag', index), `Tag ${index}`, `tag ${index}`, index, index],
  )
  await insert(
    'insert into entry_tags (entry_id,tag_id) values (?,?)',
    workload.tagApplications,
    (index) => [
      entries[index % entries.length]!.id,
      fixtureId(
        'tag',
        ((index % entries.length) + Math.floor(index / entries.length) * 73) % workload.tags,
      ),
    ],
  )
  await insert(
    'insert into collections (id,name,created_at,updated_at) values (?,?,?,?)',
    workload.manualCollections,
    (index) => [fixtureId('manual', index), `Manual ${index}`, index, index],
  )
  await insert(
    'insert into collection_members (collection_id,entry_id) values (?,?)',
    workload.manualMembers,
    (index) => [fixtureId('manual', index % 20), entries[index * 5]!.id],
  )
  await insert(
    'insert into collections (id,name,membership_mode,dynamic_rules,created_at,updated_at) values (?,?,?,?,?,?)',
    workload.dynamicCollections,
    (index) => [
      fixtureId('dynamic', index),
      `Dynamic ${index}`,
      'dynamic',
      JSON.stringify(
        parseDynamicRules({
          search: '',
          rules: [
            {
              enabled: true,
              types: entryTypes,
              filter: {
                match: 'all',
                conditions: [{ field: 'tags', op: 'any', values: [fixtureId('tag', index)] }],
              },
            },
          ],
          sort: { type: 'field', field: 'effectiveSortName', direction: 'asc' },
          referenceLabels: [
            { target: { type: 'tag', id: fixtureId('tag', index) }, name: `Tag ${index}` },
          ],
        }),
      ),
      index,
      index,
    ],
  )

  connection.pragma('optimize')
  connection.pragma('wal_checkpoint(TRUNCATE)')
  return {
    entries,
    voiceWorks,
    animeStatistics,
    inputSha256: inputHash.digest('hex'),
    preparationMs: performance.now() - start,
  }
}
