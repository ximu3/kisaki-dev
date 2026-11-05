/** @fileoverview Defines explicit game launch, monitoring and save choices without interpreting commands or discovering processes. */

import type { StoredDefinition, CallOptions } from '../../operations'
import type { ReorderInput, MoveInput } from '../ordering'
import * as v from 'valibot'
import { parseAbsolutePath } from '../../paths'
import {
  nonemptyText,
  positiveInteger,
  parseValue,
  text,
  optionalFields,
  validateExpectedKeys,
} from '../../validation'

/** Null targets allow an explicitly saved incomplete configuration; only command launch owns a working directory. */
export type GameLaunchTarget =
  | { readonly type: 'file'; readonly path: string | null }
  | { readonly type: 'url'; readonly url: string | null }
  | {
      readonly type: 'command'
      readonly command: string | null
      readonly workingDirectory: string | null
    }

/** The monitor is independently selected and never inferred from the launcher, command or working directory. */
export type GameMonitor =
  | { readonly type: 'directory' | 'file'; readonly path: string | null }
  | { readonly type: 'process'; readonly name: string | null }

export interface GameLaunchDefinition {
  readonly launch: GameLaunchTarget
  readonly monitor: GameMonitor
  readonly timing: 'foreground' | 'running'

  readonly savePath: string | null
  readonly autoBackupEnabled: boolean
  readonly backupRetentionCount: number | null
}

/** The configuration keeps identity and user preference independently of whether launch is currently possible. */
export interface GameLaunchConfig {
  readonly id: string
  readonly gameId: string
  readonly name: string
  readonly note: string | null

  readonly definition: StoredDefinition<GameLaunchDefinition>
  readonly isPreferred: boolean
  readonly sortOrder: number

  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

export interface GameLaunchConfigFields {
  readonly name: string
  readonly note: string | null
  readonly definition: GameLaunchDefinition
}

export interface GameLaunchConfigCreate {
  readonly name: string
  readonly note?: string | null
  readonly definition: GameLaunchDefinition
  readonly isPreferred?: boolean
}

export interface GameLaunchConfigUpdate {
  readonly changes: Partial<GameLaunchConfigFields>
  readonly expected?: Partial<GameLaunchConfigFields>
}

/** Editing influences future sessions only. Removal retains historical snapshots and never deletes installation/save bytes. */
export interface GameLaunchConfigsApi {
  /**
   * Read this game's saved launch configurations in their formal order; unavailable definitions
   * remain visible.
   */
  list(gameId: string, call?: CallOptions): Promise<readonly GameLaunchConfig[]>

  /**
   * Read one saved configuration without resolving its launch target or changing an existing
   * session snapshot.
   */
  get(gameId: string, id: string, call?: CallOptions): Promise<GameLaunchConfig | null>

  /**
   * Create a complete launch configuration for this game, including only the explicitly
   * requested preferred selection.
   */
  create(gameId: string, input: GameLaunchConfigCreate, call?: CallOptions): Promise<string>

  /**
   * Compare and commit changed configuration fields for future launches; active sessions retain
   * their established snapshot.
   */
  update(
    gameId: string,
    id: string,
    input: GameLaunchConfigUpdate,
    call?: CallOptions,
  ): Promise<void>

  /**
   * Remove the configuration and maintain its formal references, preserving history and
   * installation/save bytes.
   */
  delete(gameId: string, id: string, call?: CallOptions): Promise<void>

  /** Reorder selected configurations against the complete game-side order baseline. */
  reorder(gameId: string, input: ReorderInput, call?: CallOptions): Promise<void>

  /** Move configurations in the game's current order without changing the preferred selection. */
  move(gameId: string, input: MoveInput, call?: CallOptions): Promise<void>

  /**
   * Set or clear this game's explicit preferred configuration after its optional comparison; do
   * not launch or switch a session.
   */
  setPreferred(
    gameId: string,
    launchConfigId: string | null,
    input?: { readonly expected?: { readonly preferredLaunchConfigId: string | null } },
    call?: CallOptions,
  ): Promise<void>
}

const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))

const launch = v.variant('type', [
  v.strictObject({ type: v.literal('file'), path: v.nullable(path) }),
  v.strictObject({
    type: v.literal('url'),
    url: v.nullable(
      v.pipe(
        nonemptyText,
        v.check((value) => {
          try {
            return new URL(value).protocol.length > 1
          } catch {
            return false
          }
        }),
      ),
    ),
  }),
  v.strictObject({
    type: v.literal('command'),
    command: v.nullable(nonemptyText),
    workingDirectory: v.nullable(path),
  }),
])

const monitor = v.union([
  v.strictObject({ type: v.picklist(['directory', 'file']), path: v.nullable(path) }),
  v.strictObject({
    type: v.literal('process'),
    name: v.nullable(
      v.pipe(
        nonemptyText,
        v.check((value) => !/[\\/\0]/.test(value)),
      ),
    ),
  }),
])

export const gameDefinitionSchema = v.strictObject({
  launch,
  monitor,
  timing: v.picklist(['foreground', 'running']),

  savePath: v.nullable(path),
  autoBackupEnabled: v.boolean(),
  backupRetentionCount: v.nullable(positiveInteger),
})

/** Validate even an intentionally incomplete saved configuration; commands remain exact text and are never split. */
export function parseGameLaunchDefinition(input: unknown): GameLaunchDefinition {
  return parseValue(gameDefinitionSchema, input, 'Invalid game launch definition')
}

/** Validate a creation without choosing a launch file from a registered directory. */
export function parseGameLaunchConfigCreate(input: unknown): GameLaunchConfigCreate {
  return parseValue(
    v.strictObject({
      name: nonemptyText,
      note: v.exactOptional(v.nullable(text)),
      definition: gameDefinitionSchema,
      isPreferred: v.exactOptional(v.boolean()),
    }),
    input,
    'Invalid game launch configuration',
  )
}

/** Only name, note and the whole definition are editable; isPreferred uses its explicit unique-scope operation. */
export function parseGameLaunchConfigUpdate(input: unknown): GameLaunchConfigUpdate {
  const fields = v.strictObject(
    optionalFields({
      name: nonemptyText,
      note: v.nullable(text),
      definition: gameDefinitionSchema,
    }),
  )
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
    'Invalid game launch configuration edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}
