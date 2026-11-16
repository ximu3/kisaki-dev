/** @fileoverview Actual Electron verifies modal interaction and capability teardown in an isolated profile. */

import { expect, _electron } from '@playwright/test'
import { onTestFinished } from 'vite-plus/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { runPnpm } from '@kisaki3/tooling/process'
import { consumerTest as test, packageRoot } from './environment'

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
    args: [
      consumerDirectory,
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
  await page.getByRole('button', { name: 'Candidate', exact: true }).press('ArrowDown')
  await expect(page.getByRole('combobox', { name: 'Search candidates' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Edit sample' })).toBeVisible()
  await page.getByRole('button', { name: 'Close editor' }).click()
  await expect(page.getByRole('button', { name: 'Open dialog', exact: true })).toBeFocused()

  await page.getByRole('button', { name: 'Load resources' }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toBeVisible()
  await page.getByRole('button', { name: 'Release resources' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-resources-released', 'true')

  await page.screenshot({
    path: join(packageRoot, 'test-results/consumers/electron.png'),
    fullPage: true,
  })
})
