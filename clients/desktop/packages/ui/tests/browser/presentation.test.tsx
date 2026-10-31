/** @fileoverview Checks compact control composition and records the shared light and dark appearance. */

import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { For, type JSX } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Button,
  Link,
  Badge,
  Separator,
  Spinner,
  Progress,
  ProgressLabel,
  ProgressValueLabel,
  ProgressTrack,
  ProgressFill,
  Alert,
  AlertTitle,
  AlertDescription,
  Image,
  ImageImg,
  ImageFallback,
  EmptyState,
  EmptyStateTitle,
  EmptyStateDescription,
  Fieldset,
  FieldLegend,
  TextField,
  TextFieldLabel,
  TextFieldInput,
  TextFieldTextArea,
  TextFieldDescription,
  TextFieldErrorMessage,
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
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItemControl,
  SegmentedControlItemInput,
  SegmentedControlItemLabel,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  ScrollRegion,
} from '../../src/index'
import { MarkdownEditor, MarkdownPreview } from '../../src/markdown'
import '@kisaki3/appearance/styles.css'
import '@kisaki3/ui/styles.css'

let dispose: (() => void) | undefined
let root: HTMLDivElement | undefined

afterEach(() => {
  dispose?.()
  root?.remove()
  delete document.documentElement.dataset.colorScheme
})

function Section(props: { title: string; children: JSX.Element }): JSX.Element {
  return (
    <section style={{ display: 'flex', 'flex-direction': 'column', gap: '14px', 'min-width': 0 }}>
      <h2 style={{ margin: '0 0 4px', 'font-size': '14px', 'font-weight': 600 }}>{props.title}</h2>
      {props.children}
    </section>
  )
}

