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

const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))

/** The candidate's boundary and type are already determined; every recognizer receives the same original clues. */
export interface RecognitionInput {
  readonly entryType: WorkType
  readonly path: string
  readonly kind: 'directory' | 'file'
  readonly clues: WorkClues
}

export interface WorkRecognizer {
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly workTypes: NonEmptyArray<WorkType>

  /** Return actual new clues or null; never a candidate list, empty object or a copy of the input. */
  recognize(input: RecognitionInput, context: ExecutionContext): Promise<WorkClues | null>
}

export interface WorkRecognizerDescriptor {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly workTypes: NonEmptyArray<WorkType>
}

export interface WorkRecognizersApi {
  /**
   * Read currently registered recognizer descriptions and supported work types without invoking
   * recognition.
   */
  list(call?: CallOptions): Promise<readonly WorkRecognizerDescriptor[]>

  /** Read one available recognizer descriptor by its complete identity. */
  get(id: string, call?: CallOptions): Promise<WorkRecognizerDescriptor | null>

  /**
   * Register recognition for the actual owner and instance; the configuration explicitly selects
   * participating recognizers.
   */
  register(
    recognizerId: string,
    implementation: WorkRecognizer,
    call?: CallOptions,
  ): Promise<Registration<string>>
}

export const clues = v.pipe(
  v.unknown(),
  v.transform((value) => parseIdentificationClues('game', value)),
)

/** Every participant receives the same original work/type/boundary; it cannot alter them in its result. */
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

/** Parse recognizer result values; execution verifies that non-null results add usable clues. */
export function parseRecognitionResult(input: RecognitionInput, result: unknown): WorkClues | null {
  if (result === null) {
    return null
  }

  const value = parseIdentificationClues(input.entryType, result)

  return value
}
