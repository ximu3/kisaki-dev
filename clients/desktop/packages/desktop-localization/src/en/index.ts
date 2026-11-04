/** @fileoverview Assembles the complete domain English message tree. */

import { appearanceMessages } from './appearance'
import { actionMessages } from './actions'
import { libraryMessages } from './library'
import { taskMessages } from './tasks'
import { resourceMessages } from './resources'
import { scannerMessages } from './scanner'
import { showcaseMessages } from './showcase'

/** One complete message tree supplies public source text, generated call types and translation validation. */
export const englishMessages = {
  appearance: appearanceMessages,
  actions: actionMessages,
  library: libraryMessages,
  tasks: taskMessages,
  resources: resourceMessages,
  scanner: scannerMessages,
  showcase: showcaseMessages,
} as const
