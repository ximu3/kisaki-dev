/** @fileoverview Independent Solid application. Editors and charts load only when opened. */

import { createSignal, lazy, Show, Suspense } from 'solid-js'
import { render } from 'solid-js/web'
import { Button } from '@kisaki3/desktop-ui/button'
import { States } from './states.js'
import { LibraryForm } from './form.js'
import { Actions } from './actions.js'
import '@kisaki3/desktop-ui/styles.css'

const ReadingNote = lazy(() => import('./note.js'))
const Activity = lazy(() => import('./activity.js'))
const Order = lazy(() => import('./order.js'))

function Workspace() {
  const [page, setPage] = createSignal('Library')
  const [released, setReleased] = createSignal(0)

  return (
    <>
      <header>
        <h1>Library workspace</h1>
        <nav aria-label="Sections">
          {['Library', 'Notes', 'Activity', 'Reading order'].map((name) => (
            <Button
              size="sm"
              variant={name === page() ? 'secondary' : 'ghost'}
              onClick={() => setPage(name)}
            >
              {name}
            </Button>
          ))}
        </nav>
      </header>
      <Suspense>
        <Show when={page() === 'Library'}>
          <LibraryForm />
          <Actions />
        </Show>
        <Show when={page() === 'Notes'}>
          <ReadingNote onRelease={() => setReleased((n) => n + 1)} />
        </Show>
        <Show when={page() === 'Activity'}>
          <Activity />
        </Show>
        <Show when={page() === 'Reading order'}>
          <Order />
        </Show>
      </Suspense>
      <output id="released" hidden>
        {released()}
      </output>
    </>
  )
}
render(location.search === '?states' ? States : Workspace, document.querySelector('main')!)
