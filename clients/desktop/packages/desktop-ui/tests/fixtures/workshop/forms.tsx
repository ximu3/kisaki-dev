import { createMemo, createSignal } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Button } from '@kisaki3/desktop-ui/button'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
} from '@kisaki3/desktop-ui/field'
import { createForm, Form, FormFeedback, type FieldIssue } from '@kisaki3/desktop-ui/form'
import { ColorInput, DateInput, Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { Radio, RadioGroup } from '@kisaki3/desktop-ui/radio-group'
import { SegmentedControl } from '@kisaki3/desktop-ui/segmented-control'
import { MultiSelect, Select } from '@kisaki3/desktop-ui/select'
import { Slider } from '@kisaki3/desktop-ui/slider'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { Tab, TabList, TabPanel, Tabs } from '@kisaki3/desktop-ui/tabs'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import type {} from './api.js'
import { VirtualChoices } from './virtual.js'

export function Controls(): JSX.Element {
  const [external, setExternal] = createSignal('original')
  const [disabled, setDisabled] = createSignal(false)
  const [cancelReset, setCancelReset] = createSignal(false)
  const [controlStoredChoice, setControlStoredChoice] = createSignal(true)
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
        <RadioGroup
          label="Stored choice"
          name="stored"
          {...(controlStoredChoice() && { value: 'a' })}
          defaultValue="a"
        >
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
      <Button variant="text" onClick={() => setControlStoredChoice(false)}>
        Release stored choice
      </Button>
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
        <Button variant="text" onClick={() => setDisabled((value) => !value)}>
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

export function Validation(): JSX.Element {
  const [title, setTitle] = createSignal('')
  const [description, setDescription] = createSignal('')

  const [titleError, setTitleError] = createSignal('Enter a title.')
  const [tab, setTab] = createSignal('basic')

  window.fixture.setLongMessage = (language) =>
    setTitleError(
      `${language}: ${'请填写可辨认的名称。請填寫可辨認的名稱。判別できる名前を入力してください。 Provide a recognizable title. '.repeat(8)}`,
    )

  function validate(): FieldIssue[] {
    return [
      ...(!title() ? [{ id: 'title', summary: 'Enter a title.', message: titleError() }] : []),
      ...(!description() ? [{ id: 'description', summary: 'Enter a description.' }] : []),
    ]
  }

  const locate = (id: string) => {
    setTab(id === 'title' ? 'basic' : 'long detail')
    // The selected field only exists after its tab renders.
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
            <Tab value="long detail">Detail</Tab>
          </TabList>
          <TabPanel value="basic">
            <Field id="title" required>
              <div class="field-heading">
                <FieldLabel>Title</FieldLabel>
                <FieldDescription>A stable name for this sample.</FieldDescription>
              </div>
              <Input name="title" value={title()} onValueChange={setTitle} />
              <FieldError>{titleError()}</FieldError>
            </Field>
          </TabPanel>
          <TabPanel value="long detail">
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
