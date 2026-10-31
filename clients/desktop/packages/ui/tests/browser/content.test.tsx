/** @fileoverview Verifies chart lifecycle, safe Markdown rendering and native source editing. */

import { afterEach, expect, test, vi } from 'vitest'
import { cdp, page, userEvent } from 'vitest/browser'
import type {} from '@vitest/browser-playwright'
import { createSignal, Show, type JSX } from 'solid-js'
import { render } from 'solid-js/web'
import { ViewPlugin } from '@codemirror/view'
import { XYContainer } from '@unovis/ts'
import {
  Chart,
  ChartLegend,
  VisXYContainer,
  VisLine,
  VisLineSelectors,
  VisAxis,
  VisTooltip,
  VisCrosshair,
  createChartTooltip,
} from '../../src/chart'
import {
  MarkdownEditor,
  MarkdownPreview,
  MarkdownToolbar,
  markdownCommands,
  type EditorView,
} from '../../src/markdown'
import { TextField, TextFieldInput, TextFieldLabel, TextFieldTextArea } from '../../src/index'
import '@kisaki3/appearance/styles.css'
import '@kisaki3/ui/styles.css'

let dispose: (() => void) | undefined
let root: HTMLDivElement | undefined

afterEach(() => {
  dispose?.()
  root?.remove()
  vi.restoreAllMocks()
})

/** Give each rendered content instance an explicit disposable owner. */
function mount(view: () => JSX.Element): void {
  root = document.createElement('div')
  document.body.append(root)
  dispose = render(view, root)
}

test('chart data and theme update through the native adapter and disposal releases its container', async () => {
  const [data, setData] = createSignal([
    { x: 0, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 1 },
  ])
  const [mounted, setMounted] = createSignal(true)
  const [inactive, setInactive] = createSignal(false)
  const destroy = vi.spyOn(XYContainer.prototype, 'destroy')

  mount(() => (
    <Show when={mounted()}>
      <Chart aria-label="Counts" style={{ width: '400px' }}>
        <VisXYContainer data={data()} height={180} duration={0}>
          <VisLine<{ x: number; y: number }> x={(datum) => datum.x} y={(datum) => datum.y} />
          <VisAxis type="x" />
          <VisAxis type="y" />
          <VisTooltip attributes={{ role: 'tooltip' }} />
          <VisCrosshair<{ x: number; y: number }>
            forceShowAt={1}
            template={(point) =>
              createChartTooltip({ rows: [{ label: 'Count', value: String(point.y) }] })
            }
          />
        </VisXYContainer>
        <ChartLegend
          items={[{ label: 'Series', color: 'var(--chart)', inactive: inactive() }]}
          onItemClick={() => setInactive(!inactive())}
        />
      </Chart>
    </Show>
  ))

  const path = (): SVGPathElement | null => root!.querySelector(`.${VisLineSelectors.linePath}`)
  await expect.poll(() => path()?.getAttribute('d')).toBeTruthy()
  await expect.element(page.getByRole('tooltip')).toHaveTextContent('Count2')
  const before = path()!.getAttribute('d')
  setData([
    { x: 0, y: 3 },
    { x: 1, y: 1 },
    { x: 2, y: 5 },
  ])
  await expect.poll(() => path()?.getAttribute('d')).not.toBe(before)
  await expect.element(page.getByRole('tooltip')).toHaveTextContent('Count1')
  root!.querySelector('figure')!.style.setProperty('--chart', 'rgb(255, 0, 0)')
  expect(getComputedStyle(path()!).stroke).toBe('rgb(255, 0, 0)')

  await userEvent.tab()
  await userEvent.keyboard('{Enter}')
  await expect
    .element(page.getByRole('button', { name: 'Series' }))
    .toHaveAttribute('aria-pressed', 'false')
  const tooltip = createChartTooltip({
    title: '<img src=x>',
    rows: [{ label: '<script>', value: '1 < 2' }],
  })
  expect(tooltip.querySelector('img, script')).toBeNull()
  expect(tooltip.textContent).toBe('<img src=x><script>1 < 2')

  setMounted(false)
  expect(destroy).toHaveBeenCalledOnce()
  expect(root!.querySelector('svg')).toBeNull()
})

