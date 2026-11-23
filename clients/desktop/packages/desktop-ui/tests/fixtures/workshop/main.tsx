/** @fileoverview Independent component workshop covers native controls, feedback and nested interactions. */

import { createMemo, createSignal, lazy, Loading, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Info } from '@lucide/solid'
import { render } from '@solidjs/web'
import { Button } from '@kisaki3/desktop-ui/button'
import { Link } from '@kisaki3/desktop-ui/link'
import { List, ListItem } from '@kisaki3/desktop-ui/list'
import { Badge } from '@kisaki3/desktop-ui/badge'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Separator } from '@kisaki3/desktop-ui/separator'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import { Progress } from '@kisaki3/desktop-ui/progress'
import { Image } from '@kisaki3/desktop-ui/image'
import { EmptyState } from '@kisaki3/desktop-ui/empty-state'
import { Input, NumberInput, DateInput, ColorInput } from '@kisaki3/desktop-ui/input'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { Slider } from '@kisaki3/desktop-ui/slider'
import { Select, MultiSelect } from '@kisaki3/desktop-ui/select'
import { RadioGroup, Radio } from '@kisaki3/desktop-ui/radio-group'
import { SegmentedControl } from '@kisaki3/desktop-ui/segmented-control'
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
} from '@kisaki3/desktop-ui/field'
import { createForm, Form, FormFeedback, type FieldIssue } from '@kisaki3/desktop-ui/form'
import { Tabs, TabList, Tab, TabPanel } from '@kisaki3/desktop-ui/tabs'
import { Collapsible } from '@kisaki3/desktop-ui/collapsible'
import { ScrollArea } from '@kisaki3/desktop-ui/scroll-area'
import {
  ScrollableTable,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableSpacer,
} from '@kisaki3/desktop-ui/table'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogClose,
  DialogBody,
  DialogFooter,
  AlertDialogContent,
} from '@kisaki3/desktop-ui/dialog'
import { Popover, PopoverTrigger, PopoverContent } from '@kisaki3/desktop-ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@kisaki3/desktop-ui/tooltip'
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuSubTrigger,
  ContextMenuTrigger,
  MenuCheckboxItem,
  MenuRadioItem,
  MenuGroup,
  MenuSeparator,
} from '@kisaki3/desktop-ui/menu'
import { Combobox } from '@kisaki3/desktop-ui/combobox'
import { Toaster, toast } from '@kisaki3/desktop-ui/toast'
import type { ToastHandle } from '@kisaki3/desktop-ui/toast'
import type { FixtureApi } from './api.js'
import { VirtualChoices } from './virtual.js'
import '@kisaki3/desktop-ui/styles.css'
import './page.css'

/** Deferred rich-content showcase that keeps heavy adapters outside the initial consumer view. */
const Resources = lazy(() => import('./resources.js'))

/** Provides an inert test hook until its fixture owner installs an active implementation. */
const noop = () => {}
window.fixture = {
  setExternal: noop,
  setOptions: noop,
  setOwner: noop,
  showLoading: noop,
  updateToast: noop,
  dismissToast: noop,
  rootToast: noop,
  setLongMessage: noop,
  replaceMenuTrigger: noop,
  dispose: noop,
} satisfies FixtureApi

/**
 * Publishes synthetic loading messages and exposes retained handles for publisher-lifetime checks.
 */
function ToastOwner(): JSX.Element {
  let handle: ToastHandle | undefined

  /** Creates the fixture's loading message and retains its update and dismissal handle. */
  window.fixture.showLoading = (persistent) => {
    handle = toast.show(
      {
        type: 'loading',
        message: 'Preparing sample',
        action: {
          label: 'Inspect sample',

          /** Records execution of the synthetic fixture action without navigating away. */
          onClick: () => {
            document.body.dataset.action = 'inspected'
          },
        },
      },
      { persistent },
    )
  }
  /** Changes the retained message to the synthetic ready result. */
  window.fixture.updateToast = () => handle?.update({ type: 'success', message: 'Sample ready' })
  /** Dismisses the retained fixture message when its handle exists. */
  window.fixture.dismissToast = () => handle?.dismiss()

  return (
    <Button variant="secondary" onClick={() => window.fixture.showLoading(false)}>
      Show loading
    </Button>
  )
}

/**
 * Exercises native form, reset and controlled-value behavior across the packed control families.
 */
