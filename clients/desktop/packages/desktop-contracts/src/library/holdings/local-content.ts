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

/** Register one known work's real input; a file input never implicitly registers its parent directory. */
export interface LocalContentInput {
  readonly type: 'directory' | 'file'
  readonly path: string
}

export interface LocalContentRegistrationOptions {
  readonly expectedIdentities?: NonEmptyArray<ExternalIdentity>
}

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

/** Results report actual per-file outcomes; unavailable files and invalid matching do not erase already held data. */
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

/** Validate one current file or directory input for an already known work, without inspecting the filesystem. */
export function parseLocalContentInput(input: unknown): LocalContentInput {
  return parseValue(
    v.strictObject({ type: v.picklist(['directory', 'file']), path }),
    input,
    'Invalid local content input',
  )
}

/** Validate a complete, nonempty identity precondition without resolving or rebinding its actual work. */
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

/** Preserve actual registered/reused identities and post-commit issues without pretending the content is already usable. */
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
