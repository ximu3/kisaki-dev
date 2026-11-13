/** @fileoverview Window notification presentation, paused clocks and active-modal mounting. */

import { createEffect, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js'
import type { JSX } from 'solid-js'
import { createToastController } from './controller'
import { createStackMotion } from './stack'
import type { ToastEntry } from './controller'
import { Icon, X, StatusIcon } from '../../internal/icon/glyph'
import { observeModalHost } from '../../internal/modal-host'
import { Button } from '../button/control'
import { Spinner } from '../spinner/control'
import { classes } from '../../internal/dom'
import surface from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

/** Document-owned notification host labels, default duration and presentation class. */
export interface ToasterProps {
  regionLabel: string
  closeLabel: string
  /** Default display duration in milliseconds; omission uses 5000. */
  durationMs?: number
  class?: string
}

/**
 * Installs the document's notification region and moves it into the active native modal.
 *
 * The same cards and clocks survive modal-host changes. Only one Toaster is installed per document.
 */
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
    /** Shows the manual popover when its queue contains messages and the region is closed. */
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

/**
 * Renders one message with its own display clock and exit lifetime.
 *
 * Hover and focus pause remaining time; loading and persistent messages do not automatically
 * dismiss.
 */
function ToastItem(props: {
  entry: ToastEntry
  closeLabel: string
  /** Marks the owning queue entry ended when its display lifetime is complete. */
  dismiss: () => void
  /** Removes the ended entry after exit presentation settles. */
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

  /** Returns the status-icon tone, using info for the loading fallback. */
  const statusType = () => {
    const type = props.entry.message().type
    return type === 'loading' ? 'info' : type
  }

  /** Stops expiration timers and preserves the unspent display duration. */
  const stop = () => {
    clearTimeout(fadeTimer)
    setExpiring(false)
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
      remaining = Math.max(0, remaining - (performance.now() - started))
    }
  }
  /**
   * Starts remaining display and exit timers when the message is live, unpaused and nonpersistent.
   */
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
    const exitMs = Number(getComputedStyle(card).getPropertyValue('--kui-toast-exit-ms'))
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
      /** Releases the entry after exit settles if the rendering effect is still current. */
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
        <Icon icon={X} />
      </Button>
    </div>
  )
}
