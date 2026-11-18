/** @fileoverview Connects the main document, mounts its navigation root and reports readiness. */

import { ErrorBoundary } from 'solid-js'
import { render } from 'solid-js/web'
import { connect } from '../../infrastructure/api'
import { MainWindow } from './app/root'
import { pages } from './app/routes'

/** Window client bound to this connected document. */
const api = await connect('main')

render(
  () => (
    <ErrorBoundary fallback={(error) => <main role="alert">{String(error)}</main>}>
      <MainWindow api={api} pages={pages} />
    </ErrorBoundary>
  ),
  document.getElementById('root')!,
)

await api.ready()
