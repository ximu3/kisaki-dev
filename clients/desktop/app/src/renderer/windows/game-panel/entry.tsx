import { render } from '@solidjs/web'
import { connect } from '../../infrastructure/api'
import { Notifications } from '../../infrastructure/notifications'

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
