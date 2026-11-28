import {
  libraryInvalidationAreas,
  type LibraryChange,
  type LibraryInvalidation,
  type LibraryInvalidationArea,
} from '@kisaki3/desktop-contracts/library'
import { createSignal } from '../../infrastructure/events'

function affected(change: LibraryChange): readonly LibraryInvalidationArea[] {
  switch (change.type) {
    case 'entriesMerged':
    case 'entryDeleted':
      return libraryInvalidationAreas
    case 'entryCreated':
    case 'entryUpdated':
      return ['entries', 'collections', 'tags', 'relations', 'notes', 'showcase', 'activities']
    case 'evaluationChanged':
    case 'workRecordChanged':
      return ['entries', 'collections', 'showcase', 'activities']
    case 'partCreated':
    case 'partUpdated':
    case 'partRecordChanged':
      return ['parts', 'entries', 'collections', 'holdings', 'showcase']
    case 'partKindChanged':
    case 'partMoved':
    case 'partMerged':
    case 'partDeleted':
      return ['parts', 'entries', 'collections', 'holdings', 'activities', 'showcase']
    case 'relationCreated':
    case 'relationUpdated':
    case 'relationDeleted':
      return ['relations', 'entries', 'collections', 'showcase']
    case 'collectionCreated':
    case 'collectionUpdated':
    case 'collectionDeleted':
    case 'collectionsMerged':
    case 'collectionMembersChanged':
      return ['collections', 'entries', 'activities', 'showcase']
    case 'tagCreated':
    case 'tagUpdated':
    case 'tagDeleted':
    case 'tagsMerged':
    case 'entryTagsChanged':
      return ['tags', 'entries', 'collections', 'showcase']
    case 'noteCreated':
    case 'noteUpdated':
    case 'noteDeleted':
      return ['notes', 'entries', 'collections', 'showcase']
    case 'annotationCreated':
    case 'annotationUpdated':
    case 'annotationDeleted':
      return ['annotations']
    case 'activityCreated':
    case 'activityUpdated':
    case 'activityDeleted':
      return ['activities', 'entries', 'collections', 'showcase']
    case 'holdingsChanged':
      return [
        'holdings',
        'entries',
        'parts',
        'annotations',
        'activities',
        'collections',
        'showcase',
      ]
    case 'showcaseChanged':
      return ['showcase']
  }
}
export function libraryInvalidation() {
  const signal = createSignal<LibraryInvalidation>()
  function emit(areas: Iterable<LibraryInvalidationArea>) {
    const [first, ...rest] = new Set(areas)
    if (first) {
      signal.emit({ areas: [first, ...rest] })
    }
  }
  return {
    on: signal.on,
    commit: (changes: readonly LibraryChange[]) => emit(changes.flatMap(affected)),
    all: () => emit(libraryInvalidationAreas),
    holdings: () => emit(['holdings']),
  }
}
