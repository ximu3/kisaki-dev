import type { NativeFiles } from '#native'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseFileCreateFields,
  workTypes,
  type DirectoryCreateFields,
  type FileCreateFields,
  type GameLaunchConfigCreate,
  type GraphLocalContent,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { randomUUID } from 'node:crypto'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import { inspectDirectory } from '../holdings/directories/inspect'
import { findRegisteredDirectory } from '../holdings/directories/register'
import { addDirectory } from '../holdings/directories/write'
import type { FileFacts } from '../holdings/files/record'
import { prepareFileRegistration } from '../holdings/files/register'
import { addFile } from '../holdings/files/write'
import { addConfig } from '../holdings/game/launch-configs/storage'
import { expectPositions, type Position } from '../holdings/paths'
import type { holdingStorage } from '../holdings/storage'
import type { LibraryWrite } from '../transaction'
import type { GraphReferences } from './references'

interface WorkRegistration {
  work: WorkRef
  baseline: readonly Position[]
  directories: DirectoryCreateFields[]
  files: { fields: FileCreateFields; facts: FileFacts }[]
  configs: GameLaunchConfigCreate[]
}

export async function prepareRegistrations(
  input: GraphLocalContent | undefined,
  refs: GraphReferences,
  call: DatabaseCall<ReturnType<typeof holdingStorage>>,
  native: NativeFiles,
  resources: string,
  signal: AbortSignal,
) {
  const plans: WorkRegistration[] = []
  for (const type of workTypes) {
    for (const item of input?.[type] ?? []) {
      const work = refs.entry(item.work),
        baseline = 'key' in item.work ? [] : await call('libraryPositions', work)
      const occupied = [...baseline],
        plan: WorkRegistration = { work, baseline, directories: [], files: [], configs: [] }
      function claim(path: string, kind: Position['kind'], found: string | null) {
        if (found) {
          throw new DesktopError(
            'PathConflict',
            'The graph requests a location that is already registered',
          )
        }
        occupied.push({ id: randomUUID(), kind, path })
      }
      for (const directory of item.directories ?? []) {
        signal.throwIfAborted()
        const path = await inspectDirectory(directory.path)
        claim(
          path,
          'directory',
          await findRegisteredDirectory(work, path, occupied, native, signal),
        )
        plan.directories.push({ ...directory, path })
      }
      if ('launchConfigs' in item) {
        plan.configs.push(...item.launchConfigs)
      }
      if ('files' in item && work.type !== 'game') {
        for (const file of item.files) {
          signal.throwIfAborted()
          const { path, facts, found } = await prepareFileRegistration(
            { type: work.type, id: work.id },
            file.path,
            occupied,
            native,
            resources,
            signal,
          )
          claim(path, facts.kind === 'directory' ? 'pages' : 'file', found)
          const fields = parseFileCreateFields(work.type, {
            ...file,
            path,
            ...(file.associations && {
              associations: file.associations.map((a) => ({ ...a, part: refs.part(a.part) })),
            }),
          })
          plan.files.push({ fields, facts })
        }
      }
      plans.push(plan)
    }
  }
  return plans
}

export function registerGraphContent(write: LibraryWrite, plans: readonly WorkRegistration[]) {
  for (const plan of plans) {
    const { work } = plan
    expectPositions(write.db, work, plan.baseline)
    for (const fields of plan.directories) {
      addDirectory(write, work, fields)
    }
    if (work.type === 'game') {
      for (const config of plan.configs) {
        addConfig(write, work.id, config)
      }
    } else {
      for (const file of plan.files) {
        addFile(write, { type: work.type, id: work.id }, file.fields, file.facts)
      }
    }
  }
}
