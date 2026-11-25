import { createSignal, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { mdiInformationOutline } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Button } from '@kisaki3/desktop-ui/button'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Combobox } from '@kisaki3/desktop-ui/combobox'
import {
  AlertDialogContent,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kisaki3/desktop-ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import {
  ContextMenuTrigger,
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuRadioItem,
  MenuSeparator,
  MenuSubTrigger,
  MenuTrigger,
} from '@kisaki3/desktop-ui/menu'
import { Popover, PopoverContent, PopoverTrigger } from '@kisaki3/desktop-ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@kisaki3/desktop-ui/tooltip'
import type {} from './api.js'
import { ToastOwner } from './toast-owner.js'

function Candidate(): JSX.Element {
  const [options, setOptions] = createSignal([
    { value: 'a', label: 'Alpha' },
    { value: 'd', label: 'Disabled', disabled: true },
    { value: 'b', label: 'Beta' },
  ])
  window.fixture.setOptions = () =>
    setOptions([
      { value: 'a', label: 'Already selected', disabled: true },
      { value: 'g', label: 'Gamma' },
      { value: 'z', label: 'Zeta' },
    ])

  return (
    <form id="candidate-form">
      <FieldGroup aria-label="Candidate group">
        <Field id="candidate">
          <FieldLabel>Candidate</FieldLabel>
          <Combobox
            name="candidate"
            searchLabel="Search candidates"
            clearSearchLabel="Clear search"
            options={options()}
            defaultValue={{ value: 'a', label: 'Alpha' }}
            emptyMessage="No choices"
            loadingMessage="Loading choices"
            invalidSelectionMessage="Choose a listed option."
          />
        </Field>
        <Field id="related">
          <FieldLabel>Related choices</FieldLabel>
          <Combobox
            multiple
            name="related"
            searchLabel="Search related choices"
            clearSearchLabel="Clear search"
            options={options()}
            defaultValue={[{ value: 'a', label: 'Alpha' }]}
            emptyMessage="No choices"
            loadingMessage="Loading choices"
            invalidSelectionMessage="Choose a listed option."
            removeLabel={(label) => 'Remove ' + label}
            scrollPreviousLabel="Previous choices"
            scrollNextLabel="Next choices"
          />
        </Field>
      </FieldGroup>
    </form>
  )
}

export function Interactions(): JSX.Element {
  const [checked, setChecked] = createSignal(false)
  const [radio, setRadio] = createSignal('one')
  const [block, setBlock] = createSignal(false)
  const [dialog, setDialog] = createSignal(false)
  const [help, setHelp] = createSignal(false)
  const [allowHelpClose, setAllowHelpClose] = createSignal(false)
  const [triggerPosition, setTriggerPosition] = createSignal<'near' | 'far'>('near')
  window.fixture.replaceMenuTrigger = setTriggerPosition

  return (
    <section>
      <h2>Interactions</h2>
      <div class="row">
        <Dialog
          open={dialog()}
          onOpenChange={(open) => {
            if (open || !block()) {
              setDialog(open)
            }
          }}
        >
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader closeLabel="Close editor">
              <DialogTitle>Edit sample</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Candidate />
              <Checkbox checked={block()} onCheckedChange={setBlock} label="Block close" />
              <Menu>
                <Show when={triggerPosition()} keyed>
                  {(position) => (
                    <MenuTrigger
                      variant="outline"
                      data-menu-trigger={position}
                      style={{ 'margin-inline-start': position === 'far' ? '8rem' : undefined }}
                    >
                      Actions
                    </MenuTrigger>
                  )}
                </Show>
                <MenuContent aria-label="Actions">
                  <MenuItem
                    onSelect={() => {
                      document.body.dataset.menu = 'first'
                    }}
                  >
                    First action
                  </MenuItem>
                  <MenuItem disabled>Disabled action</MenuItem>
                  <MenuCheckboxItem
                    checked={checked()}
                    onCheckedChange={setChecked}
                    closeOnSelect={false}
                  >
                    Pinned
                  </MenuCheckboxItem>
                  <MenuItem>Işık</MenuItem>
                  <MenuItem>𠮷野</MenuItem>
                  <MenuSeparator />
                  <MenuGroup aria-label="Mode">
                    <MenuRadioItem value="one" selectedValue={radio()} onValueChange={setRadio}>
                      One
                    </MenuRadioItem>
                    <MenuRadioItem value="two" selectedValue={radio()} onValueChange={setRadio}>
                      Two
                    </MenuRadioItem>
                  </MenuGroup>
                  <Menu>
                    <MenuSubTrigger>More</MenuSubTrigger>
                    <MenuContent aria-label="More">
                      <MenuItem>Nested action</MenuItem>
                    </MenuContent>
                  </Menu>
                </MenuContent>
              </Menu>
              <ToastOwner />
              <Dialog>
                <DialogTrigger>Nested dialog</DialogTrigger>
                <AlertDialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm sample</DialogTitle>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose>Return</DialogClose>
                  </DialogFooter>
                </AlertDialogContent>
              </Dialog>
            </DialogBody>
          </DialogContent>
        </Dialog>
        <Popover
          open={help()}
          onOpenChange={(open) => {
            if (open || allowHelpClose()) {
              setHelp(open)
            }
          }}
        >
          <PopoverTrigger variant="outline">Help</PopoverTrigger>
          <PopoverContent>
            <p>Contextual help remains inside the current document.</p>
            <Button>Help action</Button>
          </PopoverContent>
        </Popover>
        <Button onClick={() => setAllowHelpClose(true)}>Allow help dismissal</Button>
        <Tooltip>
          <TooltipTrigger variant="ghost" aria-label="Information">
            <Icon path={mdiInformationOutline} />
          </TooltipTrigger>
          <TooltipContent>
            Information about the sample. This text remains readable while hovered.
          </TooltipContent>
        </Tooltip>
      </div>
      <Menu>
        <ContextMenuTrigger id="context-target" class="context">
          Context menu target
        </ContextMenuTrigger>
        <MenuContent aria-label="Context actions">
          <MenuItem>Context action</MenuItem>
        </MenuContent>
      </Menu>
    </section>
  )
}
