/** @fileoverview Loads the player document styles and announces renderer readiness. */

import './styles.css'

if (!document.getElementById('root')) {
  throw new Error('Window root is unavailable')
}

window.dispatchEvent(new Event('kisaki:renderer-ready'))
