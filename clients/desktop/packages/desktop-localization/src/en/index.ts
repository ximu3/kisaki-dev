/** @fileoverview Combines domain English messages into the validation and generated-type baseline. */

import { actionMessages } from './actions'
import { libraryMessages } from './library'
import { taskMessages } from './tasks'
import { resourceMessages } from './resources'
import { scannerMessages } from './scanner'
import { showcaseMessages } from './showcase'

/** English source catalog shared by call-type generation and translation validation. */
export const englishMessages = {
  actions: actionMessages,
  library: libraryMessages,
  tasks: taskMessages,
  resources: resourceMessages,
  scanner: scannerMessages,
  showcase: showcaseMessages,
} as const
