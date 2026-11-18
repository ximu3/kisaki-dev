/** @fileoverview Adopts the real game-panel document's language, appearance and window lifecycle. */

import { render } from 'solid-js/web'
import { connect } from '../../infrastructure/api'
import { Notifications } from '../../infrastructure/notifications'

/** Verified game-panel client bound to this document. */
const client = await connect('game-panel')
render(
  () => (
    <>
      <Notifications t={client.t} />
      <main aria-label={client.t('runtime.game-panel')}>
        <h1>{client.t('runtime.game-panel')}</h1>
      </main>
    </>
  ),
  document.getElementById('root')!,
)
await client.ready()