function Controls(): JSX.Element {
  /** Caller-owned form value used to verify controlled updates and reset behavior. */
  const [external, setExternal] = createSignal('original')
  /** Reactive disabled state applied across the synthetic native form controls. */
  const [disabled, setDisabled] = createSignal(false)
  /** Whether the synthetic form prevents its next native reset. */
  const [cancelReset, setCancelReset] = createSignal(false)
  window.fixture.setExternal = setExternal

  return (
    <section>
      <h2>Native controls</h2>
      <VirtualChoices />
      <form id="special-fields">
        <NumberInput
          aria-label="Quantity"
          name="quantity"
          unit="px"
          defaultValue="2"
          min="0"
          max="5"
          increaseLabel="Increase"
          decreaseLabel="Decrease"
        />
        <DateInput
          yearLabel="Year"
          monthLabel="Month"
          aria-label="Calendar date"
          name="date"
          defaultValue="2024-02-28"
          min="2024-02-01"
          max="2024-03-31"
          locale="en-US"
          calendarLabel="Choose date"
          previousMonthLabel="Previous month"
          nextMonthLabel="Next month"
          invalidDateMessage="Enter a valid date in range."
        />
        <ColorInput
          aria-label="Color value"
          name="color"
          defaultValue="#336699"
          pickerLabel="Choose color"
          hueLabel="Hue"
          saturationLabel="Saturation"
          brightnessLabel="Brightness"
          alphaLabel="Alpha"
          invalidColorMessage="Enter a CSS color."
        />
        <Button type="reset" variant="outline">
          Reset special fields
        </Button>
      </form>
      <form
        id="controls"
        onSubmit={(event) => {
          event.preventDefault()
          document.body.dataset.submitted = JSON.stringify([...new FormData(event.currentTarget)])
        }}
        onReset={(event) => {
          if (cancelReset()) {
            event.preventDefault()
          }
        }}
      >
        <FieldGroup disabled={disabled()}>
          <FieldLegend>Preferences</FieldLegend>
          <Field id="query">
            <div class="field-heading">
              <FieldLabel>Query</FieldLabel>
              <FieldDescription>Native text, selection and undo.</FieldDescription>
            </div>
            <Input name="query" defaultValue="seed" size="sm" htmlSize={18} />
          </Field>
          <Field id="notes">
            <FieldLabel>Notes</FieldLabel>
            <Textarea name="notes" defaultValue="A short note" />
          </Field>
          <div class="row">
            <Checkbox name="check" value="yes" defaultChecked label="Include" />
            <Switch name="switch" value="enabled" defaultChecked label="Enabled" />
          </div>
          <RadioGroup label="Density" name="density" defaultValue="comfortable">
            <Radio value="compact" label="Compact" />
            <Radio value="comfortable" label="Comfortable" />
          </RadioGroup>
          <Field id="select">
            <FieldLabel>Choice</FieldLabel>
            <Select
              name="choice"
              defaultValue="alpha"
              required
              options={[
                { value: '', label: 'Choose' },
                { value: 'alpha', label: 'Alpha' },
                { value: 'disabled', label: 'Unavailable', disabled: true },
                { value: 'beta', label: 'Beta' },
              ]}
              emptyMessage="No choices"
              invalidSelectionMessage="Choose an available option."
            />
          </Field>
          <Field id="multi">
            <FieldLabel>Multiple choices</FieldLabel>
            <MultiSelect
              removeLabel={(label) => `Remove ${label}`}
              scrollPreviousLabel="Previous selected items"
              scrollNextLabel="Next selected items"
              name="multi"
              defaultValue={['a', 'c']}
              options={[
                { value: 'a', label: 'Amber' },
                { value: 'b', label: 'Blue' },
                { value: 'c', label: 'Coral' },
              ]}
              emptyMessage="No choices"
              invalidSelectionMessage="Choose an available option."
            />
          </Field>
          <Field id="level">
            <FieldLabel>Level</FieldLabel>
            <Slider name="level" defaultValue={25} min={0} max={100} />
          </Field>
          <SegmentedControl
            label="View"
            name="view"
            defaultValue="list"
            options={[
              { value: 'list', label: 'List' },
              { value: 'grid', label: 'Grid' },
              { value: 'disabled', label: 'Unavailable', disabled: true },
            ]}
          />
        </FieldGroup>
        <div class="row">
          <Button type="submit">Submit controls</Button>
          <Button type="reset" variant="outline">
            Reset controls
          </Button>
        </div>
      </form>
      <form id="fixed-choices">
        <RadioGroup label="Stored choice" name="stored" value="a">
          <Radio value="a" label="First stored" />
          <Radio value="b" label="Second stored" />
        </RadioGroup>
        <SegmentedControl
          label="Stored view"
          name="view"
          value="first"
          options={[
            { value: 'first', label: 'First view' },
            { value: 'second', label: 'Second view' },
          ]}
        />
      </form>
      <Field id="external">
        <FieldLabel>External controlled field</FieldLabel>
        <Input
          name="external"
          form="controls"
          value={external()}
          defaultValue="original"
          onValueChange={setExternal}
        />
      </Field>
      <div class="row">
        <Button variant="text" onClick={() => setDisabled(!disabled())}>
          Toggle fieldset
        </Button>
        <label>
          <input
            type="checkbox"
            checked={cancelReset()}
            onChange={(event) => setCancelReset(event.currentTarget.checked)}
          />
          Cancel resets
        </label>
      </div>
    </section>
  )
}

