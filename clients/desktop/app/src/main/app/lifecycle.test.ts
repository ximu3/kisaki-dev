import { RpcError } from '@kisaki3/desktop-rpc'
import { expect, test, vi } from 'vite-plus/test'
import { releaseAll } from '../infrastructure/release'
import { createLifecycle } from './lifecycle'

test('a failed editor confirmation settles joined callers and allows a fresh exit', async () => {
  const confirm = vi
    .fn<() => Promise<boolean>>()
    .mockRejectedValueOnce(new RpcError('ConnectionClosed', 'The document disconnected'))
    .mockResolvedValue(true)
  const release = vi.fn(async () => {})
  const finish = vi.fn()
  const lifecycle = createLifecycle({
    confirm,
    accept() {},
    drain: async () => {},
    waiting: async () => 'wait',
    release,
    finish,
    fail: vi.fn(),
  })

  const states: string[] = []
  const observation = lifecycle.observe((state) => {
    states.push(state.status)
  })
  const attempt = lifecycle.restart()
  const joined = lifecycle.quit()
  const error = { code: 'ConnectionClosed', message: 'The document disconnected' }
  for (const result of await Promise.all([attempt, joined])) {
    expect(result).toEqual({ outcome: 'failed', error })
  }
  expect(await lifecycle.getState()).toMatchObject({ status: 'failed', intent: 'restart', error })
  expect(states).toEqual(['idle', 'closing', 'failed'])
  expect(confirm).toHaveBeenCalledTimes(1)
  expect(release).not.toHaveBeenCalled()
  expect(finish).not.toHaveBeenCalled()

  await expect(lifecycle.quit()).resolves.toEqual({ outcome: 'exiting' })
  expect(release).toHaveBeenCalledOnce()
  expect(finish).toHaveBeenCalledWith(false)
  await observation.dispose()
})

test('cancellation withdraws an outstanding editor confirmation', async () => {
  const entered = Promise.withResolvers<AbortSignal>()
  const decision = Promise.withResolvers<boolean>()
  const accept = vi.fn()
  const release = vi.fn(async () => {})
  const lifecycle = createLifecycle({
    confirm(signal) {
      entered.resolve(signal)
      return decision.promise
    },
    accept,
    drain: async () => {},
    waiting: async () => 'wait',
    release,
    finish: vi.fn(),
    fail: vi.fn(),
  })

  const attempt = lifecycle.quit()
  const signal = await entered.promise
  await lifecycle.cancel()
  expect(signal.aborted).toBe(true)
  await expect(attempt).resolves.toEqual({ outcome: 'cancelled' })
  decision.resolve(true)
  expect(accept).not.toHaveBeenCalled()
  expect(release).not.toHaveBeenCalled()
  await expect(lifecycle.getState()).resolves.toEqual({ status: 'idle' })
})

test('a failed committed restart completes cleanup, reports once and keeps admission closed', async () => {
  const completed: string[] = []
  const accept = vi.fn()
  const finish = vi.fn()
  const fail = vi.fn()
  const lifecycle = createLifecycle({
    confirm: async () => true,
    accept,
    drain: async () => {},
    waiting: async () => 'wait',
    release: () =>
      releaseAll([
        () => {
          throw new Error('Release failed')
        },
        () =>
          releaseAll([
            () => {
              throw new Error('Connection cleanup failed')
            },
            () => completed.push('closed'),
          ]),
      ]),
    finish,
    fail,
  })

  const result = await lifecycle.restart()
  expect(result).toEqual({
    outcome: 'failed',
    error: { code: 'OperationFailed', message: 'Release failed\nConnection cleanup failed' },
  })
  await expect(lifecycle.quit()).resolves.toEqual(result)
  expect(accept.mock.calls).toEqual([[false]])
  expect(completed).toEqual(['closed'])
  expect(fail.mock.calls).toEqual([['Release failed\nConnection cleanup failed']])
  expect(finish).not.toHaveBeenCalled()
})
