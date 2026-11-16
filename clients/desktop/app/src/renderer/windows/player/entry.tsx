/** @fileoverview Adopts the real player document's language, appearance and window lifecycle. */

import { render } from 'solid-js/web'
import { connect } from '../../infrastructure/api'
import '../../infrastructure/window.css'

/** Verified player client bound to this document. */
const client = await connect('player')
render(
  () => (
    <main aria-label={client.t('runtime.player')}>
      <h1>{client.t('runtime.player')}</h1>
    </main>
  ),
  document.getElementById('root')!,
)
await client.ready()
