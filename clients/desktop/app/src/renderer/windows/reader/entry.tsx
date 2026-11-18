/** @fileoverview Adopts the real reader document's language, appearance and window lifecycle. */

import { render } from 'solid-js/web'
import { connect } from '../../infrastructure/api'
import { Notifications } from '../../infrastructure/notifications'

/** Verified reader client bound to this document. */
const client = await connect('reader')
render(
  () => (
    <>
      <Notifications t={client.t} />
      <main aria-label={client.t('runtime.reader')}>
        <h1>{client.t('runtime.reader')}</h1>
      </main>
    </>
  ),
  document.getElementById('root')!,
)
await client.ready()
