/** @fileoverview Actual Electron verifies modal interaction and capability teardown in an isolated profile. */

import { expect, _electron } from '@playwright/test'
import { onTestFinished } from 'vite-plus/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { runPnpm } from '@kisaki3/tooling/process'
import { consumerTest as test } from './environment'

test.override('host', 'electron')

test('Electron consumes the same packed UI in a sandboxed document with native modal scope', async ({
  consumerDirectory,
  siteUrl,
  resultsDirectory,
  signal,
}) => {
  await runPnpm(['exec', 'install-electron'], { cwd: consumerDirectory, signal })
  // In Node, the consumer's Electron package exports the path to its own executable.
  const executablePath = createRequire(join(consumerDirectory, 'package.json'))(
    'electron',
  ) as string

  await mkdir(join(consumerDirectory, 'profile'))
  const application = await _electron.launch({
    executablePath,
    cwd: consumerDirectory,
    args: [
      '.',
      `--ui-consumer-url=${siteUrl}`,
      `--user-data-dir=${join(consumerDirectory, 'profile')}`,
    ],
  })
  onTestFinished(() => application.close())
  const page = await application.firstWindow()
  await writeFile(
    join(resultsDirectory, 'electron-environment.json'),
    JSON.stringify(
      await application.evaluate(() => ({
        versions: process.versions,
        platform: process.platform,
        arch: process.arch,
      })),
      null,
      2,
    ),
  )

  await page.getByRole('button', { name: 'Open dialog', exact: true }).click()
  const candidate = page.getByRole('combobox', { name: 'Candidate', exact: true })
  const search = page.getByRole('combobox', { name: 'Search candidates' })
  await candidate.press('ArrowDown')
  await expect(candidate).toBeFocused()
  await candidate.press('Tab')
  await expect(search).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(candidate).toBeFocused()
  await expect(page.getByRole('dialog', { name: 'Edit sample' })).toBeVisible()
  await page.getByRole('button', { name: 'Close editor' }).click()
  await expect(page.getByRole('button', { name: 'Open dialog', exact: true })).toBeFocused()

  await page.getByRole('button', { name: 'Load resources' }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toBeVisible()
  await page.getByRole('button', { name: 'Release resources' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-resources-released', 'true')

  await page.screenshot({
    path: join(resultsDirectory, 'electron.png'),
    fullPage: true,
  })
})
