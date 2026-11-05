/** @fileoverview Action menus share native light dismissal, roving item focus and typeahead. */

import {
  createContext,
  createSignal,
  createUniqueId,
  onCleanup,
  Show,
  splitProps,
  useContext,
  type JSX,
} from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button, type ButtonProps } from './button'

export interface MenuProps {
  label: string
  trigger: JSX.Element
  children: JSX.Element
  class?: string
}

const closeMenu = createContext<() => void>()

/** Mount one top-layer menu and bind its invoker or context surface. */
function MenuSurface(
  props: MenuProps & { contextual?: boolean; triggerProps?: ButtonProps },
): JSX.Element {
  const id = createUniqueId()
  const [open, setOpen] = createSignal(false)
  let menu!: HTMLDivElement
  let trigger!: HTMLElement
  let restore: HTMLElement
  let buffer = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  /** Return enabled items in their current visual order. */
  function items(): HTMLButtonElement[] {
    return Array.from(menu.querySelectorAll('button[role^="menuitem"]:enabled'))
  }

  /** Dismiss and restore focus to the control that opened the menu. */
  function hide(): void {
    menu.hidePopover()
    restore?.focus()
  }

  /** Place the menu at its invoker or context point and focus an available item. */
  function show(last = false, point?: { x: number; y: number }): void {
    if (trigger.matches(':disabled')) {
      return
    }
    restore = trigger
    if (
      props.contextual &&
      trigger.ownerDocument.activeElement instanceof HTMLElement &&
      trigger.contains(trigger.ownerDocument.activeElement)
    ) {
      restore = trigger.ownerDocument.activeElement
    }
    menu.showPopover({ source: trigger })
    if (point) {
      menu.style.positionArea = 'none'
      menu.style.left =
        Math.max(0, Math.min(point.x, document.documentElement.clientWidth - menu.offsetWidth)) +
        'px'
      menu.style.top =
        Math.max(0, Math.min(point.y, document.documentElement.clientHeight - menu.offsetHeight)) +
        'px'
    }
    const choices = items()
    const firstFocus = (last ? choices.at(-1) : choices[0]) ?? menu
    firstFocus.focus()
  }

  /** Move within the menu, match a typed prefix or return to the document. */
  function keyboard(event: KeyboardEvent): void {
    if (event.isComposing) {
      return
    }
    const choices = items()
    const current = choices.findIndex((item) => item === menu.ownerDocument.activeElement)
    let next: HTMLButtonElement | undefined
    switch (event.key) {
      case 'ArrowDown':
        next = choices[(current + 1) % choices.length]
        break
      case 'ArrowUp':
        next = choices[(current + choices.length - 1) % choices.length]
        break
      case 'Home':
        next = choices[0]
        break
      case 'End':
        next = choices.at(-1)
        break
      case 'Escape':
        event.stopPropagation()
        hide()
        break
      case 'Tab':
        hide()
        return
      default: {
        if (
          event.key.length !== 1 ||
          event.key === ' ' ||
          event.ctrlKey ||
          event.altKey ||
          event.metaKey
        ) {
          return
        }
        clearTimeout(timer)
        buffer += event.key.toLocaleLowerCase()
        timer = setTimeout(() => {
          buffer = ''
        }, 500)
        next = [...choices.slice(current + 1), ...choices.slice(0, current + 1)].find((item) =>
          (item.getAttribute('aria-label') ?? item.textContent)
            .trim()
            .toLocaleLowerCase()
            .startsWith(buffer),
        )
      }
    }
    event.preventDefault()
    next?.focus()
  }
  onCleanup(() => clearTimeout(timer))
  return (
    <>
      {props.contextual ? (
        <div
          ref={(el) => {
            trigger = el
          }}
          tabIndex={0}
          aria-label={props.label}
          aria-controls={id}
          aria-expanded={open()}
          aria-haspopup="menu"
          class="ks-focus"
          onContextMenu={(event) => {
            event.preventDefault()
            show(false, { x: event.clientX, y: event.clientY })
          }}
          onKeyDown={(event) => {
            if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
              event.preventDefault()
              const rect = trigger.getBoundingClientRect()
              show(false, { x: rect.left, y: rect.bottom })
            }
          }}
        >
          {props.trigger}
        </div>
      ) : (
        <Button
          variant="outline"
          {...props.triggerProps}
          ref={(el) => {
            trigger = el
            const ref = props.triggerProps?.ref
            if (typeof ref === 'function') {
              ref(el)
            }
          }}
          aria-haspopup="menu"
          aria-expanded={open()}
          aria-controls={id}
          on:click={() => {
            if (menu.matches(':popover-open')) {
              hide()
            } else {
              show()
            }
          }}
          on:keydown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              show(event.key === 'ArrowUp')
            }
          }}
        >
          {props.trigger}
        </Button>
      )}
      <div
        ref={(element) => {
          menu = element
        }}
        id={id}
        role="menu"
        tabIndex={-1}
        aria-label={props.label}
        popover="auto"
        on:toggle={() => setOpen(menu.matches(':popover-open'))}
        on:keydown={keyboard}
        class={twMerge(
          'ks-popover ks-box min-w-32 rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-overlay',
          props.class,
        )}
      >
        <closeMenu.Provider value={hide}>{props.children}</closeMenu.Provider>
      </div>
    </>
  )
}

/** Open from a button using pointer, Enter, Space or either vertical arrow. */
export function DropdownMenu(props: MenuProps & { triggerProps?: ButtonProps }): JSX.Element {
  return <MenuSurface {...props} />
}

/** Open at the pointer or from the focused surface using the context-menu key. */
export function ContextMenu(props: MenuProps): JSX.Element {
  return <MenuSurface {...props} contextual />
}

export interface MenuItemProps extends Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'role' | 'type' | 'onSelect'
> {
  kind?: 'action' | 'checkbox' | 'radio'
  checked?: boolean
  onSelect?: () => void
}

/** The host owns the action and any selected value. Activation closes the menu. */
export function MenuItem(props: MenuItemProps): JSX.Element {
  const dismiss = useContext(closeMenu)
  const [local, rest] = splitProps(props, ['class', 'kind', 'checked', 'onSelect', 'children'])
  const roles = {
    action: 'menuitem',
    checkbox: 'menuitemcheckbox',
    radio: 'menuitemradio',
  } as const
  return (
    <button
      {...rest}
      type="button"
      tabIndex={-1}
      role={roles[local.kind ?? 'action']}
      aria-checked={local.kind && local.kind !== 'action' ? !!local.checked : undefined}
      class={twMerge(
        'ks-control flex w-full items-center gap-2 rounded-sm px-2 py-1 text-start text-sm hover:bg-accent focus:bg-accent focus:text-accent-foreground aria-checked:font-semibold',
        local.class,
      )}
      on:click={() => {
        dismiss?.()
        local.onSelect?.()
      }}
    >
      <Show when={local.kind && local.kind !== 'action'}>
        <span
          class={twMerge(
            'inline-block w-3',
            local.checked &&
              (local.kind === 'radio' ? "before:content-['●']" : "before:content-['✓']"),
          )}
          aria-hidden="true"
        />
      </Show>
      {local.children}
    </button>
  )
}
