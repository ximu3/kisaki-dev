/** @fileoverview Adopts one document's palette, window controls and held font faces. */

import type { ViewAppearance } from '@kisaki3/desktop-contracts/appearance'
import type { WindowApi } from '../../shared/window-api'

/** RPC operations used by the document to read and release presentation resources. */
type PresentationCall = <M extends keyof WindowApi>(
  method: M,
  ...args: Parameters<WindowApi[M]>
) => Promise<ReturnType<WindowApi[M]>>

/** Coordinates base colors and the latest complete appearance for a single connected document. */
export function createDocumentAppearance(
  call: PresentationCall,
  caption?: (background: string, foreground: string) => Promise<void>,
) {
  let generation = 0
  let held: string | undefined
  let installed = new Set<FontFace>()
  const fonts = new Map<string, Promise<FontFace>>()

  /** Applies the full visual branch and scale together in this document. */
  async function apply(value: ViewAppearance) {
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
      /** Resolves modern CSS colors to the sRGB bytes accepted by Electron's native overlay. */
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
      let load = fonts.get(key)
      if (!load) {
        load = new FontFace(
          face.family,
          'url(' + JSON.stringify(face.url) + ')',
          face.descriptors,
        ).load()
        fonts.set(key, load)
      }
      requested.set(key, load)
    }
    const loaded = await Promise.allSettled(requested.values())
    if (version !== generation) {
      await call('resources.release', result.hold)
      return
    }
    const next = new Set<FontFace>()
    const keys = [...requested.keys()]
    for (const [i, result] of loaded.entries()) {
      if (result.status === 'fulfilled') {
        next.add(result.value)
      } else {
        fonts.delete(keys[i]!)
      }
    }
    for (const key of fonts.keys()) {
      if (!requested.has(key)) {
        fonts.delete(key)
      }
    }
    for (const face of installed) {
      if (!next.has(face)) {
        document.fonts.delete(face)
      }
    }
    for (const face of next) {
      if (!installed.has(face)) {
        document.fonts.add(face)
      }
    }
    installed = next

    const old = held
    held = result.hold
    await Promise.all([apply(value), old && call('resources.release', old)])
  }

  async function initialize() {
    const base = call('appearance.base').then((value) => {
      if (!held && generation <= 1) {
        return apply(value)
      }
    })
    await Promise.all([base, refreshAppearance()])
  }

  return { initialize, refresh: refreshAppearance }
}
