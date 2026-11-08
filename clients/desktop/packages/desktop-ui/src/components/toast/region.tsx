/** @fileoverview Window notification presentation, paused clocks and active-modal mounting. */

import { createEffect, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js'
import type { JSX } from 'solid-js'
import { createToastController } from './controller'
import { createStackMotion } from './stack'
import type { ToastEntry } from './controller'
import { Icon, mdiClose, StatusIcon } from '../../internal/icon/icon'
import { observeModalHost } from '../../internal/modal-host'
import { Button } from '../button/control'
import { Spinner } from '../spinner/control'
import { classes } from '../../internal/dom'
import surface from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

/** Install once per window. Labels are supplied by the host's locale. */
export interface ToasterProps {
  regionLabel: string
  closeLabel: string
  durationMs?: number
  class?: string
}

/** Keep the same region and clocks while moving it into the active native modal. */
export function Toaster(props: ToasterProps): JSX.Element {
  let region!: HTMLDivElement
  let track!: HTMLDivElement
  const controller = createToastController(
    () => props.durationMs ?? 5000,
    createStackMotion(() => track),
  )
  onMount(() => {
    const marker = region.ownerDocument.createComment('toast host')
    region.before(marker)
    const show = () => {
      if (controller.entries().length && !region.matches(':popover-open')) {
        region.showPopover()
      }
    }
    const resize = new ResizeObserver(() => {
      region.toggleAttribute('data-overflow', track.offsetHeight > region.clientHeight)
    })
    resize.observe(track)
    resize.observe(region)

    const stop = observeModalHost(region.ownerDocument, (host) => {
      untrack(() => {
        if (region.matches(':popover-open')) {
          region.hidePopover()
        }
        if (host) {
          host.append(region)
        } else {
          marker.after(region)
        }
        show()
      })
    })

    createEffect(() => {
      if (controller.entries().length) {
        show()
      } else if (region.matches(':popover-open')) {
        region.hidePopover()
      }
    })
    onCleanup(() => {
      resize.disconnect()
      stop()
      if (region.matches(':popover-open')) {
        region.hidePopover()
      }
      marker.after(region)
      marker.remove()
    })
  })

  return (
    <div
      ref={(node) => {
        region = node
      }}
      popover="manual"
      role="region"
      aria-label={props.regionLabel}
      class={`${styles.region} ${props.class ?? ''}`}
    >
      <div
        ref={(node) => {
          track = node
        }}
        data-toast-stack=""
        class={styles.stack}
      >
        <For each={controller.entries()}>
          {(entry) => (
            <ToastItem
              entry={entry}
              closeLabel={props.closeLabel}
              release={() => controller.release(entry.id)}
              dismiss={() => {
                controller.dismiss(entry.id)
              }}
            />
          )}
        </For>
      </div>
    </div>
  )
}

/** Each rendered message owns one clock; hover and focus pause its remaining time. */
function ToastItem(props: {
  entry: ToastEntry
  closeLabel: string
  dismiss: () => void
  release: () => void
}): JSX.Element {
  let card!: HTMLDivElement
  let timer: ReturnType<typeof setTimeout> | undefined
  let fadeTimer: ReturnType<typeof setTimeout> | undefined
  let remaining = props.entry.durationMs
  let started = 0
  let hovered = false
  let focused = false
  const [expiring, setExpiring] = createSignal(false)

  onMount(() => {
    queueMicrotask(() => {
      // Resolve the initial transition once; moving the queue into a modal retains existing cards.
      card.getAnimations()
      card.removeAttribute('data-arriving')
    })
  })

  const statusType = () => {
    const type = props.entry.message().type
    return type === 'loading' ? 'info' : type
  }

  const stop = () => {
    clearTimeout(fadeTimer)
    setExpiring(false)
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
      remaining = Math.max(0, remaining - (performance.now() - started))
    }
  }
  const resume = () => {
    if (
      props.entry.ended() ||
      hovered ||
      focused ||
      props.entry.persistent ||
      props.entry.message().type === 'loading'
    ) {
      return
    }

    if (timer !== undefined) {
      return
    }

    started = performance.now()
    const configured = getComputedStyle(card).getPropertyValue('--kui-toast-exit-duration')
    const exitMs = parseFloat(configured)
    fadeTimer = setTimeout(() => setExpiring(true), Math.max(0, remaining - exitMs))
    timer = setTimeout(props.dismiss, remaining)
  }

  createEffect(() => {
    void props.entry.message()
    if (props.entry.ended()) {
      return
    }
    stop()
    remaining = props.entry.durationMs
    resume()
  })
  createEffect(() => {
    if (!props.entry.ended()) {
      return
    }
    clearTimeout(timer)
    clearTimeout(fadeTimer)
    let current = true
    onCleanup(() => {
      current = false
    })
    queueMicrotask(() => {
      if (!current) {
        return
      }
      const exit = card
        .getAnimations()
        .find((a) => a instanceof CSSTransition && a.transitionProperty === 'opacity')
      const finish = () => {
        if (current) {
          props.release()
        }
      }
      if (exit) {
        void exit.finished.then(finish, finish)
      } else {
        finish()
      }
    })
  })
  onCleanup(stop)

  return (
    <div
      ref={(node) => {
        card = node
      }}
      data-arriving=""
      data-ended={props.entry.ended() || undefined}
      inert={props.entry.ended()}
      class={classes(surface.staticSurface, surface.withClose, styles.item)}
      data-type={props.entry.message().type}
      data-expiring={expiring() || undefined}
      onPointerEnter={() => {
        hovered = true
        stop()
      }}
      onPointerLeave={() => {
        hovered = false
        resume()
      }}
      onFocusIn={() => {
        focused = true
        stop()
      }}
      onFocusOut={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          focused = false
          resume()
        }
      }}
    >
      <span class={styles.icon} aria-hidden="true">
        <Show
          when={props.entry.message().type === 'loading'}
          fallback={<StatusIcon type={statusType()} />}
        >
          <Spinner />
        </Show>
      </span>
      <div class={styles.text} role="status" aria-live="polite" aria-atomic="true">
        {props.entry.message().message}
      </div>
      <Show when={props.entry.message().action}>
        {(action) => (
          <Button
            size="sm"
            variant="outline"
            class={styles.action}
            onClick={() => {
              if (!props.entry.ended()) {
                action().onClick()
              }
            }}
          >
            {action().label}
          </Button>
        )}
      </Show>
      <Button
        size="icon"
        variant="ghost"
        class={surface.close}
        aria-label={props.closeLabel}
        onClick={props.dismiss}
      >
        <Icon path={mdiClose} />
      </Button>
    </div>
  )
}
