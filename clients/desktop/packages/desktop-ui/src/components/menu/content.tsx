import { onSettled, createEffect, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
import { createFocusNavigation, focusableItems } from '../../internal/focus'
import { createPopup, type PopupPlacement } from '../../internal/popup/controller'
import frame from '../../internal/popup/surface.module.css'
import { useMenu } from './state'
import styles from './styles.module.css'

export function MenuContent(
  props: JSX.HTMLAttributes<HTMLDivElement> & { placement?: PopupPlacement },
): JSX.Element {
  const state = useMenu()
  const rest = omit(
    props,
    'class',
    'children',
    'ref',
    'placement',
    'onKeyDown',
    'onPointerEnter',
    'onPointerLeave',
  )

  let content!: HTMLDivElement
  let viewport!: HTMLDivElement
  const selector = '[role^="menuitem"]'
  const items = () =>
    focusableItems(content, selector).filter((node) => node.closest('[role="menu"]') === content)

  createPopup({
    element: () => content,

    anchor: state.anchor,
    open: state.open,
    controlled: state.controlled,
    change: state.change,
    point: state.point,

    placement: (anchor) => {
      if (state.parent) {
        return getComputedStyle(anchor).direction === 'rtl' ? 'left-start' : 'right-start'
      }
      return props.placement ?? 'bottom-start'
    },
  })

  const navigate = createFocusNavigation(
    () => viewport,
    ':scope > [role^="menuitem"], :scope > [role="group"] > [role^="menuitem"]',
    () => 'vertical',
  )
  createEffect(
    () => state.open(),
    (opened) => {
      if (opened && state.focusOnOpen) {
        onSettled(() => {
          if (state.open()) {
            const options = items()
            ;(state.last ? options.at(-1) : options[0])?.focus()
          }
        })
      }
    },
  )

  return (
    <div
      {...rest}
      ref={[
        (node) => {
          content = node
          state.content = node
        },
        props.ref,
      ]}
      id={state.id}
      popover={state.controlled() ? 'manual' : 'auto'}
      role="menu"
      tabindex={-1}
      class={[frame.anchor, styles.root, props.class]}
      onPointerEnter={(event) => {
        state.hover.stop()
        callHandler(props.onPointerEnter, event)
      }}
      onPointerLeave={(event) => {
        if (state.parent && !content.contains(event.relatedTarget as Node | null)) {
          state.hover.leaveContent()
        }
        callHandler(props.onPointerLeave, event)
      }}
      onKeyDown={(event) => {
        callHandler(props.onKeyDown, event)
        if (event.defaultPrevented) {
          return
        }

        if (event.key === 'Tab') {
          state.change(false)
          return
        }

        const back = getComputedStyle(content).direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
        if (state.parent && event.key === back) {
          event.preventDefault()
          event.stopPropagation()
          state.change(false)
          onSettled(() => {
            if (!state.open()) {
              state.anchor()?.focus()
            }
          })
          return
        }

        navigate(event)
        event.stopPropagation()
      }}
    >
      <div
        ref={(node) => {
          viewport = node
        }}
        class={[frame.viewport, styles.items]}
      >
        {props.children}
      </div>
    </div>
  )
}
