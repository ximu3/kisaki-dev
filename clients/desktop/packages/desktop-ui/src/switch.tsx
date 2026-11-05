/** @fileoverview Binary switch with native checkbox keyboard and form behavior. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Checkbox, type CheckboxProps } from './checkbox'

/** Label this switch by its setting. The checked state is announced separately. */
export function Switch(props: Omit<CheckboxProps, 'indeterminate' | 'role'>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <Checkbox
      {...rest}
      role="switch"
      class={twMerge(
        'ks-box relative h-4 w-7 cursor-pointer appearance-none rounded-full border border-border bg-muted before:absolute before:inset-y-px before:left-px before:aspect-square before:rounded-full before:bg-muted-foreground checked:bg-primary checked:before:right-px checked:before:left-auto checked:before:bg-primary-foreground forced-colors:appearance-auto',
        local.class,
      )}
    />
  )
}
