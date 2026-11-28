import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  GameLaunchDefinition,
  RelocatedPathTarget,
  DirectoryRelocationInput,
} from '@kisaki3/desktop-contracts/library'
import { gameLaunchConfigs } from '../../../../../infrastructure/database/schema'
import { ready } from '../../../../../infrastructure/database/codecs/json'
import type { DatabaseCall } from '../../../../../infrastructure/database/executor'
import type { LibraryWrite } from '../../../transaction'
import type { VerifyPath, ReportPathIssue } from '../../paths'
import type { launchConfigStorage } from './storage'

type ConfigField = Extract<RelocatedPathTarget, { type: 'launchConfig' }>['field']
function configPath(def: GameLaunchDefinition, key: ConfigField) {
  switch (key) {
    case 'launchPath':
      return def.launch.type === 'file' ? { path: def.launch.path, kind: 'file' as const } : null
    case 'workingDirectory':
      return def.launch.type === 'command'
        ? { path: def.launch.workingDirectory, kind: 'directory' as const }
        : null
    case 'monitorPath':
      return def.monitor.type !== 'process'
        ? { path: def.monitor.path, kind: def.monitor.type }
        : null
    case 'savePath':
      return { path: def.savePath, kind: 'either' as const }
  }
}

function setConfigPath(def: GameLaunchDefinition, change: ConfigMove): GameLaunchDefinition {
  const previous = configPath(def, change.field)
  if (previous?.path !== change.from) {
    throw new DesktopError('Conflict', 'A selected configuration path changed')
  }
  switch (change.field) {
    case 'launchPath':
      return { ...def, launch: { type: 'file', path: change.to } }
    case 'workingDirectory': {
      if (def.launch.type !== 'command') {
        throw new DesktopError('Conflict', 'The launch method changed')
      }
      return { ...def, launch: { ...def.launch, workingDirectory: change.to } }
    }
    case 'monitorPath': {
      if (def.monitor.type === 'process') {
        throw new DesktopError('Conflict', 'The monitor changed')
      }
      return { ...def, monitor: { ...def.monitor, path: change.to } }
    }
    case 'savePath':
      return { ...def, savePath: change.to }
  }
}

export interface ConfigMove {
  id: string
  field: ConfigField
  from: string
  to: string
}

export async function prepareConfigMoves(
  call: DatabaseCall<ReturnType<typeof launchConfigStorage>>,
  workId: string,
  selections: NonNullable<DirectoryRelocationInput<'game'>['gameConfigFields']>,
  verified: VerifyPath,
  issue: ReportPathIssue,
) {
  const moves: ConfigMove[] = []
  const requested = new Set<string>()
  for (const selection of selections) {
    const config = await call('getGameConfig', workId, selection.launchConfigId, true)
    if (config?.definition.status !== 'ready') {
      throw new DesktopError('InvalidReference', 'A selected launch configuration cannot be read')
    }
    for (const field of selection.fields) {
      const target = { type: 'launchConfig' as const, id: config.id, field }
      const key = JSON.stringify(target)
      if (requested.has(key)) {
        continue
      }
      requested.add(key)
      const original = configPath(config.definition.value, field)
      if (!original?.path) {
        throw new DesktopError(
          'InvalidInput',
          'The requested configuration field has no saved file path',
        )
      }
      try {
        const to = await verified(original.path, original.kind)
        if (to) {
          moves.push({ id: config.id, field, from: original.path, to })
        }
      } catch (cause) {
        issue(target, original.path, cause)
      }
    }
  }
  return moves
}

export function applyConfigMoves(
  write: LibraryWrite,
  workId: string,
  moves: readonly ConfigMove[],
) {
  const ids = new Set<string>()
  for (const change of moves) {
    const where = and(eq(gameLaunchConfigs.id, change.id), eq(gameLaunchConfigs.gameId, workId))
    const row = write.db
      .select({ definition: gameLaunchConfigs.definition })
      .from(gameLaunchConfigs)
      .where(where)
      .get()
    if (row?.definition.status !== 'ready') {
      throw new DesktopError('Conflict', 'A selected configuration is no longer available')
    }
    write.db
      .update(gameLaunchConfigs)
      .set({
        definition: ready(setConfigPath(row.definition.value, change)),
        updatedAt: write.now,
      })
      .where(where)
      .run()
    ids.add(change.id)
  }
  if (ids.size) {
    write.changes.push({
      type: 'holdingsChanged',
      work: { type: 'game', id: workId },
      launchConfigIds: [...ids],
    })
  }
}
