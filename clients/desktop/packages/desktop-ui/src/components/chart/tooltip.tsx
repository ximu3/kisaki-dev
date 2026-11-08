/** @fileoverview Unovis owns pointer placement and its public visibility state drives the shared surface. */

import { createMemo, createUniqueId, onCleanup, onMount, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { VisTooltip, VisTooltipSelectors } from '@unovis/solid'
import type { VisTooltipProps } from '@unovis/solid'
import { classes } from '../../internal/dom'
import { applySurfaceOrigin, surfaceOrigin } from '../../internal/popup/origin'
import surface from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

/** Keep the engine's rendered element stable across samples. Plain values are displayed as text. */
export function createTooltipViewport() {
  let viewport: HTMLDivElement | undefined
  let last: string | HTMLElement | undefined

  return (content: string | HTMLElement): string | HTMLElement => {
    if (content === '') {
      return content
    }
    if (!viewport) {
      const owner = typeof content === 'string' ? document : content.ownerDocument
      viewport = owner.createElement('div')
      viewport.className = classes(surface.viewport, styles.tooltipViewport)
    }
    if (content !== last) {
      viewport.replaceChildren(content)
      last = content
    }
    return viewport
  }
}

export type ChartTooltipProps = VisTooltipProps

export function ChartTooltip(props: ChartTooltipProps): JSX.Element {
  const [local, rest] = splitProps(props, ['attributes', 'triggers'])
  const id = createUniqueId()
  const render = createTooltipViewport()
  const triggers = createMemo(() => {
    const bound: NonNullable<ChartTooltipProps['triggers']> = {}
    for (const [selector, template] of Object.entries(local.triggers ?? {})) {
      if (template) {
        bound[selector] = (...args) => {
          const content = template(...args)
          return content ? render(content) : content
        }
      }
    }
    return bound
  })
  let marker!: HTMLDivElement

  onMount(() => {
    const plot = marker.parentElement!
    let element: HTMLElement | null = null
    let point: { x: number; y: number } | undefined

    const sync = () => {
      if (!element) {
        return
      }
      const visible = element.classList.contains(VisTooltipSelectors.show)
      if (visible === element.hasAttribute('data-kui-chart-open')) {
        return
      }
      if (point) {
        const rect = element.getBoundingClientRect()
        if (rect.width && rect.height) {
          applySurfaceOrigin(element, surfaceOrigin(point, rect))
        }
      }
      element.toggleAttribute('data-kui-chart-open', visible)
    }

    const visibility = new MutationObserver(sync)
    const connect = () => {
      if (element || !marker.isConnected) {
        return
      }
      element = (props.container ?? plot).querySelector<HTMLElement>(
        `[data-kui-chart-tooltip="${CSS.escape(id)}"]`,
      )
      if (element) {
        element.classList.add(surface.chart!, styles.engineTooltip!)
        // Keep Unovis's display lifecycle and opacity transition, driven by the surface's visible state.
        element.style.opacity = 'var(--kui-chart-opacity)'
        element.style.transitionTimingFunction = 'var(--kui-frame-ease)'
        visibility.observe(element, { attributes: true, attributeFilter: ['class'] })
        sync()
      }
    }

    const pointer = (event: MouseEvent) => {
      point = { x: event.clientX, y: event.clientY }
      if (!element) {
        connect()
      }
    }
    plot.addEventListener('mousemove', pointer, { capture: true, passive: true })
    queueMicrotask(connect)
    onCleanup(() => {
      visibility.disconnect()
      plot.removeEventListener('mousemove', pointer, true)
    })
  })

  return (
    <div
      hidden
      ref={(node) => {
        marker = node
      }}
    >
      <VisTooltip
        {...rest}
        triggers={triggers()}
        attributes={{ ...local.attributes, 'data-kui-chart-tooltip': id }}
      />
    </div>
  )
}
