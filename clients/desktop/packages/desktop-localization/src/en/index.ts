import { actionMessages } from './actions'
import { appearanceMessages } from './appearance'
import { applicationMessages } from './application'
import { controlMessages } from './controls'
import { fontMessages } from './fonts'
import { formMessages } from './forms'
import { libraryMessages } from './library'
import { navigationMessages } from './navigation'
import { preferenceMessages } from './preferences'
import { resourceMessages } from './resources'
import { scannerMessages } from './scanner'
import { shortcutMessages } from './shortcuts'
import { showcaseMessages } from './showcase'
import { systemIntegrationMessages } from './system-integration'
import { taskMessages } from './tasks'
import { themeMessages } from './themes'

export const englishMessages = {
  actions: actionMessages,
  appearance: appearanceMessages,
  application: applicationMessages,
  controls: controlMessages,
  fonts: fontMessages,
  forms: formMessages,
  library: libraryMessages,
  navigation: navigationMessages,
  preferences: preferenceMessages,
  resources: resourceMessages,
  scanner: scannerMessages,
  shortcuts: shortcutMessages,
  showcase: showcaseMessages,
  systemIntegration: systemIntegrationMessages,
  tasks: taskMessages,
  themes: themeMessages,
} as const
