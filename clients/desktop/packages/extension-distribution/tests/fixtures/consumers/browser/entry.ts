/** @fileoverview Displays the pure consumer result in a real browser without runtime shims. */

import { summary } from './consumer'

document.body.textContent = JSON.stringify(summary)
document.body.dataset.ready = 'true'
