/** @fileoverview Accepts recognizer responses only when they contribute usable clues to the original input. */
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseRecognitionResult } from '@kisaki3/desktop-contracts/scanner'
import type { RecognitionInput } from '@kisaki3/desktop-contracts/scanner'
import type { WorkClues } from '@kisaki3/desktop-contracts/metadata'
import { hasNewWorkClues } from '../metadata/identification'

export function acceptRecognitionResult(
  input: RecognitionInput,
  result: unknown,
): WorkClues | null {
  const value = parseRecognitionResult(input, result)
  if (value !== null && !hasNewWorkClues(input.clues, value)) {
    throw new DesktopError(
      'InvalidInput',
      'Recognizer result must provide new usable work clues or null',
    )
  }
  return value
}
