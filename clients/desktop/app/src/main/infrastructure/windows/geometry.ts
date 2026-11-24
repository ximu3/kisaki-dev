import { screen, type BrowserWindow, type Rectangle } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { WindowKind } from '../../../shared/window-api/protocol'

interface Geometry {
  bounds: Rectangle
  maximized: boolean
  fullScreen: boolean
}

function canReachCaption(bounds: Rectangle, area: Rectangle) {
  const captionHeight = 24
  const minimumVisibleWidth = 96
  const visibleWidth =
    Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x)
  const visibleHeight =
    Math.min(bounds.y + captionHeight, area.y + area.height) - Math.max(bounds.y, area.y)
  return visibleWidth >= minimumVisibleWidth && visibleHeight >= 16
}

export async function windowGeometry(root: string, kind: WindowKind) {
  const dir = join(root, 'windows')
  const file = join(dir, kind + '.json')
  const area = screen.getPrimaryDisplay().workArea
  const minWidth = kind === 'main' ? 960 : 480
  const minHeight = kind === 'main' ? 560 : 360
  const width = Math.max(
    minWidth,
    Math.min(kind === 'main' ? 1400 : 740, Math.round(area.width * 0.9)),
  )
  const height = Math.max(
    minHeight,
    Math.min(kind === 'main' ? 850 : 520, Math.round(area.height * 0.9)),
  )
  let bounds: Rectangle = {
    x: area.x + Math.max(0, Math.floor((area.width - width) / 2)),
    y: area.y + Math.max(0, Math.floor((area.height - height) / 2)),
    width,
    height,
  }
  let maximized = false
  let fullScreen = false

  try {
    const stored = JSON.parse(await readFile(file, 'utf8')) as Geometry
    const savedBounds = stored.bounds
    if (
      [savedBounds.x, savedBounds.y, savedBounds.width, savedBounds.height].every(
        Number.isSafeInteger,
      ) &&
      savedBounds.width >= minWidth &&
      savedBounds.height >= minHeight
    ) {
      const reachable = screen
        .getAllDisplays()
        .some(({ workArea }) => canReachCaption(savedBounds, workArea))
      if (reachable) {
        bounds = savedBounds
      } else {
        const { workArea } = screen.getDisplayMatching(savedBounds)
        const width = Math.max(minWidth, Math.min(savedBounds.width, workArea.width))
        const height = Math.max(minHeight, Math.min(savedBounds.height, workArea.height))
        bounds = {
          x: Math.max(workArea.x, Math.min(savedBounds.x, workArea.x + workArea.width - width)),
          y: Math.max(workArea.y, Math.min(savedBounds.y, workArea.y + workArea.height - height)),
          width,
          height,
        }
      }
      maximized = stored.maximized === true
      fullScreen = stored.fullScreen === true
    }
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Window geometry could not be restored', cause)
    }
  }
  let placed: Rectangle
  return {
    options: { ...bounds, minWidth, minHeight },
    restore(window: BrowserWindow) {
      if (
        process.platform === 'win32' &&
        !Number.isInteger(screen.getDisplayMatching(bounds).scaleFactor)
      ) {
        // Chromium rounds each native frame edge outwards. Match the measured outer size before showing it.
        let request = bounds
        for (let attempt = 0; attempt < 3; attempt++) {
          window.setBounds(request)
          const actual = window.getNormalBounds()
          const width = Math.max(minWidth, request.width + bounds.width - actual.width)
          const height = Math.max(minHeight, request.height + bounds.height - actual.height)
          if (width === request.width && height === request.height) {
            break
          }
          request = { ...bounds, width, height }
        }
      }
      placed = window.getNormalBounds()
      if (maximized) {
        window.maximize()
      }
      if (fullScreen) {
        window.setFullScreen(true)
      }
    },
    async save(window: BrowserWindow) {
      const normal = window.getNormalBounds()
      // At fractional display scales the native frame can round an unchanged request outwards.
      const restored = { ...bounds }
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        if (normal[key] !== placed[key]) {
          restored[key] = normal[key]
        }
      }
      const value: Geometry = {
        bounds: restored,
        maximized: window.isMaximized(),
        fullScreen: window.isFullScreen(),
      }
      await mkdir(dir, { recursive: true })
      await writeFile(file + '.tmp', JSON.stringify(value))
      await rename(file + '.tmp', file)
    },
  }
}
