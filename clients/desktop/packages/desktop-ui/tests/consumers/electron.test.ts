/** @fileoverview Actual Electron verifies modal interaction and capability teardown in an isolated profile. */

import { expect } from '@playwright/test'
import { _electron } from '@playwright/test'
import { onTestFinished } from 'vitest'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { consumerTest as test, packageRoot } from '../support/consumer'

// Electron's Node entry returns its executable path; its declarations describe the running host.
const electron = createRequire(import.meta.url)('electron') as string

test('Electron consumes the same packed UI in a sandboxed document with native modal scope', async ({
  consumerDirectory,
  siteUrl,
  resultsDirectory,
}) => {
  const input = await readFile(join(packageRoot, 'tests/fixtures/electron/main.ts'), 'utf8')
  const script = join(consumerDirectory, 'electron-main.js')
  await writeFile(
    script,
    ts.transpileModule(input, {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    }).outputText,
  )

  await mkdir(join(consumerDirectory, 'profile'))
  const application = await _electron.launch({
    executablePath: electron,
    args: [
      script,
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
  await page.getByRole('combobox', { name: 'Candidate' }).press('ArrowDown')
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
