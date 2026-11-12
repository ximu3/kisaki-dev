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
import { parseValue, id, unique, parseRecord } from '../validation'
import * as v from 'valibot'
import { entryTypes, partTypes } from '../library/catalog'
import {
  parseIdentificationFields,
  parsePartIdentificationFields,
  parseMetadataFieldRef,
  parseMetadataFieldValue,
} from './fields'
import { DesktopError } from '../errors'

/**
 * Original entry identification shared as field-processing context.
 *
 * The context excludes local database IDs and unrelated resource credentials.
 */
export type ProcessingEntryContext = {
  [K in EntryType]: { readonly type: K; readonly identification: IdentificationFields<K> }
}[EntryType]

/** Original part identification shared as field-processing context. */
export type ProcessingPartContext = {
  [K in PartType]: { readonly type: K; readonly identification: PartIdentificationFields<K> }
}[PartType]

/** Relevant entry, part and related-entry evidence accompanying a field value. */
export interface FieldProcessingContext {
  readonly entry?: ProcessingEntryContext
  readonly part?: ProcessingPartContext
  readonly relatedEntries?: readonly ProcessingEntryContext[]
}

/**
 * Keyed processing item preserving the relationship between a selected field and its value type.
 */
type ProcessingItem<F extends MetadataFieldRef> = F extends MetadataFieldRef
  ? {
      readonly key: string
      readonly field: F
      readonly value: MetadataFieldValue<F>
      readonly context?: FieldProcessingContext
    }
  : never

/**
 * Concrete field value and optional original context supplied to a processor.
 *
 * Processor output changes the field value; identities, endpoints and matching evidence retain
 * their owners.
 */
export type FieldProcessingItem = ProcessingItem<MetadataFieldRef>

/** Fixed batch of keyed field values for one processor call. */
export interface FieldProcessingInput {
  readonly items: readonly FieldProcessingItem[]
}

/**
 * Processed values keyed by their original input identities.
 *
 * Normal completion covers every input key. A failure may carry only the successfully processed
 * keys.
 */
export type FieldProcessingResult = Readonly<Record<string, MetadataFieldValue<MetadataFieldRef>>>

/** Registered batch implementation for a declared set of metadata fields. */
export interface MetadataFieldProcessor {
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly fields: readonly MetadataFieldRef[]

  /**
   * Processes the supplied field values and returns results for every input key.
   *
   * Failure may retain valid completed keys as a partial result.
   */
  process(input: FieldProcessingInput, context: ExecutionContext): Promise<FieldProcessingResult>
}

/** Discoverable processor identity, localized description and supported fields. */
export interface MetadataFieldProcessorDescriptor {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly fields: readonly MetadataFieldRef[]
}

/**
 * Discovery and lifetime registration of metadata field processors.
 *
 * Profiles explicitly select processor IDs and order for each allowed field.
 */
export interface MetadataFieldProcessorsApi {
  /** Reads registered processor descriptions and supported fields. */
  list(call?: CallOptions): Promise<readonly MetadataFieldProcessorDescriptor[]>

  /** Reads the current processor descriptor, returning null when its identity is unavailable. */
  get(processorId: string, call?: CallOptions): Promise<MetadataFieldProcessorDescriptor | null>

  /**
   * Registers a field processor for the actual owner and instance and returns its lifetime handle.
   */
  register(
    processorId: string,
    processor: MetadataFieldProcessor,
    call?: CallOptions,
  ): Promise<Registration<string>>
}

/** Parses an entry kind and the original identification fields allowed for it. */
function parseProcessingEntryContext(input: unknown): ProcessingEntryContext {
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

/** Parses a part kind and the original identification fields allowed for it. */
function parseProcessingPartContext(input: unknown): ProcessingPartContext {
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
  entry: v.exactOptional(v.pipe(v.unknown(), v.transform(parseProcessingEntryContext))),
  part: v.exactOptional(v.pipe(v.unknown(), v.transform(parseProcessingPartContext))),
  relatedEntries: v.exactOptional(
    v.array(v.pipe(v.unknown(), v.transform(parseProcessingEntryContext))),
  ),
})

/**
 * Parses a fixed batch with unique keys, field-specific values and optional original context.
 *
 * Legal empty field values remain ordinary input data.
 */
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
 * Parses returned values against the fixed call's keys and field types.
 *
 * Complete results must cover every input key; partial results may omit keys. Both reject extra
 * keys and preserve only returned values.
 */
export function parseFieldProcessingResult(
  input: FieldProcessingInput,
  result: unknown,
  completeness: 'complete' | 'partial' = 'complete',
): FieldProcessingResult {
  const source = parseRecord(result)
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

/**
 * Parses a processor's distinct supported fields.
 *
 * An empty list declares no field-processing capability.
 */
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
