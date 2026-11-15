/** @fileoverview Defines work recognition participants and their input and result values. */

import * as v from 'valibot'
import { parseAbsolutePath } from '../paths'
import type { WorkType } from '../library/catalog'
import type { WorkClues } from '../metadata/fields'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { NonEmptyArray, ExecutionContext, CallOptions, Registration } from '../operations'
import { parseIdentificationClues } from '../metadata/fields'
import { parseValue } from '../validation'
import { workTypes } from '../library/catalog'

/** Validated absolute candidate location supplied to a work recognizer. */
const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))

/**
 * Fixed candidate path, kind, work medium and original clues supplied to a recognizer.
 *
 * Every selected recognizer receives the same original input.
 */
export interface RecognitionInput {
  readonly entryType: WorkType
  readonly path: string
  readonly kind: 'directory' | 'file'
  readonly clues: WorkClues
}

/** Registered source of additional work-identification clues for declared media. */
export interface WorkRecognizer {
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly workTypes: NonEmptyArray<WorkType>

  /**
   * Returns new usable clues or null when no clues can be added.
   *
   * A result cannot be an empty object, candidate list or unchanged copy of the input clues.
   */
  recognize(input: RecognitionInput, context: ExecutionContext): Promise<WorkClues | null>
}

/** Discoverable recognizer identity, localized description and supported work media. */
export interface WorkRecognizerDescriptor {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly workTypes: NonEmptyArray<WorkType>
}

/** Discovery and lifetime registration of scanner recognition implementations. */
export interface WorkRecognizersApi {
  /** Reads registered recognizer descriptions and supported work media. */
  list(call?: CallOptions): Promise<readonly WorkRecognizerDescriptor[]>

  /** Reads a current recognizer descriptor, returning null when its identity is unavailable. */
  get(id: string, call?: CallOptions): Promise<WorkRecognizerDescriptor | null>

  /**
   * Registers an implementation for its actual owner and instance and returns its lifetime handle.
   *
   * Scan configurations explicitly select participating recognizers.
   */
  register(
    recognizerId: string,
    implementation: WorkRecognizer,
    call?: CallOptions,
  ): Promise<Registration<string>>
}

/** Original work-identification clues, validated independently from resolved metadata. */
export const clues = v.pipe(
  v.unknown(),
  v.transform((value) => parseIdentificationClues('game', value)),
)

/** Parses the candidate boundary, work medium and original clues supplied to recognition. */
export function parseRecognitionInput(input: unknown): RecognitionInput {
  return parseValue(
    v.strictObject({
      entryType: v.picklist(workTypes),
      path,
      kind: v.picklist(['directory', 'file']),
      clues,
    }),
    input,
    'Invalid work recognition input',
  )
}

/**
 * Parses additional work clues or a null result.
 *
 * Execution checks that a non-null result adds usable evidence.
 */
export function parseRecognitionResult(input: RecognitionInput, result: unknown): WorkClues | null {
  if (result === null) {
    return null
  }

  const value = parseIdentificationClues(input.entryType, result)

  return value
}
