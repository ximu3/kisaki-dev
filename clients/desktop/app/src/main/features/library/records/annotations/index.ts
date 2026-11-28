import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseAnnotationRef,
  parseAnnotationQuery,
  parseAnnotationUpdate,
  parseAnnotationCreate,
  parseWorkRef,
  type Annotation,
  type AnnotationRef,
  type AnnotationLocationResult,
  type WorkType,
  type FileWorkType,
  type AnnotationsApi,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions, type ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import type { createAttachments } from '../../../../infrastructure/attachments'
import { prepareImages } from '../../attachments'
import type { CompleteWrite } from '../../transaction'
import { annotationImages, type annotationStorage } from './storage'

export function createAnnotations(
  call: DatabaseCall<ReturnType<typeof annotationStorage>>,
  attachments: ReturnType<typeof createAttachments>,
  complete: CompleteWrite,
  sensitive: () => boolean,
): AnnotationsApi {
  return {
    list: (query, range) =>
      call('listAnnotations', parseAnnotationQuery(query), parseListOptions(range), sensitive()),
    async get<T extends WorkType>(raw: AnnotationRef<T>) {
      return (await call(
        'getAnnotation',
        parseAnnotationRef(raw),
        sensitive(),
      )) as Annotation<T> | null
    },
    async listLocations<T extends FileWorkType>(
      scope: { work: { type: T; id: string }; fileId: string },
      options: ListOptions,
    ) {
      const work = parseWorkRef(scope.work)
      if (work.type === 'game' || typeof scope.fileId !== 'string' || !scope.fileId) {
        throw new DesktopError('InvalidInput', 'Choose a registered video or reading file')
      }
      const result = await call(
        'annotationLocations',
        { type: work.type, id: work.id },
        scope.fileId,
        parseListOptions(options),
        sensitive(),
      )
      return result as AnnotationLocationResult<T>
    },
    async create(raw, options) {
      const { prepared = [], ...input } = parseAnnotationCreate(raw)
      const hold = await prepareImages(
        attachments,
        annotationImages(input.content, input.target.imageId),
        prepared,
      )
      try {
        options?.signal?.throwIfAborted()
        return complete(await call('createAnnotation', input, hold.records))
      } finally {
        await hold.dispose()
      }
    },
    async update(...[raw, values, options]) {
      const ref = parseAnnotationRef(raw),
        { prepared = [], ...input } = parseAnnotationUpdate(ref, values)
      const hold = await prepareImages(
        attachments,
        annotationImages(input.changes.content, input.changes.target?.imageId),
        prepared,
      )
      try {
        options?.signal?.throwIfAborted()
        complete(await call('editAnnotation', ref, input, hold.records))
      } finally {
        await hold.dispose()
      }
    },
    async delete(raw, options) {
      const refs = (Array.isArray(raw) ? raw : [raw]).map(parseAnnotationRef)
      if (
        !refs.length ||
        refs.length !== new Set(refs.map((ref) => JSON.stringify([ref.workType, ref.id]))).size
      ) {
        throw new DesktopError('InvalidInput', 'Choose distinct annotations')
      }
      options?.signal?.throwIfAborted()
      complete(await call('deleteAnnotations', refs))
    },
  }
}
