/** @fileoverview Defines field-limited processor batches and validates complete or explicitly partial results. */

import * as v from 'valibot'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import { invalidInput } from '../errors'
import type { CallOptions, Disposable, ParticipationContext, Registration } from '../execution'
import type { EntryType, PartType } from '../library/identity'
import { recordSchema } from '../schema'
import { nonemptyStringSchema, parseContract } from '../validation'
import {
  metadataEntryFields,
  metadataPartFields,
  type MetadataEntryValuesByType,
  type MetadataField,
  type MetadataPartValuesByType,
} from './fields'
import type { PartIdentificationFields } from './identification'
import type { SourceEntry } from './providers'
import {
  metadataRelationFields,
  type MetadataRelation,
  type MetadataRelationAttributes,
  type MetadataRelationMembers,
} from './relations'

/** Values are selected from the fixed metadata catalog; runtime validation applies the particular field's rule. */
export type FieldProcessorValue =
  | {
      [Type in EntryType]: MetadataEntryValuesByType[Type][keyof MetadataEntryValuesByType[Type]]
    }[EntryType]
  | {
      [Type in PartType]: MetadataPartValuesByType[Type][keyof MetadataPartValuesByType[Type]]
    }[PartType]
type EntryProcessorItem = {
  [Type in EntryType]: {
    [Field in keyof MetadataEntryValuesByType[Type]]: {
      readonly field: { readonly object: 'entry'; readonly entryType: Type; readonly field: Field }
      readonly value: MetadataEntryValuesByType[Type][Field]
    }
  }[keyof MetadataEntryValuesByType[Type]]
}[EntryType]
type PartProcessorItem = {
  [Type in PartType]: {
    [Field in keyof MetadataPartValuesByType[Type]]: {
      readonly field: { readonly object: 'part'; readonly partType: Type; readonly field: Field }
      readonly value: MetadataPartValuesByType[Type][Field]
    }
  }[keyof MetadataPartValuesByType[Type]]
}[PartType]
type RelationProcessorItem = {
  [Key in MetadataRelation]: {
    [Field in Extract<MetadataRelationAttributes[Key], keyof MetadataRelationMembers[Key]>]: {
      readonly field: { readonly object: 'relation'; readonly relation: Key; readonly field: Field }
      readonly value: Required<MetadataRelationMembers[Key]>[Field]
    }
  }[Extract<MetadataRelationAttributes[Key], keyof MetadataRelationMembers[Key]>]
}[MetadataRelation]
/** Context retains raw source identification and cannot be returned as a replacement graph. */
export interface FieldProcessorContext {
  readonly entry?: SourceEntry
  readonly part?: {
    [Type in PartType]: {
      readonly type: Type
      readonly identification: PartIdentificationFields<Type>
    }
  }[PartType]
}
export type FieldProcessorItem = {
  readonly key: string
  readonly context?: FieldProcessorContext
} & (
  | EntryProcessorItem
  | PartProcessorItem
  | RelationProcessorItem
  | {
      readonly field: { readonly object: 'tag'; readonly field: 'description' }
      readonly value: string | null
    }
  | {
      readonly field: { readonly object: 'tag'; readonly field: 'isNsfw' }
      readonly value: boolean
    }
)
export interface FieldProcessorInput {
  readonly items: readonly FieldProcessorItem[]
}
export interface FieldProcessorDescription {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly fields: readonly MetadataField[]
}
export interface FieldProcessor extends FieldProcessorDescription {
  /** Return every requested key, including unchanged values. Failure partialResult contains only completed items. */
  process(
    input: FieldProcessorInput,
    context: ParticipationContext,
  ): Promise<Readonly<Record<string, FieldProcessorValue>>>
}
export interface FieldProcessorsApi {
  /** Read currently available processors and their finite supported fields. */
  list(call?: CallOptions): Promise<readonly FieldProcessorDescription[]>
  /** Read a registered implementation's description, or null. */
  get(id: string, call?: CallOptions): Promise<FieldProcessorDescription | null>
  /** Publish one implementation; an active invocation retains its bound instance after withdrawal. */
  register(processor: FieldProcessor, call?: CallOptions): Promise<Registration<string>>
  /** Observe changes to the available catalog. */
  onInvalidated(listener: () => void): Disposable
}

function fieldSchema(field: MetadataField): v.GenericSchema<unknown, FieldProcessorValue> {
  let fields: Readonly<Record<string, v.GenericSchema<unknown, FieldProcessorValue | undefined>>>
  switch (field.object) {
    case 'entry':
      fields = metadataEntryFields[field.entryType]
      break
    case 'part':
      fields = metadataPartFields[field.partType]
      break
    case 'relation':
      fields = metadataRelationFields[field.relation]
      break
    case 'tag':
      fields = { description: v.nullable(v.string()), isNsfw: v.boolean() }
      break
  }
  const schema = fields[field.field]
  if (!schema) {
    return invalidInput('Unknown processor field.')
  }
  return v.nonOptional(schema)
}

/** Validate the particular requested fields and all result keys; partial mode is only for a real execution failure. */
export function parseFieldProcessorResult(
  input: FieldProcessorInput,
  result: unknown,
  options: { readonly partial?: boolean } = {},
): Readonly<Record<string, FieldProcessorValue>> {
  const values = parseContract(
    recordSchema(nonemptyStringSchema, v.unknown()),
    result,
    'field processor result',
  )
  const expected = new Map(input.items.map((item) => [item.key, item]))
  if (expected.size !== input.items.length) {
    return invalidInput('Processor input repeats a key.')
  }
  if (!options.partial && Object.keys(values).length !== expected.size) {
    return invalidInput('A successful processor result must cover every input key.')
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      const item = expected.get(key)
      if (!item) {
        return invalidInput('Processor result contains an unrequested key.')
      }
      return [key, parseContract(fieldSchema(item.field), value, 'processed field')]
    }),
  )
}
