import { opendir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
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
import type { NativeFiles } from '#native'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import { normalizeAbsolutePath } from '../../../infrastructure/files'
import { addConfig } from '../holdings/game/configurations'
import { addDirectory } from '../holdings/directories/storage'
import { addFile, type FileFacts } from '../holdings/files/storage'
import { existingPosition, expectPositions, type Position } from '../holdings/positions'
import { inspectTarget } from '../holdings/registration'
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
      async function claim(path: string, kind: Position['kind']) {
        if (await existingPosition(occupied, work, { kind, path }, native, signal)) {
          throw new DesktopError(
            'PathConflict',
            'The graph requests a location that is already registered',
          )
        }
        occupied.push({ id: randomUUID(), kind, path })
      }
      for (const directory of item.directories ?? []) {
        signal.throwIfAborted()
        const path = normalizeAbsolutePath(directory.path)
        const opened = await opendir(path)
        await opened.close()
        await claim(path, 'directory')
        plan.directories.push({ ...directory, path })
      }
      if ('launchConfigs' in item) {
        plan.configs.push(...item.launchConfigs)
      }
      if ('files' in item && work.type !== 'game') {
        for (const file of item.files) {
          signal.throwIfAborted()
          const path = normalizeAbsolutePath(file.path),
            facts = await inspectTarget(work.type, path, resources, signal)
          await claim(path, facts.kind === 'directory' ? 'pages' : 'file')
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
