/** @fileoverview Window notification presentation, paused clocks and active-modal mounting. */

import { createEffect, For, onCleanup, onMount, Show, untrack } from 'solid-js'
import type { JSX } from 'solid-js'
import { createToastController } from './controller'
import type { ToastEntry } from './controller'
import { Icon, mdiClose, StatusIcon } from '../../internal/icons'
import { observeModalHost } from '../../internal/modal-host'
import { Button } from '../button/control'
import { Spinner } from '../spinner/control'
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
  const controller = createToastController(() => props.durationMs ?? 5000)
  let region!: HTMLDivElement
  onMount(() => {
    const marker = region.ownerDocument.createComment('toast host')
    region.before(marker)
    const show = () => {
      if (controller.entries().length && !region.matches(':popover-open')) {
        region.showPopover()
      }
    }
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
      <For each={controller.entries()}>
        {(entry) => (
          <ToastItem
            entry={entry}
            closeLabel={props.closeLabel}
            dismiss={() => {
              controller.dismiss(entry.id)
            }}
          />
        )}
      </For>
    </div>
  )
}

/** Each rendered message owns one clock; hover and focus pause its remaining time. */
function ToastItem(props: {
  entry: ToastEntry
  closeLabel: string
  dismiss: () => void
}): JSX.Element {
  let timer: ReturnType<typeof setTimeout> | undefined
  let remaining = props.entry.durationMs
  let started = 0
  let hovered = false
  let focused = false
  const statusType = () => {
    const type = props.entry.message().type
    return type === 'loading' ? 'info' : type
  }

  const stop = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
      remaining = Math.max(0, remaining - (performance.now() - started))
    }
  }
  const resume = () => {
    if (hovered || focused || props.entry.persistent || props.entry.message().type === 'loading') {
      return
    }

    if (timer !== undefined) {
      return
    }

    started = performance.now()
    timer = setTimeout(props.dismiss, remaining)
  }

  createEffect(() => {
    void props.entry.message()
    stop()
    remaining = props.entry.durationMs
    resume()
  })
  onCleanup(stop)

  return (
    <div
      class={styles.item}
      data-type={props.entry.message().type}
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
          <Button size="sm" variant="outline" onClick={() => action().onClick()}>
            {action().label}
          </Button>
        )}
      </Show>
      <Button size="icon-xs" variant="ghost" aria-label={props.closeLabel} onClick={props.dismiss}>
        <Icon path={mdiClose} />
      </Button>
    </div>
  )
}
