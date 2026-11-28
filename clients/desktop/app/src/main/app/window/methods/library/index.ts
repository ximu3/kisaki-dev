import type { PreparedImage } from '@kisaki3/desktop-contracts/images'
import { parseEntryMergeInput, type LibraryWriteGraph } from '@kisaki3/desktop-contracts/library'
import type { BrowserWindow } from 'electron'
import { rpcData } from '../../../../../shared/window-api/protocol'
import type { Application } from '../../../compose'
import { windowMethod, type WindowMethodGroup } from '../../admission'
import type { DocumentResources } from '../../resources'
import { entryMethods } from './entries'
import { createHoldingMethods } from './holdings'
import { imageMethods, preparedInput } from './images'
import { organizerMethods } from './organizers'
import { partMethods } from './parts'
import { recordMethods } from './records'
import { relationMethods } from './relations'
import { showcaseMethods } from './showcase'

export function createLibraryMethods(
  app: Application,
  resources: DocumentResources,
  images: ReadonlyMap<string, PreparedImage>,
  window: BrowserWindow,
): WindowMethodGroup<'library'> {
  const { library } = app,
    prepare = preparedInput(images)
  return {
    ...entryMethods(app, prepare),
    ...imageMethods(app, resources),
    ...recordMethods(library, prepare),
    ...partMethods(library.parts, prepare),
    ...relationMethods(library.relations),
    ...organizerMethods(library, prepare),
    ...showcaseMethods(library.showcase),
    ...createHoldingMethods(library.holdings, window),
    'library.writeGraph': windowMethod('write', async ([graph, ids], signal) =>
      rpcData(await library.writeGraph(prepare(graph, ids) as LibraryWriteGraph, { signal })),
    ),
    'library.merge': windowMethod('write', async ([input], signal) =>
      rpcData(await library.merge(parseEntryMergeInput(input), { signal })),
    ),
    'library.delete': windowMethod('write', ([refs], signal) => library.delete(refs, { signal })),
  }
}
