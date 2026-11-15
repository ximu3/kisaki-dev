/** @fileoverview Unovis owns pointer placement and its public visibility state drives the shared surface. */

import { createMemo, createUniqueId, onCleanup, onMount, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { VisTooltip, VisTooltipSelectors } from '@unovis/solid'
import type { VisTooltipProps } from '@unovis/solid'
import { classes } from '../../internal/dom'
import surface from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

/**
 * Creates a renderer that reuses one tooltip viewport across samples.
 *
 * String content is inserted as text; an empty string remains the engine's empty-content signal.
 */
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

/** Tooltip placement, attributes and sample triggers from the official Solid adapter. */
export type ChartTooltipProps = VisTooltipProps

/**
 * Renders an engine-positioned tooltip with stable content and the shared popup surface.
 *
 * Visibility observation and pending frame work are released with the component owner.
 */
export function ChartTooltip(props: ChartTooltipProps): JSX.Element {
  const [local, rest] = splitProps(props, ['attributes', 'triggers'])
  const id = createUniqueId()
  /** Stable tooltip viewport renderer shared by the active trigger templates. */
  const render = createTooltipViewport()
  /** Reactive selector-to-template bindings that reuse the same tooltip viewport. */
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
    let pending = 0

    /**
     * Mirrors engine visibility onto the shared surface and settles a missing or cancelled exit
     * transition.
     */
    const sync = () => {
      if (!element) {
        return
      }
      const visible = element.classList.contains(VisTooltipSelectors.show)
      if (visible === element.hasAttribute('data-kui-chart-open')) {
        return
      }
      element.toggleAttribute('data-kui-chart-open', visible)
      if (!visible) {
        // Unovis normally hides on transitionend. A zero-duration or canceled fade has no such event.
        const tip = element
        /** Finds the tooltip's current opacity transition, if any. */
        const fade = () =>
          tip
            .getAnimations()
            .find((a) => a instanceof CSSTransition && a.transitionProperty === 'opacity')
        /** Marks the tooltip hidden once it remains closed with no opacity transition. */
        const finish = () => {
          if (!tip.classList.contains(VisTooltipSelectors.show) && !fade()) {
            tip.classList.add(VisTooltipSelectors.hidden)
          }
        }
        const exit = fade()
        if (exit) {
          void exit.finished.catch(finish)
        } else {
          finish()
        }
      }
    }

    const visibility = new MutationObserver(() => {
      if (!element) {
        return
      }
      // A mark may relinquish its tooltip during mousemove, before the crosshair renders the
      // same sample in a frame callback. Only a missing result after that frame is a close.
      if (
        !element.classList.contains(VisTooltipSelectors.show) &&
        plot.matches(':hover') &&
        element.hasAttribute('data-kui-chart-open')
      ) {
        if (!pending) {
          pending = requestAnimationFrame(() => {
            pending = requestAnimationFrame(() => {
              pending = 0
              sync()
            })
          })
        }
      } else {
        cancelAnimationFrame(pending)
        pending = 0
        sync()
      }
    })
    /**
     * Attaches the shared surface and visibility observer when the engine tooltip element becomes
     * available.
     */
    const connect = () => {
      if (element || !marker.isConnected) {
        return
      }
      element = (props.container ?? plot).querySelector<HTMLElement>(
        `[data-kui-chart-tooltip="${CSS.escape(id)}"]`,
      )
      if (element) {
        plot.removeEventListener('mousemove', connect, true)
        element.classList.add(surface.chart!, styles.engineTooltip!)
        // Keep Unovis's display lifecycle and opacity transition, driven by the surface's visible state.
        element.style.opacity = 'var(--kui-chart-opacity)'
        element.style.transitionProperty = 'opacity'
        element.style.transitionTimingFunction = 'var(--kui-frame-ease)'
        visibility.observe(element, { attributes: true, attributeFilter: ['class'] })
        sync()
      }
    }

    plot.addEventListener('mousemove', connect, { capture: true, passive: true })
    queueMicrotask(connect)
    onCleanup(() => {
      visibility.disconnect()
      cancelAnimationFrame(pending)
      plot.removeEventListener('mousemove', connect, true)
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
