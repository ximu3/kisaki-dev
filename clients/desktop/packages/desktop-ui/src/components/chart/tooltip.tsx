/** @fileoverview Unovis owns pointer placement and its public visibility state drives the shared surface. */

import { createMemo, createUniqueId, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Tooltip } from '@unovis/ts'
import type { TooltipConfigInterface } from '@unovis/ts'
import { classes } from '../../internal/dom'
import surface from '../../internal/popup/surface.module.css'
import { chartPart } from './parts'
import styles from './styles.module.css'

/**
 * Creates a renderer that reuses one tooltip viewport across samples.
 *
 * String content is inserted as text. An empty string remains the engine's empty-content signal.
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

/** Applies the shared surface and returns a release function for its visibility observer. */
function observeTooltip(engine: Tooltip): () => void {
  const element = engine.element
  let pending = 0

  /** Mirrors Unovis visibility and settles exits when an opacity transition ends or is skipped. */
  const sync = () => {
    const visible = element.classList.contains(Tooltip.selectors.show)
    if (visible === element.hasAttribute('data-kui-chart-open')) {
      return
    }
    element.toggleAttribute('data-kui-chart-open', visible)
    if (!visible) {
      /** Finds the tooltip's current opacity transition, if any. */
      const fade = () =>
        element
          .getAnimations()
          .find(
            (animation) =>
              animation instanceof CSSTransition && animation.transitionProperty === 'opacity',
          )
      /** Marks the tooltip hidden if it is still closed when an exit is canceled. */
      const finish = () => {
        if (!element.classList.contains(Tooltip.selectors.show) && !fade()) {
          element.classList.add(Tooltip.selectors.hidden)
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
    // Let a crosshair take over the same sample before closing the shared surface.
    if (
      !element.classList.contains(Tooltip.selectors.show) &&
      engine.getContainer()?.matches(':hover') &&
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

  element.classList.add(surface.chart!, styles.engineTooltip!)
  element.style.opacity = 'var(--kui-chart-opacity)'
  element.style.transitionProperty = 'opacity'
  element.style.transitionTimingFunction = 'var(--kui-frame-ease)'
  visibility.observe(element, { attributes: true, attributeFilter: ['class'] })

  return () => {
    visibility.disconnect()
    cancelAnimationFrame(pending)
  }
}

/** Tracks trigger listeners and surface observation for one active tooltip. */
class ChartTooltipEngine extends Tooltip {
  private readonly stopObserving = observeTooltip(this)

  /** Unbinds trigger events from marks that are leaving this tooltip. */
  override setComponents(components: Tooltip['components']): void {
    const retained = new Set(components)
    for (const component of this.components) {
      if (!retained.has(component)) {
        component.g.on('.tooltip', null)
      }
    }
    super.setComponents(components)
  }

  /** Releases tooltip-owned listeners, timers and markup. */
  override destroy(): void {
    this.setComponents([])
    this.stopObserving()
    super.destroy()
  }
}

/** Tooltip placement, attributes and sample triggers from the Unovis TypeScript engine. */
export type ChartTooltipProps = TooltipConfigInterface

/** Contributes an engine-positioned tooltip with stable content and the shared popup surface. */
export function ChartTooltip(props: ChartTooltipProps): JSX.Element {
  const rest = omit(props, 'attributes', 'triggers')
  const id = createUniqueId()
  const render = createTooltipViewport()

  /** Wraps each trigger's template using the tooltip's shared text viewport. */
  const triggers = createMemo(() => {
    const bound: NonNullable<ChartTooltipProps['triggers']> = {}
    for (const [selector, template] of Object.entries(props.triggers ?? {})) {
      if (template) {
        bound[selector] = (...args) => {
          const content = template(...args)
          return content ? render(content) : content
        }
      }
    }
    return bound
  })

  return chartPart(
    'tooltip',
    () => new ChartTooltipEngine(),
    () => ({
      ...rest,
      triggers: triggers(),
      attributes: { ...props.attributes, 'data-kui-chart-tooltip': id },
    }),
  )
}
