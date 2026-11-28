import type { NativeFiles } from '#native'
import type { ExternalIdentity, FileCreateFields } from '@kisaki3/desktop-contracts/library'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import { normalizeAbsolutePath } from '../../../../infrastructure/files'
import type { ChangeAdmission } from '../../change-admission'
import type { CompleteWrite } from '../../transaction'
import type { Position } from '../paths'
import { existingPosition } from '../paths'
import type { holdingStorage } from '../storage'
import { inspectTarget } from './inspect'
import type { FileWork } from './record'
import type { fileCommands } from './storage'

export function createFileRegistration(
  call: DatabaseCall<
    ReturnType<typeof fileCommands> & Pick<ReturnType<typeof holdingStorage>, 'libraryPositions'>
  >,
  complete: CompleteWrite,
  native: NativeFiles,
  resources: string,
  admit: ChangeAdmission,
  positionsChanged: () => void,
) {
  return async function (
    work: FileWork,
    input: FileCreateFields,
    signal: AbortSignal,
    identities?: readonly ExternalIdentity[],
    discovery?: { id: string; path: string; definition: unknown },
  ) {
    const baseline = await call('libraryPositions', work)
    const { path, facts, found } = await prepareFileRegistration(
      work,
      input.path,
      baseline,
      native,
      resources,
      signal,
    )
    const save = () =>
      call('registerFile', work, { ...input, path }, facts, baseline, found, identities, discovery)
    const result = complete(
      found && input.associations
        ? await admit([{ type: 'file', kind: work.type, id: found }], save)
        : await save(),
    )
    if (result.created) {
      positionsChanged()
    }
    return result
  }
}

export async function prepareFileRegistration(
  work: FileWork,
  raw: string,
  baseline: readonly Position[],
  native: NativeFiles,
  resources: string,
  signal: AbortSignal,
) {
  const path = normalizeAbsolutePath(raw)
  const facts = await inspectTarget(work.type, path, resources, signal)
  const found = await existingPosition(
    baseline,
    work,
    { kind: facts.kind === 'directory' ? 'pages' : 'file', path },
    native,
    signal,
  )
  signal.throwIfAborted()
  return { path, facts, found }
}
