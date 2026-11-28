import { access, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, extname } from 'node:path'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  WorkRef,
  FileWorkType,
  DirectoryCreateFields,
  ExternalIdentity,
  FileCreateFields,
  LocalContentRegistrationResult,
} from '@kisaki3/desktop-contracts/library'
import type { NativeFiles } from '#native'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import { normalizeAbsolutePath } from '../../../infrastructure/files'
import { registeredRelation as comparePaths } from '../../../infrastructure/files/registered-path'
import type { ChangeAdmission } from '../../../infrastructure/use-targets'
import { inspectVideo } from '../../../infrastructure/media/inspect'
import { inspectBook } from './files/inspect-book'
import { existingPosition } from './positions'
import type { CompleteWrite } from '../transaction'
import type { holdingStorage } from './storage'
import type { configStorage } from './game/configurations'
import type { FileFacts, FileWork } from './files/storage'

export async function inspectTarget(
  type: FileWorkType,
  path: string,
  resources: string,
  signal: AbortSignal,
): Promise<FileFacts> {
  signal.throwIfAborted()
  if (type === 'anime') {
    return { kind: 'file', video: (await inspectVideo(resources, path, signal)).metadata }
  }
  const before = await stat(path, { bigint: true })
  const result = await inspectBook(path, signal)
  const after = await stat(path, { bigint: true })
  if (
    before.ino !== after.ino ||
    before.dev !== after.dev ||
    before.size !== after.size ||
    before.mtimeNs !== after.mtimeNs
  ) {
    throw new DesktopError('TargetChanged', 'The reading content changed during inspection')
  }
  return { kind: result.kind, book: result.metadata }
}
export function registration(
  call: DatabaseCall<ReturnType<typeof holdingStorage> & ReturnType<typeof configStorage>>,
  complete: CompleteWrite,
  native: NativeFiles,
  resources: string,
  admit: ChangeAdmission,
  positionsChanged: () => void,
) {
  async function directory(
    work: WorkRef,
    input: DirectoryCreateFields,
    signal: AbortSignal,
    identities?: readonly ExternalIdentity[],
  ) {
    const path = normalizeAbsolutePath(input.path)
    const info = await stat(path).catch((cause: unknown) => {
      throw new DesktopError('FileUnavailable', 'The selected directory could not be opened', {
        cause,
      })
    })
    if (!info.isDirectory()) {
      throw new DesktopError('InvalidInput', 'Choose a directory')
    }
    const baseline = await call('libraryPositions', work)
    const found = await existingPosition(
      baseline,
      work,
      { kind: 'directory', path },
      native,
      signal,
    )
    signal.throwIfAborted()
    const result = complete(
      await call('registerDirectory', work, { ...input, path }, baseline, found, identities),
    )
    if (result.created) {
      positionsChanged()
    }
    return result
  }
  async function file(
    work: FileWork,
    input: FileCreateFields,
    signal: AbortSignal,
    identities?: readonly ExternalIdentity[],
    discovery?: { id: string; path: string; definition: unknown },
  ) {
    const path = normalizeAbsolutePath(input.path)
    const baseline = await call('libraryPositions', work)
    const facts = await inspectTarget(work.type, path, resources, signal)
    const found = await existingPosition(
      baseline,
      work,
      { kind: facts.kind === 'directory' ? 'pages' : 'file', path },
      native,
      signal,
    )
    signal.throwIfAborted()
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
  async function game(
    work: WorkRef<'game'>,
    raw: string,
    signal: AbortSignal,
    identities?: readonly ExternalIdentity[],
  ): Promise<LocalContentRegistrationResult<'game'>> {
    const path = normalizeAbsolutePath(raw)
    const info = await stat(path)
    if (!info.isFile()) {
      throw new DesktopError('InvalidInput', 'Choose a file launch target')
    }
    if (process.platform === 'win32') {
      if (!['.exe', '.com', '.bat', '.cmd', '.lnk'].includes(extname(path).toLowerCase())) {
        throw new DesktopError('InvalidInput', 'Choose an executable or a system launcher')
      }
    } else {
      await access(path, constants.X_OK)
    }
    const configs = await call('listGameConfigs', work.id, true),
      same: string[] = []
    for (const item of configs) {
      if (item.definition.status !== 'ready') {
        continue
      }
      const launch = item.definition.value.launch
      if (launch.type !== 'file' || !launch.path) {
        continue
      }
      const position = await comparePaths(launch.path, path, native)
      if (position === 'unknown') {
        throw new DesktopError('PathUnresolved', 'The registered launch path cannot be compared')
      }
      if (position === 'same') {
        same.push(item.id)
      }
    }
    signal.throwIfAborted()
    return complete(
      await call('registerGameTarget', work, path, basename(path), configs, same, identities),
    )
  }
  const pending = new Map<string, Promise<void>>()
  function serialize<T extends { id: string }, Args extends unknown[], R>(
    action: (work: T, ...args: Args) => Promise<R>,
  ) {
    return async (work: T, ...args: Args) => {
      const result = (pending.get(work.id) ?? Promise.resolve()).then(() => action(work, ...args))
      const drained = result.then(
        () => {},
        () => {},
      )
      pending.set(work.id, drained)
      try {
        return await result
      } finally {
        if (pending.get(work.id) === drained) {
          pending.delete(work.id)
        }
      }
    }
  }
  return { directory: serialize(directory), file: serialize(file), game: serialize(game) }
}
