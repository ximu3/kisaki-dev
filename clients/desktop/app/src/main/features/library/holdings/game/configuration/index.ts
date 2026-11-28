import {
  parseGameLaunchConfigCreate,
  parseGameLaunchConfigUpdate,
  parseMoveInput,
  parseReorderInput,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { DatabaseCall } from '../../../../../infrastructure/database/executor'
import type { CompleteWrite } from '../../../transaction'
import type { ChangeAdmission } from '../../../change-admission'
import type { launchConfigStorage } from './storage'

export function createLaunchConfigs(
  call: DatabaseCall<ReturnType<typeof launchConfigStorage>>,
  complete: CompleteWrite,
  sensitive: () => boolean,
  admit: ChangeAdmission,
) {
  return {
    list: (gameId: string) => call('listGameConfigs', gameId, sensitive()),
    get: (gameId: string, id: string) => call('getGameConfig', gameId, id, sensitive()),
    async create(gameId: string, raw: unknown, context?: CallOptions) {
      const input = parseGameLaunchConfigCreate(raw)
      context?.signal?.throwIfAborted()
      return complete(await call('addGameConfig', gameId, input))
    },
    async update(gameId: string, id: string, raw: unknown, context?: CallOptions) {
      const input = parseGameLaunchConfigUpdate(raw)
      context?.signal?.throwIfAborted()
      complete(await call('editGameConfig', gameId, id, input))
    },
    async delete(gameId: string, id: string, context?: CallOptions) {
      context?.signal?.throwIfAborted()
      complete(
        await admit([{ type: 'configuration', kind: 'game', id }], () =>
          call('deleteGameConfig', gameId, id),
        ),
      )
    },
    async setPreferred(
      gameId: string,
      id: string | null,
      input?: { expected?: { preferredLaunchConfigId: string | null } },
      context?: CallOptions,
    ) {
      context?.signal?.throwIfAborted()
      complete(await call('preferGameConfig', gameId, id, input?.expected?.preferredLaunchConfigId))
    },
    async reorder(gameId: string, raw: unknown, context?: CallOptions) {
      context?.signal?.throwIfAborted()
      complete(await call('orderGameConfigs', gameId, parseReorderInput(raw)))
    },
    async move(gameId: string, raw: unknown, context?: CallOptions) {
      context?.signal?.throwIfAborted()
      complete(await call('orderGameConfigs', gameId, parseMoveInput(raw)))
    },
  }
}
