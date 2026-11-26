import { createSignal, lazy, Loading, Show } from 'solid-js'
import { render, type JSX } from '@solidjs/web'
import { Button } from '@kisaki3/desktop-ui/button'
import { Link } from '@kisaki3/desktop-ui/link'
import { Toaster, toast } from '@kisaki3/desktop-ui/toast'
import type { FixtureApi } from './api.js'
import { Controls, Validation } from './forms.js'
import { Gallery } from './gallery.js'
import { Interactions } from './interactions.js'
import { ToastOwner } from './toast-owner.js'
import '@kisaki3/desktop-ui/styles.css'
import './page.css'

const Resources = lazy(() => import('./resources.js'))

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
  setSampleTableDirection: noop,
  scrollSampleToEnd: noop,
  dispose: noop,
} satisfies FixtureApi

function App(): JSX.Element {
  const [owner, setOwner] = createSignal(true)
  const [resources, setResources] = createSignal(false)

  window.fixture.setOwner = setOwner
  // The root publishes independently of the disposable ToastOwner.
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
        <Gallery />
        <section>
          <h2>Feedback lifetime</h2>
          <Show when={owner()}>
            <ToastOwner />
          </Show>
          <Button variant="text" onClick={() => setOwner((value) => !value)}>
            Toggle owner
          </Button>
        </section>
        <section class="wide">
          <h2>Complete capabilities</h2>
          <Button onClick={() => setResources((value) => !value)}>
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
