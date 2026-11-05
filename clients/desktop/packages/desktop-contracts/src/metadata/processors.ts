/** @fileoverview Defines field-only batch processors and validates complete or explicitly partial per-key results. */

import type { EntryType, PartType } from '../library/catalog'
import type {
  IdentificationFields,
  PartIdentificationFields,
  MetadataFieldRef,
  MetadataFieldValue,
} from './fields'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ExecutionContext, CallOptions, Registration } from '../operations'
import { parseValue, id, unique, readRecord } from '../validation'
import * as v from 'valibot'
import { entryTypes, partTypes } from '../library/catalog'
import {
  parseIdentificationFields,
  parsePartIdentificationFields,
  parseMetadataFieldRef,
  parseMetadataFieldValue,
} from './fields'
import { DesktopError } from '../errors'

/** Only necessary original identification context is shared, without local database IDs or unrelated resource credentials. */
export type ProcessingEntryContext = {
  [K in EntryType]: { readonly type: K; readonly identification: IdentificationFields<K> }
}[EntryType]

export type ProcessingPartContext = {
  [K in PartType]: { readonly type: K; readonly identification: PartIdentificationFields<K> }
}[PartType]

export interface FieldProcessingContext {
  readonly entry?: ProcessingEntryContext
  readonly part?: ProcessingPartContext
  readonly relatedEntries?: readonly ProcessingEntryContext[]
}

type ProcessingItem<F extends MetadataFieldRef> = F extends MetadataFieldRef
  ? {
      readonly key: string
      readonly field: F
      readonly value: MetadataFieldValue<F>
      readonly context?: FieldProcessingContext
    }
  : never

/** The selected field and its value stay correlated; processor output cannot mutate identities, endpoints or matching evidence. */
export type FieldProcessingItem = ProcessingItem<MetadataFieldRef>

export interface FieldProcessingInput {
  readonly items: readonly FieldProcessingItem[]
}

/** Normal completion covers all input keys. A failure may carry only successfully processed keys of this same result type. */
export type FieldProcessingResult = Readonly<Record<string, MetadataFieldValue<MetadataFieldRef>>>

export interface MetadataFieldProcessor {
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly fields: readonly MetadataFieldRef[]

  /**
   * Process only the supplied field values; normal completion covers every input key, while
   * failure may retain valid completed keys.
   */
  process(input: FieldProcessingInput, context: ExecutionContext): Promise<FieldProcessingResult>
}

export interface MetadataFieldProcessorDescriptor {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly fields: readonly MetadataFieldRef[]
}

/** Registration only publishes an implementation; profiles explicitly select its ID and order for each allowed field. */
export interface MetadataFieldProcessorsApi {
  /**
   * Read registered processor descriptions and supported fields without executing any
   * processing.
   */
  list(call?: CallOptions): Promise<readonly MetadataFieldProcessorDescriptor[]>

  /** Read the current descriptor for one complete processor identity. */
  get(processorId: string, call?: CallOptions): Promise<MetadataFieldProcessorDescriptor | null>

  /**
   * Register field processing for the actual owner and instance; profiles still explicitly
   * choose its fields and execution order.
   */
  register(
    processorId: string,
    processor: MetadataFieldProcessor,
    call?: CallOptions,
  ): Promise<Registration<string>>
}

function entryContext(input: unknown): ProcessingEntryContext {
  const { type } = parseValue(v.looseObject({ type: v.picklist(entryTypes) }), input)
  return parseValue(
    v.strictObject({
      type: v.literal(type),
      identification: v.pipe(
        v.unknown(),
        v.transform((value) => parseIdentificationFields(type, value)),
      ),
    }),
    input,
  ) as ProcessingEntryContext
}

function partContext(input: unknown): ProcessingPartContext {
  const { type } = parseValue(v.looseObject({ type: v.picklist(partTypes) }), input)
  return parseValue(
    v.strictObject({
      type: v.literal(type),
      identification: v.pipe(
        v.unknown(),
        v.transform((value) => parsePartIdentificationFields(type, value)),
      ),
    }),
    input,
  ) as ProcessingPartContext
}

const contextSchema = v.strictObject({
  entry: v.exactOptional(v.pipe(v.unknown(), v.transform(entryContext))),
  part: v.exactOptional(v.pipe(v.unknown(), v.transform(partContext))),
  relatedEntries: v.exactOptional(v.array(v.pipe(v.unknown(), v.transform(entryContext)))),
})

/** Parse a fixed batch with unique keys and field-specific values, retaining useful empty values as ordinary data. */
export function parseFieldProcessingInput(input: unknown): FieldProcessingInput {
  const item = v.pipe(
    v.strictObject({
      key: id,
      field: v.pipe(v.unknown(), v.transform(parseMetadataFieldRef)),
      value: v.unknown(),
      context: v.exactOptional(contextSchema),
    }),
    v.transform(
      (value) =>
        ({
          ...value,
          value: parseMetadataFieldValue(value.field, value.value),
        }) as FieldProcessingItem,
    ),
  )
  return parseValue(
    v.strictObject({
      items: v.pipe(
        v.array(item),
        v.check((items) => unique(items, (item) => item.key)),
      ),
    }),
    input,
    'Invalid field processing input',
  )
}

/**
 * Check returned keys and values against the fixed call. Missing complete results and extra keys fail;
 * partial failures preserve only genuinely returned successful items and never fill from original inputs.
 */
export function parseFieldProcessingResult(
  input: FieldProcessingInput,
  result: unknown,
  completeness: 'complete' | 'partial' = 'complete',
): FieldProcessingResult {
  const source = readRecord(result)
  const byKey = new Map(input.items.map((item) => [item.key, item]))
  if (
    Object.keys(source).some((key) => !byKey.has(key)) ||
    (completeness === 'complete' && Object.keys(source).length !== byKey.size)
  ) {
    throw new DesktopError('InvalidInput', 'Processor result does not cover its exact input keys')
  }

  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      parseMetadataFieldValue(byKey.get(key)!.field, value),
    ]),
  )
}

/** Validate the exact supported fields before publishing a processor; empty lists grant no field-processing capability. */
export function parseProcessorFields(input: unknown): readonly MetadataFieldRef[] {
  return parseValue(
    v.pipe(
      v.array(v.pipe(v.unknown(), v.transform(parseMetadataFieldRef))),
      v.check((fields) => unique(fields, (field) => JSON.stringify(field))),
    ),
    input,
    'Invalid processor field capabilities',
  )
}
