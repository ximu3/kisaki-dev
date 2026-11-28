import type { NativeFiles } from '#native'
import {
  parseLibraryWriteGraph,
  type LibraryWriteGraph,
  type LibraryWriteResult,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { PreparedAttachment } from '@kisaki3/desktop-contracts/resources'
import type { createAttachments } from '../../../infrastructure/attachments'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import { imageIds, prepareImages } from '../attachments'
import type { holdingStorage } from '../holdings/storage'
import type { CompleteWrite } from '../transaction'
import type { graphStorage } from './commit'
import { prepareRegistrations } from './local-content'
import { graphIds, references } from './references'

export function createGraphWriter(
  call: DatabaseCall<ReturnType<typeof holdingStorage> & ReturnType<typeof graphStorage>>,
  attachments: ReturnType<typeof createAttachments>,
  native: NativeFiles,
  resources: string,
  complete: CompleteWrite,
  locationsChanged: () => void,
) {
  return async function writeGraph<G extends LibraryWriteGraph>(
    input: G,
    options?: CallOptions,
  ): Promise<LibraryWriteResult<G>> {
    const signal = options?.signal ?? new AbortController().signal
    signal.throwIfAborted()
    const { prepared: shared = [], ...graph } = parseLibraryWriteGraph(input)
    const prepared: PreparedAttachment[] = [...shared]
    function adopt<T extends { prepared?: readonly PreparedAttachment[] }>(node: T) {
      const fields = { ...node }
      if (fields.prepared) {
        prepared.push(...fields.prepared)
        delete fields.prepared
      }
      return fields
    }
    const clean: LibraryWriteGraph = {
      ...graph,
      ...(graph.entries && {
        entries: {
          ...(graph.entries.create && { create: graph.entries.create.map(adopt) }),
          ...(graph.entries.update && { update: graph.entries.update.map(adopt) }),
        },
      }),
      ...(graph.parts?.update && {
        parts: { ...graph.parts, update: graph.parts.update.map(adopt) },
      }),
      ...(graph.tags?.update && { tags: { ...graph.tags, update: graph.tags.update.map(adopt) } }),
    }
    const ids = graphIds(graph)
    const refs = references(ids, new Map())
    const content = await prepareRegistrations(
      graph.localContent,
      refs,
      call,
      native,
      resources,
      signal,
    )
    const fields = [
      ...(graph.entries?.create ?? []),
      ...(graph.entries?.update ?? []).map((edit) => edit.changes),
      ...(graph.parts?.create ?? []).map((node) => node.data),
      ...(graph.parts?.update ?? []).map((edit) => edit.changes),
      ...(graph.tags?.create ?? []),
      ...(graph.tags?.update ?? []).map((edit) => edit.changes),
    ]
    const hold = await prepareImages(attachments, fields.flatMap(imageIds), prepared)
    try {
      signal.throwIfAborted()
      const result = complete(
        await call('writeLibraryGraph', clean, ids, hold.records, content),
      ) as LibraryWriteResult<G>
      if (content.some((plan) => plan.directories.length || plan.files.length)) {
        locationsChanged()
      }
      return result
    } finally {
      await hold.dispose()
    }
  }
}
