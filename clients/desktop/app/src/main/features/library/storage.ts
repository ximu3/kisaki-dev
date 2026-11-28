import type { Storage } from '../../infrastructure/database'
import { dependencyStorage } from './change-admission'
import { deletionStorage } from './delete'
import { entryStorage } from './entries/storage'
import { relocationStorage } from './holdings/directories/relocate'
import { launchConfigStorage } from './holdings/game/launch-configs/storage'
import { preferenceStorage } from './holdings/preferences'
import { recognitionStorage } from './holdings/recognition/storage'
import { holdingStorage } from './holdings/storage'
import { mergeStorage } from './merge/commit'
import { organizerStorage } from './organizers/storage'
import { partStorage } from './parts/storage'
import { activityStorage } from './records/activities/storage'
import { annotationStorage } from './records/annotations/storage'
import { completionStorage } from './records/completions/storage'
import { noteStorage } from './records/notes/storage'
import { relationStorage } from './relations/storage'
import { showcaseStorage } from './showcase/storage'
import { graphStorage } from './write-graph/commit'

export function libraryStorage(storage: Storage) {
  return {
    ...mergeStorage(storage),
    ...deletionStorage(storage),
    ...dependencyStorage(storage),
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
    ...launchConfigStorage(storage),
    ...recognitionStorage(storage),
    ...relocationStorage(storage),
  }
}
