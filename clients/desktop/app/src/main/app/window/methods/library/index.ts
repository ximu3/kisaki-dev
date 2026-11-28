import type { BrowserWindow } from 'electron'
import type { PreparedImage } from '@kisaki3/desktop-contracts/images'
import { parseEntryMergeInput, type LibraryWriteGraph } from '@kisaki3/desktop-contracts/library'
import { rpcData } from '../../../../../shared/window-api/protocol'
import type { Application } from '../../../compose'
import type { DocumentResources } from '../../resources'
import { windowMethod, type WindowMethodGroup } from '../../admission'
import { entryMethods } from './entries'
import { organizerMethods } from './organizers'
import { recordMethods } from './records'
import { createHoldingMethods } from './holdings'
import { imageMethods, preparedInput } from './images'
import { partMethods } from './parts'
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