/** Owns synthetic form validation and field-reveal policy for feedback component acceptance. */
function Validation(): JSX.Element {
  /** Draft title edited by the synthetic field-feedback form. */
  const [title, setTitle] = createSignal('')
  /** Draft description edited by the synthetic field-feedback form. */
  const [description, setDescription] = createSignal('')

  /** Editable error detail used to exercise clipping and complete tooltip feedback. */
  const [long, setLong] = createSignal('Enter a title.')
  /** Current fixture tab used to verify retained form drafts and focus transitions. */
  const [tab, setTab] = createSignal('basic')

  /**
   * Replaces field detail with a long multilingual sample carrying the requested language prefix.
   */
  window.fixture.setLongMessage = (language) =>
    setLong(
      `${language}: ${'请填写可辨认的名称。請填寫可辨認的名稱。判別できる名前を入力してください。 Provide a recognizable title. '.repeat(8)}`,
    )

  function validate(): FieldIssue[] {
    return [
      ...(!title() ? [{ id: 'title', summary: 'Enter a title.', message: long() }] : []),
      ...(!description() ? [{ id: 'description', summary: 'Enter a description.' }] : []),
    ]
  }

  /** Reveals the requested field's tab and focuses the field after the view updates. */
  const locate = (id: string) => {
    setTab(id === 'title' ? 'basic' : 'detail')
    queueMicrotask(() => document.getElementById(id)?.focus())
  }

  const [sample, selectSample] = createSignal('original')
  const form = createMemo(() => {
    const id = sample()
    return createForm({
      validate,
      locate,
      onSubmit: (submitter) => window.fixture.commitSample?.(submitter, id),
    })
  })
  window.fixture.selectSample = selectSample
  window.fixture.submitSample = () => form().submit()

  return (
    <section>
      <h2>Form feedback</h2>
      <Form state={form()}>
        <Tabs value={tab()} onValueChange={setTab}>
          <TabList aria-label="Fields">
            <Tab value="basic">Basic</Tab>
            <Tab value="detail">Detail</Tab>
          </TabList>
          <TabPanel value="basic">
            <Field id="title" required>
              <div class="field-heading">
                <FieldLabel>Title</FieldLabel>
                <FieldDescription>A stable name for this sample.</FieldDescription>
              </div>
              <Input name="title" value={title()} onValueChange={setTitle} />
              <FieldError>{long()}</FieldError>
            </Field>
          </TabPanel>
          <TabPanel value="detail">
            <Field id="description" required>
              <FieldLabel>Description</FieldLabel>
              <Textarea value={description()} onValueChange={setDescription} />
              <FieldError>Enter a description.</FieldError>
            </Field>
          </TabPanel>
        </Tabs>
        <FormFeedback
          id="feedback"
          summary={(count) =>
            count === 1 ? '1 field needs attention' : `${count} fields need attention`
          }
        />
        <Button type="submit">Save sample</Button>
      </Form>
    </section>
  )
}

/**
 * Exercises searchable choices whose committed records survive replacement of the candidate list.
 */