test('presentation parts keep their semantic states and host theme at compact density', async () => {
  await page.viewport(1160, 900)
  root = document.createElement('div')
  document.body.append(root)
  dispose = render(
    () => (
      <div
        data-testid="appearance"
        style={{
          width: '1040px',
          padding: '24px',
          display: 'grid',
          'grid-template-columns': 'repeat(3, minmax(0, 1fr))',
          gap: '32px',
          background: 'var(--background)',
          color: 'var(--foreground)',
          'font-family': 'var(--font-sans)',
          'font-size': 'var(--text-base-size)',
          'font-weight': 'var(--text-base-weight)',
          'line-height': 'var(--text-base-line-height)',
        }}
      >
        <Section title="Actions and feedback">
          <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '6px' }}>
            <For each={['primary', 'secondary', 'outline', 'ghost', 'destructive'] as const}>
              {(variant) => <Button variant={variant}>{variant}</Button>}
            </For>
            <Button disabled>Disabled</Button>
            <Link href="#preview">Read more</Link>
          </div>
          <div style={{ display: 'flex', gap: '6px', 'flex-wrap': 'wrap' }}>
            <Badge>Draft</Badge>
            <Badge variant="success">Ready</Badge>
            <Badge variant="warning">Waiting</Badge>
            <Badge variant="destructive">Failed</Badge>
          </div>
          <Separator />
          <Progress value={45}>
            <ProgressLabel>Import progress</ProgressLabel>
            <ProgressTrack>
              <ProgressFill />
            </ProgressTrack>
            <ProgressValueLabel />
          </Progress>
          <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
            <Spinner />
            Reading metadata
          </div>
          <Alert variant="info">
            <AlertTitle>Notice</AlertTitle>
            <AlertDescription>A supplied status message and its explanation.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Operation failed</AlertTitle>
            <AlertDescription>The owning view supplies recovery actions.</AlertDescription>
          </Alert>
          <Image style={{ width: '64px', height: '64px' }}>
            <ImageImg src="data:image/png,invalid" alt="Cover" />
            <ImageFallback>Cover</ImageFallback>
          </Image>
          <EmptyState>
            <EmptyStateTitle>No results</EmptyStateTitle>
            <EmptyStateDescription>Change the filters or add a new item.</EmptyStateDescription>
            <Button size="sm" variant="outline">
              Add item
            </Button>
          </EmptyState>
        </Section>
        <Section title="Editing and choices">
          <Fieldset>
            <FieldLegend>Metadata</FieldLegend>
            <TextField defaultValue="A quiet afternoon">
              <TextFieldLabel>Title</TextFieldLabel>
              <TextFieldInput />
              <TextFieldDescription>A readable display title.</TextFieldDescription>
            </TextField>
            <TextField validationState="invalid">
              <TextFieldLabel>Directory</TextFieldLabel>
              <TextFieldInput placeholder="Choose a directory" />
              <TextFieldErrorMessage>Select an existing directory.</TextFieldErrorMessage>
            </TextField>
            <TextField disabled defaultValue="Unavailable">
              <TextFieldLabel>Unavailable field</TextFieldLabel>
              <TextFieldInput />
            </TextField>
            <TextField defaultValue={'A few notes\nwith another line.'}>
              <TextFieldLabel>Notes</TextFieldLabel>
              <TextFieldTextArea />
            </TextField>
          </Fieldset>
          <Checkbox defaultChecked>
            <CheckboxInput />
            <CheckboxControl>
              <CheckboxIndicator />
            </CheckboxControl>
            <CheckboxLabel>Include archived items</CheckboxLabel>
          </Checkbox>
          <Checkbox indeterminate>
            <CheckboxInput />
            <CheckboxControl>
              <CheckboxIndicator />
            </CheckboxControl>
            <CheckboxLabel>Some selected</CheckboxLabel>
          </Checkbox>
          <Switch defaultChecked>
            <SwitchInput />
            <SwitchControl>
              <SwitchThumb />
            </SwitchControl>
            <SwitchLabel>Show details</SwitchLabel>
          </Switch>
          <SegmentedControl aria-label="Density" defaultValue="comfortable">
            <For each={['compact', 'comfortable']}>
              {(value) => (
                <SegmentedControlItem value={value}>
                  <SegmentedControlItemInput />
                  <SegmentedControlItemControl>
                    <SegmentedControlItemLabel>{value}</SegmentedControlItemLabel>
                  </SegmentedControlItemControl>
                </SegmentedControlItem>
              )}
            </For>
          </SegmentedControl>
        </Section>
        <Section title="Content">
          <MarkdownEditor
            aria-label="Source note"
            defaultValue={
              '## A short note\n\n**Strong**, *emphasis* and `code`.\n\n[Link](https://example.com)'
            }
          />
          <Tabs defaultValue="overview">
            <TabsList aria-label="Details">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">Overview content</TabsContent>
            <TabsContent value="history">History content</TabsContent>
          </Tabs>
          <Collapsible>
            <CollapsibleTrigger variant="outline">Advanced options</CollapsibleTrigger>
            <CollapsibleContent>Additional settings</CollapsibleContent>
          </Collapsible>
          <ScrollRegion aria-label="Entries" style={{ height: '130px' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Title</TableHeaderCell>
                  <TableHeaderCell>State</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <For each={['First', 'Second', 'Third', 'Fourth']}>
                  {(title) => (
                    <TableRow>
                      <TableCell>{title}</TableCell>
                      <TableCell>Ready</TableCell>
                    </TableRow>
                  )}
                </For>
              </TableBody>
            </Table>
          </ScrollRegion>
          <MarkdownPreview
            id="preview"
            value={
              '## A short note\n\nClear **text**, a [link](https://example.com) and `source`.\n\n> A quoted passage.\n\n- [x] Complete\n- [ ] Next\n\n| Name | Value |\n| --- | --- |\n| Count | 42 |\n\n```ts\nconst value = 42\n```'
            }
          />
        </Section>
      </div>
    ),
    root,
  )

  await page.getByRole('tab', { name: 'History' }).click()
  await expect.element(page.getByRole('tabpanel')).toHaveTextContent('History content')
  await page.getByRole('button', { name: 'Advanced options' }).click()
  await expect.element(page.getByText('Additional settings')).toBeVisible()
  await page.getByText('compact', { exact: true }).click()
  await expect.element(page.getByRole('radio', { name: 'compact' })).toBeChecked()
  await expect
    .element(page.getByRole('progressbar', { name: 'Import progress' }))
    .toHaveAttribute('aria-valuenow', '45')

  document.documentElement.dataset.colorScheme = 'light'
  await page
    .getByTestId('appearance')
    .screenshot({ path: '../../test-results/browser/appearance-light.png' })
  document.documentElement.dataset.colorScheme = 'dark'
  await page
    .getByTestId('appearance')
    .screenshot({ path: '../../test-results/browser/appearance-dark.png' })
})
