/** @fileoverview Compact visual specimens for action density, validation, focus and disabled states. */

import { For } from 'solid-js'
import { Button, type ButtonProps } from '@kisaki3/desktop-ui/button'
import { Field } from '@kisaki3/desktop-ui/field'
import { Input } from '@kisaki3/desktop-ui/input'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Dialog, DialogContent, DialogTitle } from '@kisaki3/desktop-ui/dialog'

const variants = [
  'default',
  'destructive',
  'outline',
  'secondary',
  'input',
  'ghost',
  'link',
  'text',
] as const
const sizes = [
  'xs',
  'sm',
  'default',
  'lg',
  'icon-xs',
  'icon-sm',
  'icon',
  'icon-lg',
] as const satisfies readonly ButtonProps['size'][]

/** Render the supported variants with the same host stylesheet used by the interactive form. */
export function States() {
  return (
    <>
      <h1>Control states</h1>
      <div class="samples">
        <For each={variants}>
          {(variant) => (
            <>
              <span>{variant}</span>
              <Button variant={variant}>Choose</Button>
              <Button variant={variant} disabled>
                Choose
              </Button>
            </>
          )}
        </For>
      </div>
      <section class="actions">
        <For each={sizes}>
          {(size) => (
            <Button size={size} aria-label={'Size ' + size} variant="outline">
              {size.startsWith('icon') ? '+' : size}
            </Button>
          )}
        </For>
      </section>
      <div class="fields">
        <Field label="Title" error="Enter a title">
          {(field) => <Input {...field} required defaultValue="" />}
        </Field>
        <label>
          <Switch checked disabled />
          Notifications
        </label>
        <label>
          <Checkbox indeterminate />
          Include selected titles
        </label>
      </div>
      <Dialog defaultOpen={location.hash === '#modal'}>
        <DialogContent>
          <DialogTitle>Collection</DialogTitle>
        </DialogContent>
      </Dialog>
    </>
  )
}
