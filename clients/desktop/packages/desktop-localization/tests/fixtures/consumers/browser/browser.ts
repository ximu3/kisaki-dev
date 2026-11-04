/** @fileoverview Publishes the standalone browser consumer result for the external test harness. */

import { summary } from './consumer'

document.querySelector('#summary')!.textContent = JSON.stringify(summary)
document.body.dataset.ready = 'true'
