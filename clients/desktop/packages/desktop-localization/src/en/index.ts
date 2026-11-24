import { actionMessages } from './actions'
import { libraryMessages } from './library'
import { taskMessages } from './tasks'
import { resourceMessages } from './resources'
import { scannerMessages } from './scanner'
import { showcaseMessages } from './showcase'
import { runtimeMessages } from './runtime'

export const englishMessages = {
  actions: actionMessages,
  library: libraryMessages,
  tasks: taskMessages,
  resources: resourceMessages,
  scanner: scannerMessages,
  showcase: showcaseMessages,
  runtime: runtimeMessages,
} as const
