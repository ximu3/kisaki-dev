/** @fileoverview Arranges arbitrary form controls without owning their values or accessible associations. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Visual form layout; responsive switches to a row when its container has sufficient room. */
export type FieldProps = JSX.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'vertical' | 'horizontal' | 'responsive'
}

const orientationClasses: Record<NonNullable<FieldProps['orientation']>, string> = {
  vertical: 'flex-col',
  horizontal: 'flex-row items-start',
  responsive: 'flex-col @sm:flex-row @sm:items-start',
}

/** Arrange a control's own label, content and description; the control retains all form semantics. */
export function Field(props: FieldProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'orientation'])

  return (
    <div
      {...rest}
      class={twMerge(
        'flex min-w-0 gap-2',
        orientationClasses[local.orientation ?? 'vertical'],
        local.class,
      )}
    />
  )
}

/** Group a field's control and supporting content beside its label. */
export function FieldContent(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <div {...rest} class={twMerge('flex min-w-0 flex-1 flex-col gap-1.5', local.class)} />
}

/** Group related controls using native form semantics, including inherited disabled state. */
export function Fieldset(props: JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <fieldset
      {...rest}
      class={twMerge('@container m-0 flex min-w-0 flex-col gap-4 border-0 p-0', local.class)}
    />
  )
}

/** Name a Fieldset; individual controls keep their own labels. */
export function FieldLegend(props: JSX.HTMLAttributes<HTMLLegendElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <legend
      {...rest}
      class={twMerge('mb-3 p-0 font-ui text-base font-medium text-foreground', local.class)}
    />
  )
}
