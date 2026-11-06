/** @fileoverview Toast presentation, paused display clocks and local modal placement. */

import { createEffect, For, onCleanup, onMount, Show } from 'solid-js'
import type { JSX, ParentProps } from 'solid-js'
import { ToastContext, createToastController } from './controller'
import type { ToastEntry } from './controller'
import { Button } from '../button/control'
import { Spinner } from '../spinner/control'
import styles from './styles.module.css'

/** Place a provider inside each dialog that owns feedback. Labels are supplied by the host's locale. */
export interface ToastProviderProps extends ParentProps {
  regionLabel: string
  closeLabel: string
  durationMs?: number
  class?: string
}

/** Own a presentation region without changing the lifetime of the views that create its messages. */
export function ToastProvider(props: ToastProviderProps): JSX.Element {
  const controller = createToastController(() => props.durationMs ?? 5000)
  let region!: HTMLDivElement
  onMount(() => {
    createEffect(() => {
      if (controller.entries().length) {
        if (!region.matches(':popover-open')) {
          region.showPopover()
        }
      } else if (region.matches(':popover-open')) {
        region.hidePopover()
      }
    })
    onCleanup(() => {
      if (region.matches(':popover-open')) {
        region.hidePopover()
      }
    })
  })

  return (
    <ToastContext.Provider value={controller}>
      {props.children}
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
    </ToastContext.Provider>
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
          fallback={props.entry.message().type === 'success' ? '✓' : '!'}
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
        ×
      </Button>
    </div>
  )
}
