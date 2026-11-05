/** @fileoverview Validates initial files, directories and launch configurations against graph references. */

import type { FileWorkType, EntryType, PartType } from '../catalog'
import type { FileCreateFields } from '../holdings/files'
import type { GraphPartRef, GraphEntryRef } from './nodes'
import type { FilePartType } from '../holdings/associations'
import type { DirectoryCreateFields } from '../holdings/directories'
import type { GameLaunchConfigCreate } from '../holdings/game-configuration'

import * as v from 'valibot'
import { readRecord, parseValue, unique } from '../../validation'
import { parseFileCreateFields } from '../holdings/files'
import { filePartTypes } from '../holdings/associations'
import { partKey } from './nodes'
import { parseDirectoryCreateFields } from '../holdings/directories'
import { parseGameLaunchConfigCreate } from '../holdings/game-configuration'

/** Initial local input has already been resolved; graph commit does not scan, fetch metadata or open content. */
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

/** Parse initial local-content values against the complete create index supplied by the graph owner. */
export function parseGraphLocalContent(
  input: unknown,
  entryReference: <T extends EntryType>(
    types: readonly T[],
  ) => v.GenericSchema<unknown, GraphEntryRef<T>>,
  partReference: <T extends PartType>(
    types: readonly T[],
  ) => v.GenericSchema<unknown, GraphPartRef<T>>,
): GraphLocalContent | undefined {
  function parseGraphFile<T extends FileWorkType>(type: T, input: unknown): GraphFileCreate<T> {
    const source = readRecord(input)
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
          v.array(
            v.pipe(
              v.unknown(),
              v.transform((value) => parseDirectoryCreateFields(type, value)),
            ),
          ),
        ),
        files: v.exactOptional(
          v.array(
            v.pipe(
              v.unknown(),
              v.transform((value) => parseGraphFile(type, value)),
            ),
          ),
        ),
      }),
    )
  }
  return input === undefined
    ? undefined
    : parseValue(
        v.strictObject({
          game: v.exactOptional(
            v.array(
              v.strictObject({
                work: entryReference(['game'] as const),
                directories: v.exactOptional(
                  v.array(
                    v.pipe(
                      v.unknown(),
                      v.transform((value) => parseDirectoryCreateFields('game', value)),
                    ),
                  ),
                ),
                launchConfigs: v.exactOptional(
                  v.array(v.pipe(v.unknown(), v.transform(parseGameLaunchConfigCreate))),
                ),
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
}