function Candidate(): JSX.Element {
  /** Reactive option catalog used to verify selection changes and disabled entries. */
  const [options, setOptions] = createSignal([
    { value: 'a', label: 'Alpha' },
    { value: 'd', label: 'Disabled', disabled: true },
    { value: 'b', label: 'Beta' },
  ])
  /** Replaces candidates with new and disabled records for selection-retention checks. */
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

/** Exercises native modal nesting, menus and local popup focus and close behavior. */
function Interactions(): JSX.Element {
  /** Caller-owned boolean value shared by the fixture's checkable controls. */
  const [checked, setChecked] = createSignal(false)
  /** Caller-owned radio selection used to verify native grouping behavior. */
  const [radio, setRadio] = createSignal('one')
  /** Fixture switch controlling whether a requested interaction is prevented. */
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
            <Info />
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

/**
 * Composes the synthetic component workshop and controls optional publisher and capability
 * lifetimes.
 */
function App(): JSX.Element {
  const [expanded, setExpanded] = createSignal(false)
  window.fixture.requestDisclosure = setExpanded

  /** Whether the synthetic feedback-owning component remains mounted. */
  const [owner, setOwner] = createSignal(true)
  /** Whether the independently loaded rich-resource showcase is displayed. */
  const [resources, setResources] = createSignal(false)

  window.fixture.setOwner = setOwner
  /**
   * Publishes a persistent root-owned message independent of the disposable publisher component.
   */
  window.fixture.rootToast = () =>
    toast.show({ type: 'info', message: 'Window owner survives' }, { persistent: true })

  return (
    <main>
      <header>
        <span class="eyebrow">KISAKI · SOLID 2</span>
        <h1>Component workshop</h1>
        <p>Independent controls, shared appearance, native interaction.</p>
        <div class="row">
          <Button
            id="theme"
            variant="outline"
            onClick={() => {
              document.documentElement.dataset.colorScheme =
                document.documentElement.dataset.colorScheme === 'dark' ? 'light' : 'dark'
            }}
          >
            Switch theme
          </Button>
          <Link href="#gallery">Browse components</Link>
        </div>
      </header>
      <div class="grid">
        <Controls />
        <Validation />
        <Interactions />
        <section id="gallery">
          <h2>Presentation</h2>
          <div class="row">
            <Button>Primary</Button>
            <Button variant="destructive">Danger</Button>
            <Button variant="outline" class="host-override">
              Override
            </Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled>Disabled</Button>
            <Button busy>Saving</Button>
          </div>
          <div class="row">
            <Badge>Ready</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Spinner label="Loading" />
          </div>
          <Progress value={0.65} aria-label="Progress" />
          <Alert tone="info">The sample preserves ordinary document behavior.</Alert>
          <Separator />
          <Collapsible
            summary="More information"
            open={expanded()}
            onOpenChange={(open) => window.fixture.requestDisclosure?.(open)}
          >
            <p>Native disclosure content.</p>
          </Collapsible>
          <ScrollArea aria-label="Sample table">
            <Table>
              <TableCaption>Synthetic rows</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Name</TableHead>
                  <TableHead scope="col">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Sample A</TableCell>
                  <TableCell>Ready</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>
          <ScrollableTable
            aria-label="Scrollable sample table"
            aria-rowcount={28}
            columns="minmax(0, 1fr) 8rem"
            minWidth="42rem"
            style={{ height: '9rem' }}
            header={
              <TableRow>
                <TableHead scope="col">Name</TableHead>
                <TableHead scope="col">
                  <Button variant="text">Sort by status</Button>
                </TableHead>
              </TableRow>
            }
          >
            <TableRow aria-rowindex={2}>
              <TableHead scope="row">First sample</TableHead>
              <TableCell>Ready</TableCell>
            </TableRow>
            <TableSpacer height={800} />
            <TableRow aria-rowindex={28}>
              <TableHead scope="row">Last sample</TableHead>
              <TableCell>Ready</TableCell>
            </TableRow>
          </ScrollableTable>
          <List>
            <ListItem title="Sample item" description="Read-only entry" icon={<Info />} />
          </List>
          <Image alt="Unavailable sample" src="/missing.png" />
          <EmptyState
            heading="No additional samples"
            description="Add an item when one is available."
          />
        </section>
        <section>
          <h2>Feedback lifetime</h2>
          <Show when={owner()}>
            <ToastOwner />
          </Show>
          <Button variant="text" onClick={() => setOwner(!owner())}>
            Toggle owner
          </Button>
        </section>
        <section class="wide">
          <h2>Complete capabilities</h2>
          <Button onClick={() => setResources(!resources())}>
            {resources() ? 'Release resources' : 'Load resources'}
          </Button>
          <Show when={resources()}>
            <Loading>
              <Resources />
            </Loading>
          </Show>
        </section>
      </div>
    </main>
  )
}

window.fixture.dispose = render(
  () => (
    <>
      <Toaster regionLabel="Window notifications" closeLabel="Dismiss notification" />
      <App />
    </>
  ),
  document.getElementById('app')!,
)
