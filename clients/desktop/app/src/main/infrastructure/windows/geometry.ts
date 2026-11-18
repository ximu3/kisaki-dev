/** @fileoverview Restores native window bounds and presentation on an attached display. */

import { screen, type BrowserWindow, type Rectangle } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { WindowKind } from '../../../shared/window-api/protocol'

/** Last normal content bounds remain available after a maximize or full-screen transition. */
interface Geometry {
  bounds: Rectangle
  maximized: boolean
  fullScreen: boolean
}

/** Resolves visible geometry for this window kind and saves its final native state on release. */
export async function windowGeometry(root: string, kind: WindowKind) {
  const dir = join(root, 'windows')
  const file = join(dir, kind + '.json')
  const area = screen.getPrimaryDisplay().workAreaSize
  const minWidth = kind === 'main' ? 960 : 480
  const minHeight = kind === 'main' ? 560 : 360
  let bounds: Partial<Rectangle> = {
    width: Math.max(minWidth, Math.min(kind === 'main' ? 1400 : 740, Math.round(area.width * 0.9))),
    height: Math.max(
      minHeight,
      Math.min(kind === 'main' ? 850 : 520, Math.round(area.height * 0.9)),
    ),
  }
  let maximized = false,
    fullScreen = false
  try {
    const stored = JSON.parse(await readFile(file, 'utf8')) as Geometry
    const r = stored.bounds
    if (
      [r.x, r.y, r.width, r.height].every(Number.isSafeInteger) &&
      r.width >= minWidth &&
      r.height >= minHeight &&
      screen
        .getAllDisplays()
        .some(
          ({ workArea: s }) =>
            r.x + r.width > s.x &&
            r.y + r.height > s.y &&
            r.x < s.x + s.width &&
            r.y < s.y + s.height,
        )
    ) {
      bounds = r
      maximized = stored.maximized === true
      fullScreen = stored.fullScreen === true
    }
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Window geometry could not be restored', cause)
    }
  }
  return {
    options: { ...bounds, minWidth, minHeight },
    /** Restores native maximize and full-screen state after window creation. */
    restore(window: BrowserWindow) {
      if (maximized) {
        window.maximize()
      }
      if (fullScreen) {
        window.setFullScreen(true)
      }
    },
    /** Persists normal bounds and presentation before the window is destroyed. */
    async save(window: BrowserWindow) {
      const value: Geometry = {
        bounds: window.getNormalBounds(),
        maximized: window.isMaximized(),
        fullScreen: window.isFullScreen(),
      }
      await mkdir(dir, { recursive: true })
      await writeFile(file + '.tmp', JSON.stringify(value))
      await rename(file + '.tmp', file)
    },
  }
}
