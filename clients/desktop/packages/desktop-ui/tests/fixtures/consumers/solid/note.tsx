/** @fileoverview Editor and two independent previews share a host-owned draft. */

import { createSignal } from 'solid-js'
import {
  MarkdownEditor,
  MarkdownPreview,
  MarkdownToolbar,
  type MarkdownEditorProps,
} from '@kisaki3/desktop-ui/markdown'
import { Button } from '@kisaki3/desktop-ui/button'

const sample = [
  'One *note* (c) ...',
  'soft break',
  '',
  '- [x] Read chapter',
  '',
  'A footnote[^1].',
  '',
  '[^1]: A note.',
  '',
  '| Page | Mark |',
  '| --- | --- |',
  '| 1 | A |',
  '',
  '<img src=x onerror=alert(1)>',
  '',
  '![Missing cover](https://invalid.example/never-fetch) ![Bound](asset:cover)',
  '',
  'https://example.org',
].join('\n')

export default function ReadingNote(props: { onRelease: () => void }) {
  const [value, setValue] = createSignal(sample)
  const [view, setView] = createSignal<Parameters<NonNullable<MarkdownEditorProps['onView']>>[0]>()
  const [url, setUrl] = createSignal('')

  return (
    <section>
      <h2>Reading note</h2>
      <MarkdownToolbar
        label="Format"
        view={view()}
        actions={[
          { command: 'bold', label: 'Bold' },
          { command: 'undo', label: 'Undo' },
        ]}
      />
      <MarkdownEditor
        label="Note source"
        value={value()}
        onValueChange={setValue}
        onView={(v) => {
          setView(v)
          if (!v) {
            props.onRelease()
          }
        }}
      />
      <Button onClick={() => setValue('Revised')}>Replace text</Button>
      <div class="markdown-pair">
        {[0, 1].map(() => (
          <MarkdownPreview
            value={value()}
            resolveImage={(source) =>
              source === 'asset:cover'
                ? 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%222%22 height=%222%22/%3E'
                : undefined
            }
            onNavigate={setUrl}
          />
        ))}
      </div>
      <output id="destination">{url()}</output>
    </section>
  )
}
