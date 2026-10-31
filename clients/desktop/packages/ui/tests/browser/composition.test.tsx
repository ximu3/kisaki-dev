/** @fileoverview Exercises the UI package's form, collection and feedback composition in Chromium. */

import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { createSignal, Show, type JSX } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Button,
  Checkbox,
  CheckboxInput,
  CheckboxControl,
  CheckboxIndicator,
  CheckboxLabel,
  Switch,
  SwitchInput,
  SwitchControl,
  SwitchThumb,
  SwitchLabel,
  RadioGroup,
  RadioGroupLabel,
  RadioGroupItem,
  RadioGroupItemInput,
  RadioGroupItemControl,
  RadioGroupItemIndicator,
  RadioGroupItemLabel,
  Select,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectContent,
  SelectListbox,
  SelectItem,
  SelectItemLabel,
  SelectItemIndicator,
  SelectHiddenSelect,
  Combobox,
  ComboboxLabel,
  ComboboxControl,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxIcon,
  ComboboxContent,
  ComboboxListbox,
  ComboboxItem,
  ComboboxItemLabel,
  ComboboxHiddenSelect,
  Slider,
  SliderLabel,
  SliderTrack,
  SliderFill,
  SliderThumb,
  SliderInput,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogClose,
  ToastRegion,
  ToastList,
  Toast,
  ToastTitle,
  ToastClose,
  toaster,
} from '../../src/index'
import '@kisaki3/appearance/styles.css'
import '@kisaki3/ui/styles.css'

let dispose: (() => void) | undefined
let root: HTMLDivElement | undefined

afterEach(() => {
  dispose?.()
  root?.remove()
  toaster.clear()
})

/** Bind the test view and all descendant resources to one disposable owner. */
function mount(view: () => JSX.Element): void {
  root = document.createElement('div')
  document.body.append(root)
  dispose = render(view, root)
}

test('choice wrappers retain native form values, keyboard focus and reset', async () => {
  let form: HTMLFormElement | undefined

  mount(() => (
    <form
      ref={(element) => {
        form = element
      }}
    >
      <Checkbox name="enabled" defaultChecked>
        <CheckboxInput />
        <CheckboxControl>
          <CheckboxIndicator />
        </CheckboxControl>
        <CheckboxLabel>Enabled</CheckboxLabel>
      </Checkbox>
      <Switch name="notifications" defaultChecked>
        <SwitchInput />
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel>Notifications</SwitchLabel>
      </Switch>
      <RadioGroup name="theme" defaultValue="light">
        <RadioGroupLabel>Theme</RadioGroupLabel>
        <RadioGroupItem value="light">
          <RadioGroupItemInput />
          <RadioGroupItemControl>
            <RadioGroupItemIndicator />
          </RadioGroupItemControl>
          <RadioGroupItemLabel>Light</RadioGroupItemLabel>
        </RadioGroupItem>
        <RadioGroupItem value="dark">
          <RadioGroupItemInput />
          <RadioGroupItemControl>
            <RadioGroupItemIndicator />
          </RadioGroupItemControl>
          <RadioGroupItemLabel>Dark</RadioGroupItemLabel>
        </RadioGroupItem>
      </RadioGroup>
      <Button type="reset">Reset choices</Button>
    </form>
  ))

  await userEvent.tab()
  await expect.element(page.getByRole('checkbox', { name: 'Enabled' })).toHaveFocus()
  await userEvent.keyboard(' ')
  await page.getByText('Notifications', { exact: true }).click()
  await page.getByText('Dark', { exact: true }).click()
  expect(Object.fromEntries(new FormData(form))).toEqual({ theme: 'dark' })

  await page.getByRole('button', { name: 'Reset choices' }).click()
  await expect.element(page.getByRole('checkbox', { name: 'Enabled' })).toBeChecked()
  await expect.element(page.getByRole('switch', { name: 'Notifications' })).toBeChecked()
  await expect.element(page.getByRole('radio', { name: 'Light' })).toBeChecked()
  expect(Object.fromEntries(new FormData(form))).toEqual({
    enabled: 'on',
    notifications: 'on',
    theme: 'light',
  })
})

