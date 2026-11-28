import type {
  Note,
  NoteSummary,
  NoteQuery,
  NoteCreate,
  NoteUpdate,
  EntryRef,
  AnnotationRef,
  Annotation,
  AnnotationQuery,
  AnnotationSummary,
  AnnotationUpdate,
  AnnotationCreate,
  WorkType,
  ReorderInput,
  NoteOrderScope,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'

export interface RecordsWindowApi {
  'library.notes.list'(input: NoteQuery, range: ListOptions): ListResult<NoteSummary>
  'library.notes.get'(id: string): Note | null
  'library.notes.entries'(id: string, range: ListOptions): ListResult<EntryRef>
  'library.notes.create'(input: Omit<NoteCreate, 'prepared'>, images: readonly string[]): string
  'library.notes.update'(
    id: string,
    input: Omit<NoteUpdate, 'prepared'>,
    images: readonly string[],
  ): void
  'library.notes.reorder'(scope: NoteOrderScope, input: ReorderInput): void
  'library.notes.delete'(id: string): void
  'library.annotations.list'(
    query: AnnotationQuery,
    range: ListOptions,
  ): ListResult<AnnotationSummary>
  'library.annotations.get'(ref: AnnotationRef): Annotation | null
  'library.annotations.create'(
    input: {
      [K in WorkType]: Omit<Extract<AnnotationCreate, { workType: K }>, 'prepared'>
    }[WorkType],
    images: readonly string[],
  ): string
  'library.annotations.update'(
    ref: AnnotationRef,
    input: Omit<AnnotationUpdate, 'prepared'>,
    images: readonly string[],
  ): void
  'library.annotations.delete'(ref: AnnotationRef): void
}
