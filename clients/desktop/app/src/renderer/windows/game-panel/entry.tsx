/** @fileoverview Adopts the real game-panel document's language, appearance and window lifecycle. */

import { render } from 'solid-js/web'
import { connect } from '../../infrastructure/api'
import '../../infrastructure/window.css'

/** Verified game-panel client bound to this document. */
const client = await connect('game-panel')
render(
  () => (
    <main aria-label={client.t('runtime.game-panel')}>
      <h1>{client.t('runtime.game-panel')}</h1>
    </main>
  ),
  document.getElementById('root')!,
)
await client.ready()
