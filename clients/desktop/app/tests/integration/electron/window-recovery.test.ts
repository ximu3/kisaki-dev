import { once } from 'node:events'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildDirectory } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'
import { expect, launchBuiltDesktop, test } from '../../support/electron'

test('a failed entry on reload reports the document failure and exits', async ({ profile }) => {
  const runtime = join(profile, 'recovery-build')
  await cp(buildDirectory(hostTarget()), runtime, { recursive: true })
  const application = await launchBuiltDesktop(runtime, profile)
  const process = application.process()
  const closed = once(process, 'close')
  void closed.catch(() => {})
  const windowEvents = async () =>
    (await readFile(join(profile, 'logs/runtime.log'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => (JSON.parse(line) as { event: string }).event)
  try {
    const page = await application.firstWindow()
    const menu = page.getByRole('button', { name: 'Application menu' })
    await expect(menu).toBeVisible()
    await expect.poll(windowEvents).toContain('ready')
    await page.reload()
    await expect(menu).toBeVisible()
    await application.evaluate(({ Menu }) => {
      const preferences = Menu.getApplicationMenu()
        ?.items.flatMap((menu) => menu.submenu?.items ?? [])
        .find((item) => item.label === 'Preferences')
      if (!preferences) {
        throw new Error('The native Preferences action is unavailable')
      }
      const click = preferences.click as (this: typeof preferences) => void
      click.call(preferences)
    })
    const preferences = page.getByRole('dialog', { name: 'Preferences', exact: true })
    await expect(preferences).toBeVisible()
    await preferences.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(preferences).toBeHidden()

    const html = join(runtime, 'renderer/main/index.html')
    const original = await readFile(html, 'utf8')
    const broken = original.replace(
      /(<script type="module" crossorigin src=")[^"]+/,
      '$1./missing-entry.js',
    )
    expect(broken).not.toBe(original)
    await writeFile(html, broken)

    const report = join(profile, 'window-error.txt')
    await application.evaluate(({ dialog }, report) => {
      const { writeFileSync } = globalThis.process.getBuiltinModule('node:fs')!
      dialog.showErrorBox = (_title, message) => writeFileSync(report, message)
    }, report)
    const failedEntry = page.waitForEvent('requestfailed', {
      predicate: (request) => new URL(request.url()).pathname === '/main/missing-entry.js',
    })
    void page.reload({ waitUntil: 'commit' }).catch(() => {})
    await failedEntry
    await expect.poll(() => process.exitCode, { timeout: 15_000 }).toBe(1)
    expect(await readFile(report, 'utf8')).toBe('The window entry module could not be loaded')

    expect((await windowEvents()).slice(-3)).toEqual(['failed', 'closing', 'closed'])
  } finally {
    if (process.exitCode === null && process.signalCode === null) {
      await application.close()
    }
    await closed
  }
})

test('restores an inaccessible window and retains a usable partly visible title bar', async ({
  desktop,
  profile,
}) => {
  test.skip(process.platform !== 'win32', 'Exercises native Windows window placement')
  await expect(
    (await desktop.firstWindow()).getByRole('button', { name: 'Application menu' }),
  ).toBeVisible()
  const rightmost = await desktop.evaluate(({ screen }) =>
    screen
      .getAllDisplays()
      .reduce(
        (best, { workArea }) =>
          workArea.x + workArea.width > best.x + best.width ? workArea : best,
        screen.getPrimaryDisplay().workArea,
      ),
  )
  await desktop.close()

  const right = rightmost.x + rightmost.width
  const geometryPath = join(profile, 'windows/main.json')
  for (const visibleWidth of [1, 200]) {
    const saved = { x: right - visibleWidth, y: rightmost.y + 30, width: 1000, height: 560 }
    await writeFile(
      geometryPath,
      JSON.stringify({ bounds: saved, maximized: false, fullScreen: false }),
    )
    const restored = await launchBuiltDesktop(buildDirectory(hostTarget()), profile)
    try {
      const page = await restored.firstWindow()
      await expect(page.getByRole('button', { name: 'Application menu' })).toBeVisible()
      const bounds = await restored.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.getNormalBounds(),
      )
      if (visibleWidth === 1) {
        expect(bounds.x).toBeLessThan(right - 200)
      } else {
        expect(bounds.x).toBe(saved.x)
      }
    } finally {
      await restored.close()
    }
  }
})
