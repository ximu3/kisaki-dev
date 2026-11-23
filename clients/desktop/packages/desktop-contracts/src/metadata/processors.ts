import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ExecutionContext, CallOptions, Registration, KeyedResult } from '../operations'
import { fromParser, parseValue, id, unique, parseRecord } from '../validation'
import * as v from 'valibot'
import { entryTypes, partTypes, type EntryType, type PartType } from '../library/catalog'
import {
  parseIdentificationFields,
  parsePartIdentificationFields,
  parseMetadataFieldRef,
  parseMetadataFieldValue,
  type IdentificationFields,
  type PartIdentificationFields,
  type MetadataFieldRef,
  type MetadataFieldValue,
} from './fields'
import { DesktopError } from '../errors'

/**
 * Supplies original evidence for field processing while local IDs and resource credentials stay
 * with their owners.
 */
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

/**
 * Processors replace only the field value. Identity, endpoints and matching evidence retain their
 * original owners.
 */
export type FieldProcessingItem = ProcessingItem<MetadataFieldRef>

export interface FieldProcessingInput {
  readonly items: readonly FieldProcessingItem[]
}

/**
 * Normal completion covers every input key. A failed call can return the successfully processed
 * keys.
 */
export type FieldProcessingResult<I extends FieldProcessingInput = FieldProcessingInput> =
  KeyedResult<
    I['items'],
    { readonly [Item in I['items'][number] as Item['key']]: MetadataFieldValue<Item['field']> }
  >

export interface MetadataFieldProcessor {
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly fields: readonly MetadataFieldRef[]

  /** Uses the original input keys. Failure can carry only valid completed values. */
  process(input: FieldProcessingInput, context: ExecutionContext): Promise<FieldProcessingResult>
}

export interface MetadataFieldProcessorDescriptor {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly fields: readonly MetadataFieldRef[]
}

/** Profiles explicitly select processor identities and order for each allowed field. */
export interface MetadataFieldProcessorsApi {
  list(call?: CallOptions): Promise<readonly MetadataFieldProcessorDescriptor[]>

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

function parseProcessingEntryContext(input: unknown): ProcessingEntryContext {
  const { type } = parseValue(v.looseObject({ type: v.picklist(entryTypes) }), input)
  return parseValue(
    v.strictObject({
      type: v.literal(type),
      identification: fromParser((value) => parseIdentificationFields(type, value)),
    }),
    input,
  ) as ProcessingEntryContext
}

function parseProcessingPartContext(input: unknown): ProcessingPartContext {
  const { type } = parseValue(v.looseObject({ type: v.picklist(partTypes) }), input)
  return parseValue(
    v.strictObject({
      type: v.literal(type),
      identification: fromParser((value) => parsePartIdentificationFields(type, value)),
    }),
    input,
  ) as ProcessingPartContext
}

const contextSchema = v.strictObject({
  entry: v.exactOptional(fromParser(parseProcessingEntryContext)),
  part: v.exactOptional(fromParser(parseProcessingPartContext)),
  relatedEntries: v.exactOptional(v.array(fromParser(parseProcessingEntryContext))),
})

/** Requires unique keys and field-specific values. Legal empty values are ordinary data. */
export function parseFieldProcessingInput(input: unknown): FieldProcessingInput {
  const item = v.pipe(
    v.strictObject({
      key: id,
      field: fromParser(parseMetadataFieldRef),
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
 * Completion requires every key from the fixed call. Partial results can omit keys. Both reject
 * extra keys and use the requested types.
 */
export function parseFieldProcessingResult<
  const I extends FieldProcessingInput,
  C extends 'complete' | 'partial' = 'complete',
>(
  input: I,
  result: unknown,
  completeness?: C,
): C extends 'complete' ? FieldProcessingResult<I> : Partial<FieldProcessingResult<I>>

export function parseFieldProcessingResult(
  input: FieldProcessingInput,
  result: unknown,
  completeness: 'complete' | 'partial' = 'complete',
): Partial<FieldProcessingResult> {
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

/** An empty list declares no field-processing capability. */
export function parseProcessorFields(input: unknown): readonly MetadataFieldRef[] {
  return parseValue(
    v.pipe(
      v.array(fromParser(parseMetadataFieldRef)),
      v.check((fields) => unique(fields, (field) => JSON.stringify(field))),
    ),
    input,
    'Invalid processor field capabilities',
  )
}
