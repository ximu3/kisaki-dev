import { render } from '@solidjs/web'
import { connect } from '../../infrastructure/api'
import { Notifications } from '../../infrastructure/notifications'

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
