import { workTypes, type FileWorkType } from '../catalog'
import { DesktopError } from '../../errors'
import type { GraphReferences } from './references'
import * as v from 'valibot'
import { fromParser, parseRecord, parseValue, unique } from '../../validation'
import { parseFileCreateFields, type FileCreateFields } from '../holdings/files'
import { filePartTypes, type FilePartType } from '../holdings/associations'
import { entryKey, partKey, type GraphPartRef, type GraphEntryRef } from './nodes'
import { parseDirectoryCreateFields, type DirectoryCreateFields } from '../holdings/directories'
import {
  parseGameLaunchConfigCreate,
  type GameLaunchConfigCreate,
} from '../holdings/launch-configs'

export type GraphFileCreate<T extends FileWorkType> = Omit<FileCreateFields<T>, 'associations'> & {
  readonly associations?: readonly {
    readonly part: GraphPartRef<FilePartType<T>>
    readonly isPreferred?: boolean
  }[]
}

export interface GraphLocalContent {
  readonly game?: readonly {
    readonly work: GraphEntryRef<'game'>
    readonly directories?: readonly DirectoryCreateFields<'game'>[]
    readonly launchConfigs?: readonly GameLaunchConfigCreate[]
  }[]

  readonly anime?: readonly {
    readonly work: GraphEntryRef<'anime'>
    readonly directories?: readonly DirectoryCreateFields<'anime'>[]
    readonly files?: readonly GraphFileCreate<'anime'>[]
  }[]

  readonly comic?: readonly {
    readonly work: GraphEntryRef<'comic'>
    readonly directories?: readonly DirectoryCreateFields<'comic'>[]
    readonly files?: readonly GraphFileCreate<'comic'>[]
  }[]

  readonly novel?: readonly {
    readonly work: GraphEntryRef<'novel'>
    readonly directories?: readonly DirectoryCreateFields<'novel'>[]
    readonly files?: readonly GraphFileCreate<'novel'>[]
  }[]
}

export function parseGraphLocalContent(
  input: unknown,
  { entryReference, partReference, requirePartOwner }: GraphReferences,
): GraphLocalContent | undefined {
  if (input === undefined) {
    return
  }

  function parseGraphFile<T extends FileWorkType>(type: T, input: unknown): GraphFileCreate<T> {
    const source = parseRecord(input)
    const { associations, ...fields } = source
    const value = parseFileCreateFields(type, fields)
    const part = partReference(filePartTypes[type])
    const members = Object.hasOwn(source, 'associations')
      ? {
          associations: parseValue(
            v.pipe(
              v.array(v.strictObject({ part, isPreferred: v.exactOptional(v.boolean()) })),
              v.check((items) => unique(items, (item) => partKey(item.part))),
            ),
            associations,
          ),
        }
      : {}
    return { ...value, ...members } as GraphFileCreate<T>
  }

  function mediaLocal<T extends FileWorkType>(type: T) {
    return v.array(
      v.strictObject({
        work: entryReference([type]),
        directories: v.exactOptional(
          v.array(fromParser((value) => parseDirectoryCreateFields(type, value))),
        ),
        files: v.exactOptional(v.array(fromParser((value) => parseGraphFile(type, value)))),
      }),
    )
  }
  const localContent = parseValue(
    v.strictObject({
      game: v.exactOptional(
        v.array(
          v.strictObject({
            work: entryReference(['game'] as const),
            directories: v.exactOptional(
              v.array(fromParser((value) => parseDirectoryCreateFields('game', value))),
            ),
            launchConfigs: v.exactOptional(v.array(fromParser(parseGameLaunchConfigCreate))),
          }),
        ),
      ),
      anime: v.exactOptional(mediaLocal('anime')),
      comic: v.exactOptional(mediaLocal('comic')),
      novel: v.exactOptional(mediaLocal('novel')),
    }),
    input,
    'Invalid initial local content',
  )

  const localPaths = new Set<string>()
  for (const type of workTypes) {
    const groups = localContent[type] ?? []
    for (const group of groups) {
      for (const directory of group.directories ?? []) {
        const key = JSON.stringify([entryKey(group.work), 'directory', directory.path])
        if (localPaths.has(key)) {
          throw new DesktopError('InvalidInput', 'Initial directory paths must not be duplicated')
        }
        localPaths.add(key)
      }
      if (type === 'game' || !('files' in group)) {
        continue
      }

      for (const file of group.files ?? []) {
        const key = JSON.stringify([entryKey(group.work), 'file', file.path])
        if (localPaths.has(key)) {
          throw new DesktopError('InvalidInput', 'Initial file paths must not be duplicated')
        }
        localPaths.add(key)

        for (const association of file.associations ?? []) {
          requirePartOwner(association.part, group.work)
        }
      }
    }
  }

  return localContent
}
