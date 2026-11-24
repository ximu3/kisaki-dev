import type { NonEmptyArray } from '../../operations'
import type { FileRecognitionResult } from './file-recognition'

import type { FileAvailability } from './files'
import { fromParser, parseValue, unique, id } from '../../validation'
import * as v from 'valibot'
import { path } from './directories'
import {
  identitySchema,
  identityKey,
  workRefSchema,
  type ExternalIdentity,
  type WorkRef,
  type WorkType,
  type EntryRef,
  type FileWorkType,
} from '../catalog'
import { parseErrorSummary, DesktopError, type ErrorSummary } from '../../errors'

export interface LocalContentInput {
  readonly type: 'directory' | 'file'
  readonly path: string
}

export interface LocalContentRegistrationOptions {
  readonly expectedIdentities?: NonEmptyArray<ExternalIdentity>
}

export type LocalContentRegistrationResult<T extends WorkType = WorkType> = {
  [K in T]: {
    readonly work: WorkRef<K>
    readonly registrations: NonEmptyArray<{
      readonly type: 'directory' | (K extends 'game' ? 'launchConfig' : 'file')
      readonly id: string
      readonly outcome: 'registered' | 'alreadyRegistered'
    }>
    readonly issues: readonly (
      | { readonly code: 'initialRefreshFailed'; readonly error: ErrorSummary }
      | (K extends 'game'
          ? { readonly code: 'launchConfigIncomplete'; readonly launchConfigId: string }
          : never)
    )[]
  }
}[T]

export type HoldingsRefreshResult<T extends FileWorkType = FileWorkType> = {
  [K in T]: {
    readonly work: EntryRef<K>

    readonly discovery: {
      readonly finished: boolean
      readonly registeredFileIds: readonly string[]
      readonly issues: readonly { readonly path: string; readonly error: ErrorSummary }[]
    }

    readonly files: readonly {
      readonly fileId: string
      readonly availability: FileAvailability
      readonly recognition: FileRecognitionResult<K> | null
      readonly associationOutcome: 'updated' | 'unchanged' | 'notAttempted' | 'waitingForUse'
    }[]
  }
}[T]

export function parseLocalContentInput(input: unknown): LocalContentInput {
  return parseValue(
    v.strictObject({ type: v.picklist(['directory', 'file']), path }),
    input,
    'Invalid local content input',
  )
}

export function parseLocalContentRegistrationOptions(
  input: unknown,
): LocalContentRegistrationOptions {
  return parseValue(
    v.strictObject({
      expectedIdentities: v.exactOptional(
        v.pipe(
          v.tupleWithRest([identitySchema], identitySchema),
          v.check((items) => unique(items, identityKey)),
        ),
      ),
    }),
    input,
    'Invalid local content identity precondition',
  )
}

export function parseLocalContentRegistrationResult(
  input: unknown,
): LocalContentRegistrationResult {
  const registration = v.strictObject({
    type: v.picklist(['directory', 'file', 'launchConfig']),
    id,
    outcome: v.picklist(['registered', 'alreadyRegistered']),
  })
  const value = parseValue(
    v.strictObject({
      work: workRefSchema,
      registrations: v.tupleWithRest([registration], registration),
      issues: v.array(
        v.variant('code', [
          v.strictObject({
            code: v.literal('initialRefreshFailed'),
            error: fromParser(parseErrorSummary),
          }),
          v.strictObject({ code: v.literal('launchConfigIncomplete'), launchConfigId: id }),
        ]),
      ),
    }),
    input,
    'Invalid local content registration result',
  )
  if (
    value.registrations.some((item) =>
      value.work.type === 'game' ? item.type === 'file' : item.type === 'launchConfig',
    ) ||
    (value.work.type !== 'game' &&
      value.issues.some((issue) => issue.code === 'launchConfigIncomplete'))
  ) {
    throw new DesktopError('InvalidInput', 'Local registration result does not match its work type')
  }

  return value as LocalContentRegistrationResult
}
