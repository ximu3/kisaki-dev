import { membershipChangeSchema } from '../membership'
import type { FileWorkType, PartRef } from '../catalog'

import * as v from 'valibot'
import { fromParser, id, unique, parseValue } from '../../validation'

export type FileAssociationMode = 'automatic' | 'manual'

export type FilePartType<T extends FileWorkType> = {
  readonly anime: 'animeEpisode' | 'animeExtra'
  readonly comic: 'comicVolume' | 'comicChapter'
  readonly novel: 'novelVolume'
}[T]

export interface FileAssociation<T extends FileWorkType = FileWorkType> {
  readonly part: PartRef<FilePartType<T>>
  readonly isPreferred: boolean
}

export interface FileAssociationInput<T extends FileWorkType = FileWorkType> {
  readonly part: PartRef<FilePartType<T>>
  readonly isPreferred?: boolean
}

export type FileAssociationChange<T extends FileWorkType = FileWorkType> =
  | { readonly type: 'replace'; readonly items: readonly FileAssociationInput<T>[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly FileAssociationInput<T>[]
      readonly remove?: readonly PartRef<FilePartType<T>>[]
    }

export interface FileAssociationEdit<T extends FileWorkType = FileWorkType> {
  readonly change: FileAssociationChange<T>
  readonly expected?: {
    readonly associations: readonly FileAssociation<T>[]
    readonly associationMode: FileAssociationMode
  }
}

export const mode = v.picklist(['automatic', 'manual'])

export const filePartTypes: { readonly [K in FileWorkType]: readonly FilePartType<K>[] } = {
  anime: ['animeEpisode', 'animeExtra'],
  comic: ['comicVolume', 'comicChapter'],
  novel: ['novelVolume'],
}

export function partSchema<T extends FileWorkType>(
  type: T,
): v.GenericSchema<unknown, PartRef<FilePartType<T>>> {
  const types: readonly FilePartType<T>[] = filePartTypes[type]
  return v.strictObject({ type: v.picklist(types), id })
}

export function partKey(part: PartRef): string {
  return JSON.stringify([part.type, part.id])
}

export function associationSchema<T extends FileWorkType>(type: T) {
  return v.strictObject({ part: partSchema(type), isPreferred: v.exactOptional(v.boolean()) })
}

export function parseFileAssociationChange<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileAssociationChange<T> {
  const part = partSchema(workType)
  return parseValue(
    membershipChangeSchema(associationSchema(workType), part, (item) => item.part, partKey),
    input,
    'Invalid file associations',
  ) as FileAssociationChange<T>
}

export function parseFileAssociationEdit<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileAssociationEdit<T> {
  const member = v.strictObject({ part: partSchema(workType), isPreferred: v.boolean() })
  return parseValue(
    v.strictObject({
      change: fromParser((value) => parseFileAssociationChange(workType, value)),
      expected: v.exactOptional(
        v.strictObject({
          associations: v.pipe(
            v.array(member),
            v.check((items) => unique(items, (item) => partKey(item.part))),
          ),
          associationMode: mode,
        }),
      ),
    }),
    input,
    'Invalid association adoption',
  ) as FileAssociationEdit<T>
}

export function parseFileAssociationModeChange(input: unknown): {
  readonly mode: FileAssociationMode
  readonly expected?: { readonly associationMode: FileAssociationMode }
} {
  return parseValue(
    v.strictObject({ mode, expected: v.exactOptional(v.strictObject({ associationMode: mode })) }),
    input,
    'Invalid file association mode change',
  )
}
