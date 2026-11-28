import type {
  ActivitiesApi,
  Activity,
  ActivityCreate,
  ActivityQuery,
  ActivityStatistics,
  ActivityUpdate,
  CompletionCreate,
  CompletionCreateItem,
  CompletionsApi,
  CompletionStatistics,
  CompletionUpdate,
  EntryRef,
  ReorderInput,
  WorkCompletion,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions, ListResult, NonEmptyArray } from '@kisaki3/desktop-contracts/operations'

import type {
  Annotation,
  AnnotationCreate,
  AnnotationQuery,
  AnnotationRef,
  AnnotationSummary,
  AnnotationUpdate,
  Note,
  NoteCreate,
  NoteOrderScope,
  NoteQuery,
  NoteSummary,
  NoteUpdate,
  WorkType,
} from '@kisaki3/desktop-contracts/library'

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
  'library.activities.list'(query: ActivityQuery, range: ListOptions): ListResult<Activity>
  'library.activities.get'(work: WorkRef, id: string): Activity | null
  'library.activities.statistics'(
    query: Parameters<ActivitiesApi['statistics']>[0],
  ): ActivityStatistics
  'library.activities.create'(input: ActivityCreate): string
  'library.activities.update'(work: WorkRef, id: string, input: ActivityUpdate): void
  'library.activities.delete'(work: WorkRef, ids: readonly string[]): void
  'library.completions.statistics'(
    query: Parameters<CompletionsApi['statistics']>[0],
  ): CompletionStatistics
  'library.completions.list'(work: WorkRef, options: ListOptions): ListResult<WorkCompletion>
  'library.completions.get'(work: WorkRef, id: string): WorkCompletion | null
  'library.completions.create'(work: WorkRef, input: CompletionCreate): string
  'library.completions.recordCurrent'(work: WorkRef, input: CompletionCreate): string
  'library.completions.recordCurrentMany'(
    input: NonEmptyArray<CompletionCreateItem>,
  ): readonly { readonly work: WorkRef; readonly completionId: string }[]
  'library.completions.createMany'(input: NonEmptyArray<CompletionCreateItem>): readonly string[]
  'library.completions.update'(work: WorkRef, id: string, input: CompletionUpdate): void
  'library.completions.delete'(work: WorkRef, id: string): void
}
