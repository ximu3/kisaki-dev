import { createMemo, createUniqueId, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Tooltip, type TooltipConfigInterface } from '@unovis/ts'
import { classes } from '../../internal/dom'
import surface from '../../internal/popup/surface.module.css'
import { chartPart } from './parts'
import styles from './styles.module.css'

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

function observeTooltip(engine: Tooltip): () => void {
  const element = engine.element
  let pending = 0

  const sync = () => {
    const visible = element.classList.contains(Tooltip.selectors.show)
    if (visible === element.hasAttribute('data-kui-chart-open')) {
      return
    }
    element.toggleAttribute('data-kui-chart-open', visible)
    if (!visible) {
      const fade = () =>
        element
          .getAnimations()
          .find(
            (animation) =>
              animation instanceof CSSTransition && animation.transitionProperty === 'opacity',
          )
      const finish = () => {
        if (!element.classList.contains(Tooltip.selectors.show) && !fade()) {
          element.classList.add(Tooltip.selectors.hidden)
        }
      }

      // A skipped opacity transition still needs to settle the exiting tooltip.
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

class ChartTooltipEngine extends Tooltip {
  readonly #stopObserving = observeTooltip(this)

  override setComponents(components: Tooltip['components']): void {
    const retained = new Set(components)
    for (const component of this.components) {
      if (!retained.has(component)) {
        component.g.on('.tooltip', null)
      }
    }
    super.setComponents(components)
  }

  override destroy(): void {
    this.setComponents([])
    this.#stopObserving()
    super.destroy()
  }
}

export type ChartTooltipProps = TooltipConfigInterface

export function ChartTooltip(props: ChartTooltipProps): JSX.Element {
  const rest = omit(props, 'attributes', 'triggers')
  const id = createUniqueId()
  const render = createTooltipViewport()

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
