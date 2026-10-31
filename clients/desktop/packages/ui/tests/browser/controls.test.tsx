/** @fileoverview Verifies native form composition, reactive styling and controlled dismissal through the public UI parts. */

import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { createSignal, Show, type JSX } from 'solid-js'
import { render } from 'solid-js/web'
import { Button } from '../../src/components/button'
import { Field, FieldContent, Fieldset, FieldLegend } from '../../src/components/field'
import {
  TextField,
  TextFieldLabel,
  TextFieldInput,
  TextFieldTextArea,
  TextFieldDescription,
  TextFieldErrorMessage,
} from '../../src/components/text-field'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '../../src/components/dialog'
import '@kisaki3/appearance/styles.css'
import '@kisaki3/ui/styles.css'

let dispose: (() => void) | undefined
let root: HTMLDivElement | undefined

afterEach(() => {
  dispose?.()
  root?.remove()
})

/** Give each test one real browser document owner and release all primitive descendants afterwards. */
function mount(view: () => JSX.Element): void {
  root = document.createElement('div')
  document.body.append(root)
  dispose = render(view, root)
}

test('button variants preserve native activation and react to caller attributes', async () => {
  const [disabled, setDisabled] = createSignal(false)
  const [customClass, setCustomClass] = createSignal('h-8')
  let activations = 0
  let submissions = 0
  let button: HTMLButtonElement | undefined

  mount(() => (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submissions++
      }}
    >
      <Button
        ref={(element) => {
          button = element
        }}
        size="sm"
        class={customClass()}
        disabled={disabled()}
        onClick={() => {
          activations++
        }}
      >
        Action
      </Button>
      <Button type="submit">Submit</Button>
    </form>
  ))

  const action = page.getByRole('button', { name: 'Action' })
  await userEvent.tab()
  await expect.element(action).toHaveFocus()
  await userEvent.keyboard('{Enter}')
  expect(activations).toBe(1)
  expect(submissions).toBe(0)
  expect(getComputedStyle(button!).height).toBe('32px')

  setCustomClass('h-5')
  await expect.poll(() => getComputedStyle(button!).height).toBe('20px')
  setDisabled(true)
  await expect.element(action).toBeDisabled()
  button!.click()
  expect(activations).toBe(1)

  await page.getByRole('button', { name: 'Submit' }).click()
  expect(submissions).toBe(1)
})

test('field layout preserves text ownership, accessible feedback and native form reset', async () => {
  let value = ''

  mount(() => (
    <form>
      <Fieldset>
        <FieldLegend>Profile</FieldLegend>
        <TextField
          as={Field}
          defaultValue="Initial"
          name="name"
          validationState="invalid"
          onChange={(next) => {
            value = next
          }}
        >
          <TextFieldLabel>Name</TextFieldLabel>
          <FieldContent>
            <TextFieldInput />
            <TextFieldDescription>A visible name.</TextFieldDescription>
            <TextFieldErrorMessage>Choose a different name.</TextFieldErrorMessage>
          </FieldContent>
        </TextField>
        <TextField defaultValue="First line" name="notes">
          <TextFieldLabel>Notes</TextFieldLabel>
          <TextFieldTextArea />
        </TextField>
        <Button type="reset">Reset</Button>
      </Fieldset>
    </form>
  ))

  const input = page.getByRole('textbox', { name: 'Name' })
  await expect.element(input).toHaveAttribute('aria-invalid', 'true')
  await expect
    .element(input)
    .toHaveAccessibleDescription('A visible name. Choose a different name.')
  await input.fill('Edited')
  expect(value).toBe('Edited')
  await page.getByRole('textbox', { name: 'Notes' }).fill('Changed notes')

  await page.getByRole('button', { name: 'Reset' }).click()
  await expect.element(input).toHaveValue('Initial')
  await expect.element(page.getByRole('textbox', { name: 'Notes' })).toHaveValue('First line')
})

test('controlled dialog dismissal can be prevented and disposal removes its portal', async () => {
  const [open, setOpen] = createSignal(false)
  const [mounted, setMounted] = createSignal(true)
  let preventClose = true

  mount(() => (
    <Show when={mounted()}>
      <Dialog open={open()} onOpenChange={setOpen}>
        <DialogTrigger variant="outline">Open</DialogTrigger>
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (preventClose) {
              event.preventDefault()
            }
          }}
        >
          <DialogTitle>Editor</DialogTitle>
          <DialogClose variant="secondary">Close</DialogClose>
        </DialogContent>
      </Dialog>
    </Show>
  ))

  const trigger = page.getByRole('button', { name: 'Open' })
  await trigger.click()
  await expect.element(page.getByRole('dialog', { name: 'Editor' })).toBeVisible()
  await userEvent.keyboard('{Escape}')
  expect(open()).toBe(true)

  preventClose = false
  await userEvent.keyboard('{Escape}')
  await expect.element(trigger).toHaveFocus()
  expect(open()).toBe(false)

  await trigger.click()
  await page.getByRole('button', { name: 'Close' }).click()
  expect(open()).toBe(false)
  await trigger.click()
  setMounted(false)
  await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
})
