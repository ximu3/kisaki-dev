/**
 * @fileoverview Verifies keyboard activation and visible close failures in the shared
 * desktop window view.
 */

import { afterEach, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'solid-js/web'
import { WindowRoot } from '../../src/renderer/components/window-root'
import '../../src/renderer/styles/base.css'

let dispose: (() => void) | undefined
let root: HTMLDivElement | undefined

afterEach(() => {
  dispose?.()
  root?.remove()
})

test('keyboard activation calls the owning window and close failures stay visible', async () => {
  root = document.createElement('div')
  document.body.append(root)
  const close = vi
    .fn<() => Promise<void>>()
    .mockRejectedValue(new Error('Synthetic bridge failure'))
  dispose = render(() => <WindowRoot title="Kisaki" close={close} />, root)

  const button = page.getByRole('button', { name: 'Close window' })
  await userEvent.tab()
  await expect.element(button).toHaveFocus()

  await userEvent.keyboard('{Enter}')

  expect(close).toHaveBeenCalledTimes(1)
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('This window could not be closed.')
})
