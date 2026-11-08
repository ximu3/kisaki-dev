/** @fileoverview CSS color text and an alpha-capable picker share one controlled value. */

import { converter, formatHex, formatHex8, parse } from 'culori'
import type { Hsv } from 'culori'
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onMount,
  splitProps,
  untrack,
} from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, classes } from '../../../internal/dom'
import { fieldAttributes, closeWhenUnavailable } from '../../../internal/field'
import { createPopup } from '../../../internal/popup/controller'
import { createValue, onFormReset } from '../../../internal/state'
import { NativeInput } from '../native'
import { InputFrame } from '../frame'
import frame from '../styles.module.css'
import type { InputProps } from '../control'
import { RangeInput } from '../../../internal/range/control'
import popup from '../../../internal/popup/surface.module.css'
import styles from './styles.module.css'

/** Typed CSS color syntax is retained; picker gestures produce hex with alpha when needed. */
export interface ColorInputProps extends Omit<InputProps, 'type'> {
  pickerLabel: string
  hueLabel: string
  saturationLabel: string
  brightnessLabel: string
  alphaLabel: string
  invalidColorMessage: string
}

/** Text and picker edits share a form value. Invalid text stays available for correction. */
export function ColorInput(props: ColorInputProps): JSX.Element {
  const toHsv = converter('hsv')
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'pickerLabel',
    'hueLabel',
    'saturationLabel',
    'brightnessLabel',
    'alphaLabel',
    'invalidColorMessage',
    'ref',
    'class',
    'style',
  ])
  const field = fieldAttributes(props)
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )
  const parsed = createMemo(() => parse(value()))
  const [color, setColor] = createSignal<Hsv>({ mode: 'hsv', h: 0, s: 1, v: 1, alpha: 1 })
  const [open, setOpen] = createSignal(false)
  const id = createUniqueId()
  let input!: HTMLInputElement
  let trigger!: HTMLButtonElement
  let picker!: HTMLDivElement
  let hue!: HTMLInputElement
  const blocked = () => (props.disabled ?? field.disabled) || props.readOnly
  const swatch = () => (parsed() ? formatHex8(parsed()) : 'transparent')

  createEffect(() => {
    const next = toHsv(parsed())
    if (next) {
      setColor({ ...next, h: next.h ?? untrack(color).h ?? 0 })
    }
  })
  const commit = (next: Partial<Hsv>) => {
    const updated = { ...color(), ...next }
    setColor(updated)
    change((updated.alpha ?? 1) < 1 ? formatHex8(updated) : formatHex(updated))
  }
  const paint = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    const rect = event.currentTarget.getBoundingClientRect()
    commit({
      s: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      v: 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    })
  }

  createPopup({
    element: () => picker,
    anchor: () => trigger,
    open,
    change: setOpen,
    placement: () => 'bottom-start',
  })
  closeWhenUnavailable(
    () => input,
    () => setOpen(false),
  )
  onFormReset(
    () => input,
    () => setOpen(false),
  )
  onMount(() => {
    createEffect(() =>
      input.setCustomValidity(value() && !parsed() ? local.invalidColorMessage : ''),
    )
    createEffect(() => {
      if (open()) {
        queueMicrotask(() => {
          if (open()) {
            hue.focus()
          }
        })
      }
    })
  })

  return (
    <InputFrame class={local.class} style={local.style} open={open()}>
      <NativeInput
        {...rest}
        class={frame.editor}
        type="text"
        value={value()}
        defaultValue={local.defaultValue}
        onValueChange={change}
        ref={(node) => {
          input = node
          assignRef(local.ref, node)
        }}
      />
      <button
        ref={(node) => {
          trigger = node
        }}
        type="button"
        class={classes(frame.start, styles.swatch)}
        aria-label={local.pickerLabel}
        popovertarget={id}
        aria-haspopup="dialog"
        aria-controls={id}
        aria-expanded={open()}
        disabled={blocked()}
        onClick={(event) => {
          event.preventDefault()
          setOpen(!open())
        }}
      >
        <span style={{ background: swatch() }} />
      </button>
      <div
        ref={(node) => {
          picker = node
        }}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={local.pickerLabel}
        class={classes(popup.anchor, styles.picker)}
        onFocusOut={(event) => {
          if (
            !picker.contains(event.relatedTarget as Node | null) &&
            event.relatedTarget !== trigger
          ) {
            setOpen(false)
          }
        }}
      >
        <div class={classes(popup.viewport, styles.content)}>
          <div
            aria-hidden="true"
            class={styles.plane}
            style={{ '--color-hue': `hsl(${color().h ?? 0} 100% 50%)` }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              paint(event)
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                paint(event)
              }
            }}
          >
            <span
              class={styles.cursor}
              style={{ left: `${color().s * 100}%`, top: `${(1 - color().v) * 100}%` }}
            />
          </div>
          <label class={styles.channel}>
            <span>{local.hueLabel}</span>
            <RangeInput
              min={0}
              ref={(node) => {
                hue = node
              }}
              max={360}
              value={color().h ?? 0}
              onValueChange={(h) => commit({ h })}
            />
            <output>{Math.round(color().h ?? 0)}°</output>
          </label>
          <label class={styles.channel}>
            <span>{local.saturationLabel}</span>
            <RangeInput
              min={0}
              value={color().s * 100}
              onValueChange={(value) => commit({ s: value / 100 })}
            />
            <output>{Math.round(color().s * 100)}%</output>
          </label>
          <label class={styles.channel}>
            <span>{local.brightnessLabel}</span>
            <RangeInput
              min={0}
              value={color().v * 100}
              onValueChange={(value) => commit({ v: value / 100 })}
            />
            <output>{Math.round(color().v * 100)}%</output>
          </label>
          <label class={styles.channel}>
            <span>{local.alphaLabel}</span>
            <RangeInput
              min={0}
              value={(color().alpha ?? 1) * 100}
              onValueChange={(value) => commit({ alpha: value / 100 })}
            />
            <output>{Math.round((color().alpha ?? 1) * 100)}%</output>
          </label>
        </div>
      </div>
    </InputFrame>
  )
}
