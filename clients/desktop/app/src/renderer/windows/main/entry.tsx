import { render } from 'solid-js/web'
import { WindowRoot } from '../../components/window-root'
import './styles.css'

const element = document.getElementById('root')
if (!element) throw new Error('Window root is unavailable')

const dispose = render(() => <WindowRoot title="Kisaki" close={window.kisaki.close} />, element)

// Signal readiness after the initial view has mounted.
window.dispatchEvent(new Event('kisaki:renderer-ready'))
import.meta.hot?.dispose(dispose)
