/** @fileoverview Defines local-content registration inputs and actual refresh outcomes. */

import type { NonEmptyArray } from '../../operations'
import type { ExternalIdentity, WorkRef, EntryRef, FileWorkType } from '../catalog'
import type { ErrorSummary } from '../../errors'
import type { FileRecognitionResult } from './file-recognition'

import type { FileAvailability } from './files'
import { parseValue, unique, id } from '../../validation'
import * as v from 'valibot'
import { path } from './directories'
import { identitySchema, identityKey, workRefSchema } from '../catalog'
import { parseErrorSummary, DesktopError } from '../../errors'

/**
 * One real file or directory input for a known work.
 *
 * File registration does not implicitly register the parent directory.
 */
export interface LocalContentInput {
  readonly type: 'directory' | 'file'
  readonly path: string
}

/** Optional exact external identities to recheck against the fixed work before registration. */
export interface LocalContentRegistrationOptions {
  readonly expectedIdentities?: NonEmptyArray<ExternalIdentity>
}

/** Actual new or reused holdings identities and any initial-refresh or incomplete-launch issues. */
export interface LocalContentRegistrationResult {
  readonly work: WorkRef
  readonly registrations: NonEmptyArray<{
    readonly type: 'directory' | 'file' | 'launchConfig'
    readonly id: string
    readonly outcome: 'registered' | 'alreadyRegistered'
  }>
  readonly issues: readonly (
    | { readonly code: 'initialRefreshFailed'; readonly error: ErrorSummary }
    | { readonly code: 'launchConfigIncomplete'; readonly launchConfigId: string }
  )[]
}

/**
 * Discovery progress and actual per-file maintenance and recognition outcomes.
 *
 * Unavailable files and failed matching retain existing holdings data.
 */
export interface HoldingsRefreshResult<T extends FileWorkType = FileWorkType> {
  readonly work: EntryRef<T>

  readonly discovery: {
    readonly finished: boolean
    readonly registeredFileIds: readonly string[]
    readonly issues: readonly { readonly path: string; readonly error: ErrorSummary }[]
  }

  readonly files: readonly {
    readonly fileId: string
    readonly availability: FileAvailability
    readonly recognition: FileRecognitionResult<T> | null
    readonly associationOutcome: 'updated' | 'unchanged' | 'notAttempted' | 'waitingForUse'
  }[]
}

/** Parses one file or directory input without inspecting the filesystem. */
export function parseLocalContentInput(input: unknown): LocalContentInput {
  return parseValue(
    v.strictObject({ type: v.picklist(['directory', 'file']), path }),
    input,
    'Invalid local content input',
  )
}

/** Parses an optional nonempty, distinct external-identity precondition. */
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

/** Parses registered or reused identities and issues, checking applicability to the work kind. */
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
            error: v.pipe(v.unknown(), v.transform(parseErrorSummary)),
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

  return value
}
