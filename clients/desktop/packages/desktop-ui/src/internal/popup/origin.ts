/** @fileoverview Project an invocation point onto the final surface bounds. */

export interface SurfaceOrigin {
  x: string
  y: string
}

export function surfaceOrigin(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number },
): SurfaceOrigin {
  const percent = (offset: number, size: number) =>
    `${100 * Math.min(1, Math.max(0, offset / (size || 1)))}%`

  return {
    x: percent(point.x - bounds.x, bounds.width),
    y: percent(point.y - bounds.y, bounds.height),
  }
}

export function applySurfaceOrigin(node: HTMLElement, origin: SurfaceOrigin): void {
  node.style.setProperty('--kui-popup-origin-x', origin.x)
  node.style.setProperty('--kui-popup-origin-y', origin.y)
}
