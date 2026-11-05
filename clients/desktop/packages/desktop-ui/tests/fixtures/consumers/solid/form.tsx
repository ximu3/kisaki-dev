/** @fileoverview Host-owned drafts composed with native controls and an externally associated input. */

import { createSignal } from 'solid-js'
import { Field, FieldGroup } from '@kisaki3/desktop-ui/field'
import { Input } from '@kisaki3/desktop-ui/input'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { Select, type SelectOption } from '@kisaki3/desktop-ui/select'
import { Combobox } from '@kisaki3/desktop-ui/combobox'
import { RadioGroup } from '@kisaki3/desktop-ui/radio-group'
import { Slider } from '@kisaki3/desktop-ui/slider'
import { SegmentedControl } from '@kisaki3/desktop-ui/segmented-control'
import { Button } from '@kisaki3/desktop-ui/button'

const kinds = [
  { value: 'novel', label: 'Novel' },
  { value: 'comic', label: 'Comic' },
  { value: 'game', label: 'Game', disabled: true },
]
const shelf = { value: 's1', label: 'Favourites' }
export function LibraryForm() {
  const [title, setTitle] = createSignal('Blue Hour')
  const [locked, setLocked] = createSignal(false)
  const [medium, setMedium] = createSignal('novel')
  const [checked, setChecked] = createSignal(false)
  const [choices, setChoices] = createSignal<readonly SelectOption[]>([shelf])
  const [available, setAvailable] = createSignal(true)
  const [query, setQuery] = createSignal('')

  return (
    <section aria-label="Entry">
      <form id="entry" onSubmit={(e) => e.preventDefault()}>
        <FieldGroup legend="Entry details" disabled={locked()}>
          <div class="fields">
            <Field
              label="Title"
              description="The name used in your library."
              error={title().length ? undefined : 'Enter a title.'}
            >
              {(field) => (
                <Input
                  {...field}
                  name="title"
                  required
                  defaultValue="Blue Hour"
                  value={title()}
                  onValueChange={setTitle}
                />
              )}
            </Field>
            <Field label="Medium">
              {(field) => (
                <Select
                  {...field}
                  required
                  name="medium"
                  defaultValue="novel"
                  value={medium()}
                  onValueChange={setMedium}
                  options={available() ? kinds : kinds.slice(1)}
                />
              )}
            </Field>
            <Field label="Description">
              {(field) => <Textarea {...field} name="description" defaultValue="Evening reading" />}
            </Field>
            <Field label="Shelf">
              {(field) => (
                <Combobox
                  {...field}
                  name="shelf"
                  required
                  defaultValue={shelf}
                  options={choices()}
                  onQueryChange={(text) => {
                    setQuery(text)
                    setChoices(
                      [shelf, { value: 's2', label: 'Backlog' }].filter((item) =>
                        item.label.toLowerCase().includes(text.toLowerCase()),
                      ),
                    )
                  }}
                />
              )}
            </Field>
            <Field label="Formats">
              {(field) => (
                <Select
                  {...field}
                  multiple
                  name="formats"
                  defaultValue={['novel', 'comic']}
                  options={kinds}
                />
              )}
            </Field>
            <RadioGroup
              legend="Reading format"
              required
              name="format"
              options={kinds}
              defaultValue="comic"
            />
            <label>
              <Checkbox
                name="favourite"
                defaultChecked
                checked={checked()}
                onCheckedChange={setChecked}
              />
              Favourite
            </label>
            <label>
              <Switch name="notify" />
              Notify me
            </label>
            <Field label="Zoom">
              {(field) => (
                <Slider {...field} name="zoom" min={50} max={150} step={10} defaultValue={100} />
              )}
            </Field>
            <SegmentedControl
              legend="View"
              name="view"
              options={[
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'List' },
              ]}
              defaultValue="grid"
            />
          </div>
        </FieldGroup>
      </form>
      <div class="actions">
        <Button type="reset" form="entry" variant="outline">
          Reset
        </Button>
        <Button variant="ghost" onClick={() => setTitle('Moonrise')}>
          Rename
        </Button>
        <Button variant="ghost" onClick={() => setLocked(!locked())}>
          Lock fields
        </Button>
        <Button variant="ghost" onClick={() => setAvailable(!available())}>
          Change formats
        </Button>
      </div>
      <output hidden id="draft">
        {JSON.stringify({ title: title(), medium: medium(), checked: checked(), query: query() })}
      </output>
    </section>
  )
}
