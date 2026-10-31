/** @fileoverview Defines saved game launch choices independently of directories and live process monitoring. */

import * as v from 'valibot'
import type { CallOptions } from '../execution'
import { absolutePathSchema } from '../paths'
import { objectSchema } from '../schema'
import {
  exactPartialEntries,
  hasRelatedExpected,
  nonemptyStringSchema,
  parseContract,
  safeIntegerSchema,
  type FieldSchemas,
} from '../validation'
import type { OrderChange } from './ordering'

/** Nullable targets permit an explicit unfinished configuration; sessions validate readiness before launching. */
export type GameLaunchTarget =
  | { readonly type: 'file'; readonly path: string | null }
  | { readonly type: 'link'; readonly url: string | null }
  | {
      readonly type: 'command'
      readonly command: string | null
      readonly workingDirectory: string | null
    }
/** Process names are exact executable filenames; directories and files are explicit absolute locations. */
export type GameMonitoringRule =
  | { readonly type: 'directory' | 'file'; readonly path: string | null }
  | { readonly type: 'process'; readonly name: string | null }
export interface GameLaunchConfigFields {
  readonly name: string
  readonly launch: GameLaunchTarget
  readonly monitoring: GameMonitoringRule
  readonly timingMode: 'foreground' | 'running'
  readonly savePath: string | null
  readonly autoBackupEnabled: boolean
  /** Positive count of unlocked backups for the current source; null retains all. */
  readonly backupRetentionCount: number | null
  readonly note: string | null
}
export interface GameLaunchConfig extends GameLaunchConfigFields {
  readonly id: string
  readonly gameId: string
  readonly isPreferred: boolean
  readonly sortOrder: number
  readonly createdAt: number
  readonly updatedAt: number
}
export interface GameLaunchConfigUpdate {
  readonly changes: Partial<GameLaunchConfigFields>
  readonly expected?: Partial<GameLaunchConfigFields>
}
export interface GameLaunchConfigsApi {
  /** Read the game's choices in their saved order; incomplete choices remain visible. */
  list(gameId: string, call?: CallOptions): Promise<readonly GameLaunchConfig[]>
  /** Read one choice, or null, verifying its game ownership. */
  get(gameId: string, id: string, call?: CallOptions): Promise<GameLaunchConfig | null>
  /** Save an explicitly chosen launch configuration; a content directory never implicitly creates one. */
  create(gameId: string, input: GameLaunchConfigFields, call?: CallOptions): Promise<string>
  /** Compare only changed fields and save once; existing sessions keep their fixed configuration. */
  update(
    gameId: string,
    id: string,
    input: GameLaunchConfigUpdate,
    call?: CallOptions,
  ): Promise<void>
  /** Remove an unused choice while retaining historical activities and backups; user files are untouched. */
  delete(gameId: string, id: string, call?: CallOptions): Promise<void>
  /** Change this game's one optional default without opening or changing a live session. */
  setPreferred(
    gameId: string,
    input: {
      readonly launchConfigId: string | null
      readonly expected?: { readonly preferredLaunchConfigId: string | null }
    },
    call?: CallOptions,
  ): Promise<void>
  /** Reorder only this game's actual choices against the complete original order. */
  reorder(gameId: string, input: OrderChange, call?: CallOptions): Promise<void>
}

const launchSchema = v.union([
  objectSchema({ type: v.literal('file'), path: v.nullable(absolutePathSchema) }),
  objectSchema({
    type: v.literal('link'),
    url: v.nullable(
      v.pipe(
        nonemptyStringSchema,
        v.check((value) => {
          try {
            new URL(value)
            return true
          } catch {
            return false
          }
        }),
      ),
    ),
  }),
  objectSchema({
    type: v.literal('command'),
    command: v.nullable(nonemptyStringSchema),
    workingDirectory: v.nullable(absolutePathSchema),
  }),
])
const monitoringSchema = v.union([
  objectSchema({ type: v.picklist(['directory', 'file']), path: v.nullable(absolutePathSchema) }),
  objectSchema({
    type: v.literal('process'),
    name: v.nullable(
      v.pipe(
        nonemptyStringSchema,
        v.check((value) => !/[\\/\0]/.test(value)),
      ),
    ),
  }),
])
const fields = {
  name: nonemptyStringSchema,
  launch: launchSchema,
  monitoring: monitoringSchema,
  timingMode: v.picklist(['foreground', 'running']),
  savePath: v.nullable(absolutePathSchema),
  autoBackupEnabled: v.boolean(),
  backupRetentionCount: v.nullable(v.pipe(safeIntegerSchema, v.minValue(1))),
  note: v.nullable(v.string()),
} satisfies FieldSchemas<GameLaunchConfigFields>
const patch = objectSchema(exactPartialEntries(fields))

/** Validate saved configuration values without claiming the launch target is currently usable. */
export function parseGameLaunchConfigFields(input: unknown): GameLaunchConfigFields {
  return parseContract(objectSchema(fields), input, 'game launch configuration')
}
/** Validate editable fields and related baselines; technical observations cannot enter a user patch. */
export function parseGameLaunchConfigUpdate(input: unknown): GameLaunchConfigUpdate {
  return parseContract(
    v.pipe(
      objectSchema({ changes: patch, expected: v.exactOptional(patch) }),
      v.check((value) => hasRelatedExpected(value.changes, value.expected)),
    ),
    input,
    'game launch configuration update',
  )
}
/** Start an explicit draft with the documented defaults, retaining unspecified launch and monitoring targets. */
export function createGameLaunchConfigDraft(
  name: string,
  launch: GameLaunchTarget,
): GameLaunchConfigFields {
  return parseGameLaunchConfigFields({
    name,
    launch,
    monitoring: { type: 'directory', path: null },
    timingMode: 'foreground',
    savePath: null,
    autoBackupEnabled: false,
    backupRetentionCount: 5,
    note: null,
  })
}
