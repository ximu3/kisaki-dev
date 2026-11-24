import * as v from 'valibot'
import { parseAbsolutePath } from '../paths'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { NonEmptyArray, ExecutionContext, CallOptions, Registration } from '../operations'
import { parseIdentificationClues, type WorkClues } from '../metadata/fields'
import { fromParser, parseValue } from '../validation'
import { workTypes, type WorkType } from '../library/catalog'

const path = fromParser(parseAbsolutePath)

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

  recognize(input: RecognitionInput, context: ExecutionContext): Promise<WorkClues | null>
}

export interface WorkRecognizerDescriptor {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly workTypes: NonEmptyArray<WorkType>
}

export interface WorkRecognizersApi {
  list(call?: CallOptions): Promise<readonly WorkRecognizerDescriptor[]>

  get(id: string, call?: CallOptions): Promise<WorkRecognizerDescriptor | null>

  register(
    recognizerId: string,
    implementation: WorkRecognizer,
    call?: CallOptions,
  ): Promise<Registration<string>>
}

export const clues = fromParser((value) => parseIdentificationClues('game', value))

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

export function parseRecognitionResult(input: RecognitionInput, result: unknown): WorkClues | null {
  if (result === null) {
    return null
  }

  const value = parseIdentificationClues(input.entryType, result)

  return value
}
