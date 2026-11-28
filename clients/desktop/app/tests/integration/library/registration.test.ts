import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from 'vite-plus/test'
import { createGameRegistration } from '../../../src/main/features/library/holdings/game/configuration/register'
import { windowErrors } from '../../../src/shared/window-api/protocol'
import { loadNative } from '#native'
import { storageOptions } from '../database/sample'

test('an unavailable game launch target keeps its file error at the window boundary', async () => {
  const absent = join(tmpdir(), 'kisaki-missing-' + randomUUID(), 'game.exe')
  const native = loadNative(storageOptions(tmpdir()).collationExtension).files
  const register = createGameRegistration(
    async () => {
      throw new Error('Unexpected database operation')
    },
    (commit) => commit.value,
    native,
  )
  const outcome = register({ type: 'game', id: 'sample' }, absent, new AbortController().signal)
  await expect(
    outcome.catch((error: unknown) => windowErrors.encode(error, 'library.holdings.register')),
  ).resolves.toMatchObject({ code: 'FileUnavailable' })
})
