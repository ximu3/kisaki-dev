/**
 * @fileoverview Mounts the main window, announces renderer readiness and owns Solid
 * cleanup during HMR.
 */

import { render } from 'solid-js/web'
import { englishMessages } from '@kisaki3/desktop-contracts/i18n/english'
import { WindowRoot } from '../../components/window-root'
import './styles.css'

const element = document.getElementById('root')
if (!element) {
  throw new Error('Window root is unavailable')
}

const dispose = render(
  () => <WindowRoot title={englishMessages.windows.main} close={window.kisaki.close} />,
  element,
)

window.dispatchEvent(new Event('kisaki:renderer-ready'))
import.meta.hot?.dispose(dispose)
