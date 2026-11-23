import type { ViewAppearance } from '@kisaki3/desktop-contracts/appearance'
import type { WindowApi } from '../../shared/window-api'

type PresentationCall = <M extends keyof WindowApi>(
  method: M,
  ...args: Parameters<WindowApi[M]>
) => Promise<ReturnType<WindowApi[M]>>

export function createDocumentAppearance(
  call: PresentationCall,
  caption?: (background: string, foreground: string) => Promise<void>,
) {
  let generation = 0
  let activeBinding: string | undefined
  let installedFonts = new Set<FontFace>()
  const fontLoads = new Map<string, Promise<FontFace>>()

  async function applyAppearance(value: ViewAppearance) {
    const style = document.documentElement.style
    for (const [key, css] of Object.entries(value.cssVariables)) {
      style.setProperty(key, css)
    }
    style.setProperty('--interface-scale', String(value.interfaceScale))
    style.colorScheme = value.colorScheme
    document.documentElement.dataset.colorScheme = value.colorScheme

    if (caption) {
      const sample = document.createElement('canvas')
      sample.width = sample.height = 1
      const context = sample.getContext('2d', { willReadFrequently: true })!
      context.globalCompositeOperation = 'copy'
      // Electron's native overlay accepts sRGB bytes. A CSS color may use another color space.
      const color = (token: '--chrome' | '--chrome-foreground') => {
        context.fillStyle = value.cssVariables[token]
        context.fillRect(0, 0, 1, 1)
        const bytes = context.getImageData(0, 0, 1, 1).data
        return '#' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
      }
      await caption(color('--chrome'), color('--chrome-foreground'))
    }
  }

  /** Replaces the complete document font set and releases superseded bindings, including late reads. */
  async function refreshAppearance() {
    const version = ++generation
    const result = await call('appearance.get')
    if (version !== generation) {
      await call('resources.release', result.hold)
      return
    }

    const value = result.value
    const requested = new Map<string, Promise<FontFace>>()
    for (const face of value.fontFaces) {
      const key = JSON.stringify([face.family, face.url, face.descriptors])
      let load = fontLoads.get(key)
      if (!load) {
        load = new FontFace(
          face.family,
          'url(' + JSON.stringify(face.url) + ')',
          face.descriptors,
        ).load()
        fontLoads.set(key, load)
      }
      requested.set(key, load)
    }
    const loaded = await Promise.allSettled(requested.values())
    if (version !== generation) {
      await call('resources.release', result.hold)
      return
    }
    const nextFonts = new Set<FontFace>()
    const keys = [...requested.keys()]
    for (const [i, load] of loaded.entries()) {
      if (load.status === 'fulfilled') {
        nextFonts.add(load.value)
      } else {
        fontLoads.delete(keys[i]!)
      }
    }
    for (const key of fontLoads.keys()) {
      if (!requested.has(key)) {
        fontLoads.delete(key)
      }
    }

    for (const face of installedFonts) {
      if (!nextFonts.has(face)) {
        document.fonts.delete(face)
      }
    }
    for (const face of nextFonts) {
      if (!installedFonts.has(face)) {
        document.fonts.add(face)
      }
    }
    installedFonts = nextFonts

    const previousBinding = activeBinding
    activeBinding = result.hold
    await Promise.all([
      applyAppearance(value),
      previousBinding && call('resources.release', previousBinding),
    ])
  }

  async function initialize() {
    const base = call('appearance.base').then((value) => {
      if (!activeBinding && generation <= 1) {
        return applyAppearance(value)
      }
    })
    await Promise.all([base, refreshAppearance()])
  }

  return { initialize, refresh: refreshAppearance }
}
