/** @fileoverview Defines selected work recognizers and their independently owned clue evidence. */

import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { CallOptions, Disposable, ParticipationContext, Registration } from '../execution'
import type { WorkType } from '../library/identity'
import type { WorkClues } from '../metadata/identification'

/** One already established candidate boundary; recognizers cannot change its work type, location, or scope. */
export interface RecognitionInput {
  readonly entryType: WorkType
  readonly path: string
  readonly kind: 'directory' | 'file'
  readonly clues: Readonly<WorkClues>
}
export interface WorkRecognizerDescription {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly workTypes: readonly [WorkType, ...WorkType[]]
}
export interface WorkRecognizer extends WorkRecognizerDescription {
  /** Return at least one new justified clue or null; unavailable I/O, cancellation, and instance loss remain failures. */
  recognize(input: RecognitionInput, context: ParticipationContext): Promise<WorkClues | null>
}
export interface WorkRecognizersApi {
  /** List actual registered implementations, without implicitly selecting any of them. */
  list(call?: CallOptions): Promise<readonly WorkRecognizerDescription[]>
  /** Read one actual implementation description or null. */
  get(id: string, call?: CallOptions): Promise<WorkRecognizerDescription | null>
  /** Register an explicitly identified implementation; withdrawal affects new selection while bound work retains its lifetime. */
  register(recognizer: WorkRecognizer, call?: CallOptions): Promise<Registration<string>>
  /** Notify consumers to reread the contribution catalog. */
  onInvalidated(listener: () => void): Disposable
}
