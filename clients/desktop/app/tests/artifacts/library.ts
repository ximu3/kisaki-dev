import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { appRoot } from '../../tools/lib/paths'
import { initializeDatabase } from '../../src/main/infrastructure/database'
import { libraryStorage } from '../../src/main/features/library/storage'
import { storageOptions } from '../integration/database/sample'

export async function prepareMediaSample(profile: string, resources: string) {
  const root = join(profile, 'sample-media'),
    path = join(root, 'Opening.mkv')
  await mkdir(root)
  await copyFile(join(appRoot, 'tests', 'fixtures', 'media', 'two-chapters.mkv'), path)
  const setup = storageOptions(profile, join(resources, 'drizzle'))
  const storage = initializeDatabase(setup)
  try {
    const library = libraryStorage(storage)
    const work = {
      type: 'anime' as const,
      id: library.createLibraryEntry({ type: 'anime', name: 'Carrier sample' }, []).value.id,
    }
    const part = library.addLibraryPart(
      { type: 'animeEpisode', work, data: { type: 'regular', numberLabel: '1' } },
      [],
    ).value
    const rule = library.addRecognitionProfile('anime', {
      name: 'Opening',
      description: null,
      definition: {
        rules: [
          {
            id: 'opening',
            name: 'Opening',
            enabled: true,
            input: 'baseName',
            pattern: 'Opening',
            ignoreCase: false,
            output: {
              targets: [
                {
                  kind: 'episode',
                  episodeType: 'regular',
                  number: { kind: 'single', value: '1', offset: 0 },
                },
              ],
            },
          },
        ],
      },
    })
    library.registerDirectory(work, { path: root, recognitionProfileId: rule.id }, [], null)
    return { path, episode: part.id }
  } finally {
    storage.close()
  }
}
export function readMediaSample(profile: string, sample: { path: string; episode: string }) {
  const db = new Database(join(profile, 'kisaki.sqlite'), { readonly: true, fileMustExist: true })
  try {
    return db
      .prepare(`select json_extract(f.metadata,'$.width') width,json_extract(f.metadata,'$.height') height,
     json_extract(f.metadata,'$.durationSeconds') seconds from anime_files f join anime_file_episodes link on link.file_id=f.id
     where f.path=? and link.episode_id=?`)
      .get(sample.path, sample.episode)
  } finally {
    db.close()
  }
}
