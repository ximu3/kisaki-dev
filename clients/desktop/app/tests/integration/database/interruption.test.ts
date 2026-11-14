/** @fileoverview Checks WAL recovery after the actual Electron Node writer dies with an open transaction. */

import { expect, test } from 'vite-plus/test'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import { entries } from '../../../src/main/infrastructure/database/schema'
import { storageOptions } from './sample'

test('retains committed data and rolls back interrupted work after reopening', async ({
  signal,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-interruption-'))
  const worker = fork(new URL('./interruption-worker.ts', import.meta.url), [directory], {
    execArgv: ['--import', 'vite-plus/register'],
    windowsHide: true,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  })
  const closed = once(worker, 'exit')
  try {
    expect(await once(worker, 'message', { signal })).toEqual(['transaction-open', undefined])
    worker.kill('SIGKILL')
    await closed
    const storage = initializeDatabase(storageOptions(directory))
    try {
      expect(storage.db.select().from(entries).get()?.name).toBe('Saved')
    } finally {
      storage.close()
    }
  } finally {
    if (worker.exitCode === null && worker.signalCode === null) {
      worker.kill('SIGKILL')
      await closed
    }
    await rm(directory, { recursive: true, force: true })
  }
})
