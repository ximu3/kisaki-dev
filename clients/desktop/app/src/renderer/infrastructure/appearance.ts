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
  let installed: FontFace[] = []

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
    const value = result.value
    const loaded = await Promise.allSettled(
      value.fontFaces.map((face) =>
        new FontFace(face.family, 'url(' + JSON.stringify(face.url) + ')', face.descriptors).load(),
      ),
    )
    if (version !== generation) {
      await call('resources.release', result.hold)
      return
    }
    for (const face of installed) {
      document.fonts.delete(face)
    }
    installed = loaded.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    for (const face of installed) {
      document.fonts.add(face)
    }
    const applied = apply(value)
    const old = held
    held = result.hold
    if (old) {
      await call('resources.release', old)
    }
    await applied
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
