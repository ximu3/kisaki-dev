import { expect, test, vi } from 'vite-plus/test'
import type { Disposable } from '@kisaki3/desktop-contracts/operations'
import type { ViewResourcesApi } from '@kisaki3/desktop-contracts/resources'
import { createDocumentResources } from './resources'

test('a cancelled acquisition keeps its cancellation and disposal error without registering a handle', async () => {
  const resources = createDocumentResources(
    { bind: vi.fn<ViewResourcesApi['bind']>() },
    () => false,
  )
  const prepared = new Map<string, Disposable>()
  const cancelled = new Error('Cancelled during preparation')
  const failed = new Error('Release failed')
  const dispose = vi.fn(async () => {
    throw failed
  })

  await expect(
    resources.keep({ dispose }, AbortSignal.abort(cancelled), prepared),
  ).rejects.toMatchObject({
    errors: [cancelled, failed],
  })
  expect(dispose).toHaveBeenCalledTimes(1)
  expect(prepared.size).toBe(0)
  expect(resources.takeDisposers()).toEqual([])
})
