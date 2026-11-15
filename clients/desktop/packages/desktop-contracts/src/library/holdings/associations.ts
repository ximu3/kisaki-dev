/** @fileoverview Defines file-part association values and mutually consistent membership changes. */

import type { FileWorkType, PartRef } from '../catalog'

import * as v from 'valibot'
import { id, unique, parseValue } from '../../validation'

/** Persistent permission for later automatic association, independent of current association contents. */
export type FileAssociationMode = 'automatic' | 'manual'

/** Part kinds that can be directly associated with a file of the selected medium. */
export type FilePartType<T extends FileWorkType> = {
  readonly anime: 'animeEpisode' | 'animeExtra'
  readonly comic: 'comicVolume' | 'comicChapter'
  readonly novel: 'novelVolume'
}[T]

/** A direct file-to-part association and its preferred-file flag. */
export interface FileAssociation<T extends FileWorkType = FileWorkType> {
  readonly part: PartRef<FilePartType<T>>
  readonly isPreferred: boolean
}

/** A direct part association supplied with an optional preferred-file choice. */
export interface FileAssociationInput<T extends FileWorkType = FileWorkType> {
  readonly part: PartRef<FilePartType<T>>
  readonly isPreferred?: boolean
}

/**
 * Complete direct-association replacement or disjoint incremental changes.
 *
 * A comic-volume association does not imply direct associations to its chapters.
 */
export type FileAssociationChange<T extends FileWorkType = FileWorkType> =
  | { readonly type: 'replace'; readonly items: readonly FileAssociationInput<T>[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly FileAssociationInput<T>[]
      readonly remove?: readonly PartRef<FilePartType<T>>[]
    }

/** Association changes with an optional baseline of the complete direct set and matching mode. */
export interface FileAssociationEdit<T extends FileWorkType = FileWorkType> {
  readonly change: FileAssociationChange<T>
  readonly expected?: {
    readonly associations: readonly FileAssociation<T>[]
    readonly associationMode: FileAssociationMode
  }
}

/** Saved automatic or manual intent for a registered file's part associations. */
export const mode = v.picklist(['automatic', 'manual'])

/** Real part kinds that each file-bearing work medium may associate directly. */
export const filePartTypes: { readonly [K in FileWorkType]: readonly FilePartType<K>[] } = {
  anime: ['animeEpisode', 'animeExtra'],
  comic: ['comicVolume', 'comicChapter'],
  novel: ['novelVolume'],
}

/** Builds a part-reference schema restricted to the file medium's applicable part kinds. */
export function partSchema<T extends FileWorkType>(
  type: T,
): v.GenericSchema<unknown, PartRef<FilePartType<T>>> {
  const types: readonly FilePartType<T>[] = filePartTypes[type]
  return v.strictObject({ type: v.picklist(types), id })
}

/** Encodes a part's kind and identity as an unambiguous association key. */
export function partKey(part: PartRef): string {
  return JSON.stringify([part.type, part.id])
}

/** Builds a medium-specific association input schema with an optional preferred flag. */
export function associationSchema<T extends FileWorkType>(type: T) {
  return v.strictObject({ part: partSchema(type), isPreferred: v.exactOptional(v.boolean()) })
}

/**
 * Parses complete replacement or disjoint incremental direct-association intent.
 *
 * A partial comic-volume or chapter view cannot stand in for the complete set.
 */
export function parseFileAssociationChange<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileAssociationChange<T> {
  const part = partSchema(workType)
  const members = v.pipe(
    v.array(associationSchema(workType)),
    v.check((items) => unique(items, (item) => partKey(item.part))),
  )
  return parseValue(
    v.union([
      v.strictObject({ type: v.literal('replace'), items: members }),
      v.pipe(
        v.strictObject({
          type: v.literal('modify'),
          add: v.exactOptional(members),
          remove: v.exactOptional(
            v.pipe(
              v.array(part),
              v.check((items) => unique(items, partKey)),
            ),
          ),
        }),
        v.check(
          (value) =>
            (value.add?.length ?? 0) + (value.remove?.length ?? 0) > 0 &&
            !(value.add ?? []).some((item) =>
              value.remove?.some((ref) => partKey(ref) === partKey(item.part)),
            ),
        ),
      ),
    ]),
    input,
    'Invalid file associations',
  ) as FileAssociationChange<T>
}

/** Parses association intent and an optional complete-set and matching-mode baseline. */
export function parseFileAssociationEdit<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileAssociationEdit<T> {
  const member = v.strictObject({ part: partSchema(workType), isPreferred: v.boolean() })
  return parseValue(
    v.strictObject({
      change: v.pipe(
        v.unknown(),
        v.transform((value) => parseFileAssociationChange(workType, value)),
      ),
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

/** Parses a matching-mode change and optional baseline without changing association membership. */
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