test('Markdown escapes HTML, keeps task and footnote identities local, and resolves resources through its host', async () => {
  let opened = ''
  const buttons: number[] = []
  const source =
    '# Notes\n\n<script>alert(1)</script>\n\n- [x] Done\n- [ ] Pending\n\nText[^one]\n\n[^one]: Detail\n\n![Cover](asset:cover)\n\n[Site](https://example.com)\n\n[Unsafe](javascript:alert(1))'
  const image =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/%3E'
  mount(() => (
    <>
      <MarkdownPreview
        data-testid="first-preview"
        value={source}
        resolveImage={(resource) => (resource === 'asset:cover' ? image : undefined)}
        onLinkClick={(href, event) => {
          opened = href
          buttons.push(event.button)
        }}
      />
      <MarkdownPreview
        data-testid="second-preview"
        value={'- [x] Other\n\nOther[^one]\n\n[^one]: Detail'}
      />
    </>
  ))

  expect(root!.querySelector('script')).toBeNull()
  expect(root!.querySelector('a[href^="javascript:"]')).toBeNull()
  expect(root!.querySelector('img')?.getAttribute('src')).toBe(image)
  const checkboxes = [...root!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
  expect(checkboxes.every((input) => input.disabled)).toBe(true)
  expect(checkboxes.map((input) => input.checked)).toEqual([true, false, true])
  const identifiers = [...root!.querySelectorAll('[id]')].map((element) => element.id)
  expect(new Set(identifiers).size).toBe(identifiers.length)
  for (const input of checkboxes) {
    expect(root!.querySelector(`label[for="${input.id}"]`)).not.toBeNull()
  }

  await page.getByRole('link', { name: 'Site', exact: true }).click()
  expect(opened).toBe('https://example.com')
  await page.getByRole('link', { name: 'Site', exact: true }).click({ button: 'middle' })
  expect(buttons).toEqual([0, 1])
})

test('Markdown editing preserves selection and history, synchronizes external text and destroys extensions', async () => {
  const [value, setValue] = createSignal('Hello')
  const [view, setView] = createSignal<EditorView>()
  const [readOnly, setReadOnly] = createSignal(false)
  const [mounted, setMounted] = createSignal(true)
  let changes = 0
  let released = 0
  const extension = ViewPlugin.define(() => ({
    destroy: () => {
      released++
    },
  }))

  mount(() => (
    <Show when={mounted()}>
      <MarkdownToolbar
        aria-label="Formatting"
        view={view()}
        disabled={readOnly()}
        items={[{ label: 'Bold', content: <strong>B</strong>, command: markdownCommands.bold }]}
      />
      <MarkdownEditor
        aria-label="Body"
        value={value()}
        readOnly={readOnly()}
        onView={setView}
        extensions={extension}
        onChange={(next) => {
          changes++
          setValue(next)
        }}
      />
    </Show>
  ))

  const textbox = page.getByRole('textbox', { name: 'Body' })
  await textbox.click()
  await userEvent.keyboard('{Control>}a{/Control}')
  await page.getByRole('button', { name: 'Bold' }).click()
  expect(value()).toBe('**Hello**')
  await userEvent.keyboard('{Control>}z{/Control}')
  await expect.poll(value).toBe('Hello')

  const edits = changes
  setValue('External')
  await expect.poll(() => view()?.state.doc.toString()).toBe('External')
  expect(changes).toBe(edits)
  setReadOnly(true)
  await expect.element(page.getByRole('button', { name: 'Bold' })).toBeDisabled()
  await textbox.click()
  await userEvent.keyboard('x')
  expect(value()).toBe('External')

  const editorElement = view()!.dom
  setMounted(false)
  expect(view()).toBeUndefined()
  expect(released).toBe(1)
  expect(editorElement.isConnected).toBe(false)
})

test('native IME composition survives controlled TextField and Markdown updates', async () => {
  const [field, setField] = createSignal('')
  const [markdownValue, setMarkdownValue] = createSignal('')
  const [message, setMessage] = createSignal('')
  const [view, setView] = createSignal<EditorView>()
  let submissions = 0
  let allowSubmission = true
  mount(() => (
    <>
      <TextField value={field()} onChange={setField}>
        <TextFieldLabel>Name</TextFieldLabel>
        <TextFieldInput />
      </TextField>
      <MarkdownEditor
        aria-label="Body"
        value={markdownValue()}
        onChange={setMarkdownValue}
        onView={setView}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submissions++
        }}
      >
        <TextField value={message()} onChange={setMessage}>
          <TextFieldLabel>Message</TextFieldLabel>
          <TextFieldTextArea
            submitOnEnter
            onKeyDown={(event) => {
              if (!allowSubmission) {
                event.preventDefault()
              }
            }}
          />
        </TextField>
      </form>
    </>
  ))

  const session = cdp()
  for (const [name, value] of [
    ['Name', field],
    ['Body', markdownValue],
    ['Message', message],
  ] as const) {
    await page.getByRole('textbox', { name }).click()
    await session.send('Input.imeSetComposition', {
      text: 'に',
      selectionStart: 1,
      selectionEnd: 1,
    })
    await session.send('Input.imeSetComposition', {
      text: '日本',
      selectionStart: 2,
      selectionEnd: 2,
    })
    if (name === 'Body') {
      expect(markdownCommands.bold(view()!)).toBe(false)
    }
    if (name === 'Message') {
      await session.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Enter',
        code: 'Enter',
        text: '\r',
        windowsVirtualKeyCode: 13,
      })
      await session.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
      })
      expect(submissions).toBe(0)
    }
    await session.send('Input.insertText', { text: '日本' })
    // CDP explicitly injects a carriage return; a textarea may insert it, but must not submit during composition.
    await expect.poll(value).toBe(name === 'Message' ? '日本\n' : '日本')
  }
  await userEvent.keyboard('{Enter}')
  expect(submissions).toBe(1)
  allowSubmission = false
  await userEvent.keyboard('{Enter}')
  expect(submissions).toBe(1)
})
