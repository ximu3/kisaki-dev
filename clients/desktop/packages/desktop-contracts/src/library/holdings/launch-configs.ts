import type { StoredValue, CallOptions } from '../../operations'
import type { ReorderInput, MoveInput } from '../ordering'
import * as v from 'valibot'
import { parseAbsolutePath } from '../../paths'
import {
  fromParser,
  nonemptyText,
  positiveInteger,
  parseValue,
  text,
  optionalFields,
  validateExpectedKeys,
} from '../../validation'

export type GameLaunchTarget =
  | { readonly type: 'file'; readonly path: string | null }
  | { readonly type: 'url'; readonly url: string | null }
  | {
      readonly type: 'command'
      readonly command: string | null
      readonly workingDirectory: string | null
    }

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

export interface GameLaunchConfig {
  readonly id: string
  readonly gameId: string
  readonly name: string
  readonly note: string | null

  readonly definition: StoredValue<GameLaunchDefinition>
  readonly isPreferred: boolean
  readonly sortOrder: number

  readonly createdAt: number
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

export interface GameLaunchConfigsApi {
  list(gameId: string, call?: CallOptions): Promise<readonly GameLaunchConfig[]>

  get(gameId: string, id: string, call?: CallOptions): Promise<GameLaunchConfig | null>

  create(gameId: string, input: GameLaunchConfigCreate, call?: CallOptions): Promise<string>

  update(
    gameId: string,
    id: string,
    input: GameLaunchConfigUpdate,
    call?: CallOptions,
  ): Promise<void>

  delete(gameId: string, id: string, call?: CallOptions): Promise<void>

  reorder(gameId: string, input: ReorderInput, call?: CallOptions): Promise<void>

  move(gameId: string, input: MoveInput, call?: CallOptions): Promise<void>

  setPreferred(
    gameId: string,
    launchConfigId: string | null,
    input?: { readonly expected?: { readonly preferredLaunchConfigId: string | null } },
    call?: CallOptions,
  ): Promise<void>
}

const path = fromParser(parseAbsolutePath)

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

export function parseGameLaunchDefinition(input: unknown): GameLaunchDefinition {
  return parseValue(gameDefinitionSchema, input, 'Invalid game launch definition')
}

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
