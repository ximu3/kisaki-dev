/** @fileoverview Assembles the desktop English message baseline from its owning domains. */

import { actionMessages } from './actions'
import { libraryMessages } from './library'
import { resourceMessages } from './resources'
import { scannerMessages } from './scanner'
import { showcaseMessages } from './showcase'
import { taskMessages } from './tasks'

/** One complete message tree supplies public source text, generated call types and translation validation. */
export const englishMessages = {
  actions: actionMessages,
  library: libraryMessages,
  tasks: taskMessages,
  resources: resourceMessages,
  scanner: scannerMessages,
  showcase: showcaseMessages,
} as const
