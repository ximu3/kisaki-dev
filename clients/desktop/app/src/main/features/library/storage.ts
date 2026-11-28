import type { Storage } from '../../infrastructure/database'
import { entryStorage } from './entries/storage'
import { completionStorage } from './records/completions/storage'
import { showcaseStorage } from './showcase/storage'
import { organizerStorage } from './organizers/catalog'
import { relationStorage } from './relations/storage'
import { partStorage } from './parts/storage'
import { activityStorage } from './records/activities/storage'
import { holdingStorage } from './holdings/storage'
import { configStorage } from './holdings/game/configurations'
import { recognitionStorage } from './holdings/recognition/storage'
import { relocationStorage } from './holdings/directories/relocate'

import { annotationStorage } from './records/annotations/storage'
import { noteStorage } from './records/notes/storage'
import { graphStorage } from './graph/storage'

import { preferenceStorage } from './holdings/preferences'

import { identityStorage } from './entries/identity/storage'
export function libraryStorage(storage: Storage) {
  return {
    ...identityStorage(storage),
    ...entryStorage(storage),
    ...graphStorage(storage),
    ...noteStorage(storage),
    ...annotationStorage(storage),
    ...completionStorage(storage),
    ...showcaseStorage(storage),
    ...organizerStorage(storage),
    ...relationStorage(storage),
    ...partStorage(storage),
    ...activityStorage(storage),
    ...preferenceStorage(storage),
    ...holdingStorage(storage),
    ...configStorage(storage),
    ...recognitionStorage(storage),
    ...relocationStorage(storage),
  }
}
