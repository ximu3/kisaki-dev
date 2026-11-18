/** @fileoverview Presents removable shortcut bindings and stages new chords in an anchored recorder. */

import { createEffect, createSignal, createUniqueId, For, onCleanup, Show } from 'solid-js'
import { SelectedChips, type ChipLabels } from '../../../internal/chips/control'
import type { ControlSize } from '../../../internal/control/size'
import { classes, createElementRef } from '../../../internal/dom'
import { closeWhenUnavailable, fieldAttributes } from '../../../internal/field'
import { Icon, Keyboard } from '../../../internal/icon/glyph'
import { createPopup } from '../../../internal/popup/controller'
import { onFormReset } from '../../../internal/state'
import { Button } from '../../button/control'
import { InputFrame } from '../frame'
import { createShortcutRecording, type ShortcutKeypress } from './recording'
import popup from '../../../internal/popup/surface.module.css'
import frame from '../styles.module.css'
import styles from './styles.module.css'

/** An ordered list of bindings with host-defined keyboard syntax and localized actions. */
export interface ShortcutInputProps extends ChipLabels {
  class?: string
  size?: ControlSize | undefined
  disabled?: boolean
  value: readonly string[]
  label: string
  emptyLabel: string
  recordingLabel: string
  duplicateLabel: string
  resetLabel: string
  cancelLabel: string
  confirmLabel: string
  /** Returns the live modifier or chord display and the binding accepted for this key press. */
  capture: (event: KeyboardEvent) => ShortcutKeypress
  /** Displays the individual keys of a committed binding in order. */
  keycaps: (value: string) => readonly string[]
  /** Receives a new list after confirmation or removal of an individual binding. */
  onValueChange: (value: readonly string[]) => void
}

/** Holds new chords in the popover until the user confirms the finished recording. */
export function ShortcutInput(props: ShortcutInputProps) {
  const id = createUniqueId()
  const valueId = id + '-value'
  const attributes = fieldAttributes({})
  const disabled = () => props.disabled ?? attributes.disabled
  const [open, setOpen] = createSignal(false)
  const [trigger, bindTrigger] = createElementRef<HTMLButtonElement>()
  let panel!: HTMLDivElement
  let target!: HTMLDivElement

  const recording = createShortcutRecording((event) => props.capture(event))
  const label = (value: string) => props.keycaps(value).join('+')
  const duplicate = () => {
    const binding = recording.keypress().binding
    return binding !== null && props.value.includes(binding)
  }

  function close() {
    setOpen(false)
  }

  function toggle() {
    if (open()) {
      close()
    } else {
      recording.reset()
      setOpen(true)
    }
  }

  function finish() {
    close()
    trigger()?.focus({ preventScroll: true })
  }

  function reset() {
    target.focus({ preventScroll: true })
    recording.reset()
  }

  function confirm() {
    const binding = recording.keypress().binding
    if (binding !== null && !recording.held() && !duplicate()) {
      props.onValueChange([...props.value, binding])
      finish()
    }
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      return
    }

    // Keep recorder keystrokes in this layer, including when the action buttons have focus.
    event.stopPropagation()
    if (event.target !== target || event.isComposing) {
      return
    }

    // After staging a chord, Tab can reach the actions. An empty recorder can still bind Tab.
    if (
      event.key === 'Tab' &&
      recording.keypress().binding !== null &&
      !recording.held() &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      return
    }

    event.preventDefault()
    recording.press(event)
  }

  createPopup({
    element: () => panel,
    anchor: trigger,
    open,
    change: setOpen,
    placement: () => 'bottom-end',
  })
  closeWhenUnavailable(() => trigger()!, close)
  onFormReset(() => trigger()!, close)

  createEffect(() => {
    if (open()) {
      const window = panel.ownerDocument.defaultView!
      window.addEventListener('blur', close)
      onCleanup(() => window.removeEventListener('blur', close))
    }
  })

  return (
    <InputFrame class={classes(styles.root, props.class)} size={props.size} open={open()}>
      <div class={styles.value}>
        <Show
          when={props.value.length}
          fallback={
            <span class={styles.hint} aria-hidden="true">
              {props.emptyLabel}
            </span>
          }
        >
          <SelectedChips
            values={props.value}
            label={label}
            disabled={disabled() || open()}
            field={() => trigger()!.parentElement!}
            removeLabel={props.removeLabel}
            scrollPreviousLabel={props.scrollPreviousLabel}
            scrollNextLabel={props.scrollNextLabel}
            onRemove={(binding) =>
              props.onValueChange(props.value.filter((value) => value !== binding))
            }
            focusTrigger={() => trigger()?.focus({ preventScroll: true })}
          />
        </Show>
        <span id={valueId} hidden>
          {props.value.map(label).join(', ') || props.emptyLabel}
        </span>
      </div>
      <button
        ref={bindTrigger}
        id={attributes.id}
        data-focus-anchor
        type="button"
        class={classes(frame.end, styles.trigger)}
        aria-label={props.label}
        aria-describedby={[attributes['aria-describedby'], valueId].filter(Boolean).join(' ')}
        aria-invalid={attributes['aria-invalid']}
        aria-haspopup="dialog"
        aria-controls={id}
        aria-expanded={open()}
        popovertarget={id}
        disabled={disabled()}
        onClick={(event) => {
          event.preventDefault()
          toggle()
        }}
      >
        <Icon icon={Keyboard} />
      </button>

      <div
        ref={(element) => {
          panel = element
        }}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={props.label}
        class={classes(popup.anchor, styles.panel)}
        on:keydown={keydown}
        on:keyup={(event) => {
          if (recording.held()) {
            event.preventDefault()
            event.stopPropagation()
            recording.release(event)
          }
        }}
        onFocusOut={(event) => {
          if (
            event.relatedTarget !== trigger() &&
            !panel.contains(event.relatedTarget as Node | null)
          ) {
            close()
          }
        }}
      >
        <div class={classes(popup.viewport, styles.content)}>
          <div
            ref={(element) => {
              target = element
            }}
            class={styles.preview}
            tabIndex={0}
            autofocus
            aria-label={props.recordingLabel}
          >
            <div role="status" class={styles.keys}>
              <Show when={recording.keypress().keys.length} fallback={props.recordingLabel}>
                <For each={recording.keypress().keys}>{(key) => <kbd>{key}</kbd>}</For>
              </Show>
            </div>
            <Show when={duplicate()}>
              <span role="status" class={styles.duplicate}>
                {props.duplicateLabel}
              </span>
            </Show>
          </div>
          <div class={styles.actions}>
            <Button
              class={styles.reset}
              variant="ghost"
              disabled={!recording.keypress().keys.length}
              onClick={reset}
            >
              {props.resetLabel}
            </Button>
            <Button variant="outline" onClick={finish}>
              {props.cancelLabel}
            </Button>
            <Button
              disabled={recording.held() || recording.keypress().binding === null || duplicate()}
              onClick={confirm}
            >
              {props.confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </InputFrame>
  )
}