test('select and combobox expose typed choices, native values and portaled focus', async () => {
  let form: HTMLFormElement | undefined
  const [options, setOptions] = createSignal(['Alpha', 'Beta'])

  mount(() => (
    <form
      ref={(element) => {
        form = element
      }}
    >
      <Select
        name="choice"
        defaultValue="Alpha"
        options={options()}
        itemComponent={(props) => (
          <SelectItem item={props.item}>
            <SelectItemLabel>{props.item.rawValue}</SelectItemLabel>
            <SelectItemIndicator />
          </SelectItem>
        )}
      >
        <SelectLabel>Choice</SelectLabel>
        <SelectHiddenSelect />
        <SelectTrigger>
          <SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
          <SelectIcon />
        </SelectTrigger>
        <SelectContent>
          <SelectListbox />
        </SelectContent>
      </Select>
      <Combobox
        name="search"
        options={options()}
        itemComponent={(props) => (
          <ComboboxItem item={props.item}>
            <ComboboxItemLabel>{props.item.rawValue}</ComboboxItemLabel>
          </ComboboxItem>
        )}
      >
        <ComboboxLabel>Search</ComboboxLabel>
        <ComboboxHiddenSelect />
        <ComboboxControl>
          <ComboboxInput />
          <ComboboxTrigger aria-label="Show choices">
            <ComboboxIcon />
          </ComboboxTrigger>
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxListbox />
        </ComboboxContent>
      </Combobox>
    </form>
  ))

  const trigger = page.getByRole('button', { name: /^Choice / })
  await trigger.click()
  await page.getByRole('option', { name: 'Beta' }).click()
  await expect.element(trigger).toHaveFocus()
  expect(new FormData(form).get('choice')).toBe('Beta')

  setOptions(['Alpha', 'Beta', 'Gamma'])
  const search = page.getByRole('combobox', { name: 'Search' })
  await search.fill('Gam')
  await expect.element(page.getByRole('option', { name: 'Gamma' })).toBeVisible()
  await userEvent.keyboard('{ArrowDown}{Enter}')
  await expect.element(search).toHaveValue('Gamma')
  expect(new FormData(form).get('search')).toBe('Gamma')
  expect(root?.querySelector('[role="listbox"]')).toBeNull()
})

test('slider styling keeps the thumb, keyboard values and hidden input together', async () => {
  let value = 25
  let form: HTMLFormElement | undefined

  mount(() => (
    <form
      ref={(element) => {
        form = element
      }}
      style={{ width: '240px' }}
    >
      <Slider
        name="volume"
        defaultValue={[25]}
        onChange={(values) => {
          value = values[0]!
        }}
      >
        <SliderLabel>Volume</SliderLabel>
        <SliderTrack>
          <SliderFill />
          <SliderThumb>
            <SliderInput />
          </SliderThumb>
        </SliderTrack>
      </Slider>
    </form>
  ))

  await userEvent.tab()
  await expect.element(page.getByRole('slider', { name: 'Volume' })).toHaveFocus()
  await userEvent.keyboard('{ArrowRight}')
  expect(value).toBe(26)
  expect(new FormData(form).get('volume')).toBe('26')
})

test('menu actions and alert-dialog cancellation restore trigger focus', async () => {
  let selected = 0

  mount(() => (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={() => {
              selected++
            }}
          >
            Choose
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog>
        <AlertDialogTrigger>Confirm</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Confirmation</AlertDialogTitle>
          <AlertDialogClose>Cancel</AlertDialogClose>
        </AlertDialogContent>
      </AlertDialog>
    </>
  ))

  const menu = page.getByRole('button', { name: 'Actions' })
  await menu.click()
  await userEvent.keyboard('{ArrowDown}{Enter}')
  expect(selected).toBe(1)
  await expect.element(menu).toHaveFocus()
  const confirm = page.getByRole('button', { name: 'Confirm' })
  await confirm.click()
  await expect.element(page.getByRole('alertdialog', { name: 'Confirmation' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect.element(confirm).toHaveFocus()
})

test('toast actions use visible names and the region is removed with its owner', async () => {
  const [mounted, setMounted] = createSignal(true)
  mount(() => (
    <Show when={mounted()}>
      <ToastRegion duration={0} aria-label="Notifications">
        <ToastList />
      </ToastRegion>
    </Show>
  ))

  toaster.show((props) => (
    <Toast toastId={props.toastId}>
      <ToastTitle>Saved</ToastTitle>
      <ToastClose>Dismiss</ToastClose>
    </Toast>
  ))
  await expect.element(page.getByText('Saved')).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect.element(page.getByText('Saved')).not.toBeInTheDocument()
  setMounted(false)
  await expect.element(page.getByRole('region', { name: 'Notifications' })).not.toBeInTheDocument()
})
