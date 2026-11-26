import { Errored } from 'solid-js'
import { render } from '@solidjs/web'
import { connect } from '../../infrastructure/api'
import { MainWindow } from './shell/root'

const api = await connect('main')

render(
  () => (
    <Errored fallback={(error) => <main role="alert">{String(error())}</main>}>
      <MainWindow api={api} />
    </Errored>
  ),
  document.getElementById('root')!,
)

await api.ready()
