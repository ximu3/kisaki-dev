import type { ViewAppearance } from '@kisaki3/desktop-contracts/appearance'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import type { FontTokenName } from '@kisaki3/desktop-appearance/tokens'
import { createSignal } from 'solid-js'
import type { WindowApi } from '../../shared/window-api'

type PresentationCall = <M extends keyof WindowApi>(
  method: M,
  ...args: Parameters<WindowApi[M]>
) => Promise<ReturnType<WindowApi[M]>>

export type PresentationIssue = 'theme' | FontTokenName

export function createDocumentAppearance(
  call: PresentationCall,
  caption?: (background: string, foreground: string) => Promise<void>,
) {
  let generation = 0
  let activeBinding: string | undefined
  let installedFonts = new Set<FontFace>()
  const fontLoads = new Map<string, Promise<FontFace>>()
  const [issues, setIssues] = createSignal<readonly PresentationIssue[]>([])

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
      const color = (token: '--chrome' | '--chrome-foreground') => {
        context.fillStyle = value.cssVariables[token]
        context.fillRect(0, 0, 1, 1)
        // Electron's native overlay accepts sRGB bytes. A CSS color may use another color space.
        const bytes = context.getImageData(0, 0, 1, 1).data
        return '#' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
      }
      await caption(color('--chrome'), color('--chrome-foreground'))
    }
  }

  async function refreshAppearance() {
    const version = ++generation
    const result = await call('appearance.get')
    if (version !== generation) {
      await call('resources.release', result.hold)
      return
    }

    const value = result.value
    const requested = new Map<string, { family: string; load: Promise<FontFace> }>()
    for (const face of value.fontFaces) {
      const key = JSON.stringify([face.family, face.url, face.descriptors])
      let load = fontLoads.get(key)
      if (!load) {
        load = Promise.resolve().then(() =>
          new FontFace(
            face.family,
            'url(' + JSON.stringify(face.url) + ')',
            face.descriptors,
          ).load(),
        )
        fontLoads.set(key, load)
      }
      requested.set(key, { family: face.family, load })
    }
    const entries = [...requested.entries()]
    const loaded = await Promise.allSettled(entries.map(([, entry]) => entry.load))
    if (version !== generation) {
      await call('resources.release', result.hold)
      return
    }
    const failed = new Set<string>()
    for (const [i, load] of loaded.entries()) {
      if (load.status === 'rejected') {
        const [key, { family }] = entries[i]!
        fontLoads.delete(key)
        failed.add(family)
      }
    }
    for (const key of fontLoads.keys()) {
      if (!requested.has(key)) {
        fontLoads.delete(key)
      }
    }

    const nextFonts = new Set<FontFace>()
    for (const load of loaded) {
      if (load.status === 'fulfilled' && !failed.has(load.value.family)) {
        nextFonts.add(load.value)
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

    const cssVariables = { ...value.cssVariables }
    const unavailable = new Set<PresentationIssue>(
      result.issues.map((issue) => (issue.code === 'themeUnavailable' ? 'theme' : issue.slot)),
    )
    for (const slot of ['--font-sans', '--font-mono'] as const) {
      const family = result.fontFamilies[slot]
      if (family && failed.has(family)) {
        cssVariables[slot] = defaults[value.colorScheme][slot]
        unavailable.add(slot)
      }
    }

    const previousBinding = activeBinding
    activeBinding = result.hold
    setIssues([...unavailable])
    await Promise.all([
      applyAppearance({ ...value, cssVariables }),
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

  return { initialize, refresh: refreshAppearance, issues }
}
