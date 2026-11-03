/** @fileoverview Describes complete add/update intent and actual per-item adoption outcomes. */

import type { ExecutionFailure } from '../errors'
import type { NonEmptyArray } from '../operations'
import type {
  CompletionFields,
  EntryRef,
  EntryType,
  Evaluation,
  ExternalIdentity,
  PartRef,
  PartType,
  PartWorkType,
  WorkRecord,
  WorkType,
} from '../library/catalog'
import type { DirectoryDiscoveryDefinition } from '../library/holdings-values'
import type { IdentificationClues, MetadataEntryField, MetadataPartField } from '../metadata/fields'
import type { MetadataCandidate } from '../metadata/values'
import type {
  MetadataRelationAttributeValues,
  MetadataRelationKey,
  MetadataRelationScopeValues,
  MetadataRelationScopes,
  PersonWorkScopeCondition,
} from '../metadata/relations'
import type { IngestIssue } from './issues'

/** Prepared candidates contain source facts and completeness evidence, never a local patch or writeGraph request. */
export type MetadataInput<T extends EntryType> =
  | { readonly type: 'profile'; readonly profileId: string; readonly clues: IdentificationClues<T> }
  | {
      readonly type: 'prepared'
      readonly data: MetadataCandidate<T>
      readonly relationScopes?: MetadataRelationScopes<T>
    }

export type MetadataUpdateInput<T extends EntryType> =
  | {
      readonly type: 'profile'
      readonly profileId: string
      readonly clues?: IdentificationClues<T>
    }
  | {
      readonly type: 'prepared'
      readonly data: MetadataCandidate<T>
      readonly relationScopes?: MetadataRelationScopes<T>
    }

/** A local candidate is one declared input. Only file-bearing directory inputs can explicitly select a recognition profile. */
export type IngestLocalContent<T extends WorkType> =
  | { readonly type: 'file'; readonly path: string }
  | ({ readonly type: 'directory'; readonly path: string } & (T extends 'game'
      ? object
      : {
          readonly definition?: DirectoryDiscoveryDefinition
          readonly recognitionProfileId?: string | null
        }))

export type IngestAddInput<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly entryType: K
    readonly metadata: MetadataInput<K>
    readonly initial?: { readonly evaluation?: Partial<Evaluation> } & (K extends WorkType
      ? {
          readonly record?: Partial<WorkRecord>
          readonly completionRecords?: readonly CompletionFields[]
        }
      : object)
  } & (K extends WorkType ? { readonly localContent?: IngestLocalContent<K> } : object)
}[T]

/** User scope is modification authority. Provider relationScopes separately determines where replacement is complete. */
export type PersonAdoptionScope =
  | 'all'
  | NonEmptyArray<
      | (PersonWorkScopeCondition & {
          readonly characters?: NonEmptyArray<EntryRef<'character'> | null>
        })
      | {
          readonly characters: NonEmptyArray<EntryRef<'character'> | null>
          readonly workTypes?: PersonWorkScopeCondition['workTypes']
          readonly roles?: PersonWorkScopeCondition['roles']
          readonly character?: 'none' | 'present'
        }
    >

export type IngestRelationScope<K extends keyof MetadataRelationScopeValues> =
  K extends 'personWorks' ? PersonAdoptionScope : MetadataRelationScopeValues[K]

export type FieldAdoption = 'fill' | 'overwrite'

/** update only touches already corresponding members. Ownership lists can only append real missing parts. */
export type IngestRelationUpdate<K extends keyof MetadataRelationAttributeValues> = K extends
  'workVolumes' | 'workChapters' | 'workEpisodes' | 'workExtras'
  ? {
      readonly mode: 'append'
    }
  : {
      readonly mode: 'update' | 'append' | 'replace'
      readonly fields?: { readonly [F in keyof MetadataRelationAttributeValues[K]]?: FieldAdoption }
      readonly scope?: K extends keyof MetadataRelationScopeValues ? IngestRelationScope<K> : never
    }

export type IngestEntryUpdate<T extends EntryType> = {
  readonly metadata: MetadataUpdateInput<T>
  readonly fields?: Readonly<Partial<Record<MetadataEntryField<T>, FieldAdoption>>>
  readonly relations?: { readonly [K in MetadataRelationKey<T>]?: IngestRelationUpdate<K> }
}

export type IngestPartUpdate<T extends PartType> = {
  readonly metadata: MetadataUpdateInput<PartWorkType<T>>
  readonly fields?: Readonly<Partial<Record<MetadataPartField<T>, FieldAdoption>>>
} & (T extends 'comicVolume'
  ? { readonly relations?: { readonly volumeChapters?: IngestRelationUpdate<'volumeChapters'> } }
  : object)

export type IngestUpdateType = EntryType | PartType

export type IngestUpdateRef<T extends IngestUpdateType> = T extends EntryType
  ? EntryRef<T>
  : T extends PartType
    ? PartRef<T>
    : never

export type IngestUpdateInput<T extends IngestUpdateType> = T extends EntryType
  ? IngestEntryUpdate<T>
  : T extends PartType
    ? IngestPartUpdate<T>
    : never

/** A batch fixes each real target before any fetch, and cannot adopt extra source objects as additional update targets. */
export type IngestUpdateItem = {
  [K in IngestUpdateType]: {
    readonly target: IngestUpdateRef<K>
    readonly input: IngestUpdateInput<K>
  }
}[IngestUpdateType]

export type AddResult<T extends EntryType = EntryType> =
  | {
      readonly outcome: 'added'
      readonly entry: EntryRef<T>
      readonly issues: readonly IngestIssue[]
    }
  | {
      readonly outcome: 'alreadyExists'
      readonly entry: EntryRef<T>
      readonly matchedIdentities: NonEmptyArray<ExternalIdentity>
      readonly issues: readonly IngestIssue[]
    }

export interface UpdateResult {
  readonly outcome: 'updated' | 'unchanged'
  readonly target: EntryRef | PartRef
  readonly issues: readonly IngestIssue[]
}

/** total stays the original input count; cancellation retains only actually completed item reports and their legal partial results. */
export interface IngestBatchResult<Result> {
  readonly total: number
  readonly items: readonly (
    | { readonly index: number; readonly result: Result }
    | { readonly index: number; readonly error: ExecutionFailure<Result> }
  )[]
}
