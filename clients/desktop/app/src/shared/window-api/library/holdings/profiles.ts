import type {
  FileConditionByType,
  FileRecognitionDefinition,
  FileRecognitionPreset,
  FileRecognitionProfile,
  FileRecognitionProfileFields,
  FileRecognitionSource,
  FileWorkType,
  ReorderInput,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'

export interface RecognitionProfileWindowApi {
  'library.profiles.explain'(
    type: FileWorkType,
    definition: FileRecognitionDefinition,
    baseName: string,
    path: string | null,
  ): {
    source: FileRecognitionSource | null
    input: string
    numbers: readonly { input: string; offset: number; value: string }[]
    captures: Readonly<Record<string, string>>
    conditions: readonly FileConditionByType[FileWorkType][]
  }
  'library.profiles.list'(
    type: FileWorkType,
  ): readonly Pick<FileRecognitionProfile, 'id' | 'name' | 'workType' | 'description'>[]
  'library.profiles.get'(type: FileWorkType, id: string): FileRecognitionProfile | null
  'library.profiles.references'(
    type: FileWorkType,
    id: string,
  ): readonly { work: WorkRef<FileWorkType>; directoryId: string; path: string }[]
  'library.profiles.presets'(type: FileWorkType): readonly FileRecognitionPreset<FileWorkType>[]
  'library.profiles.create'(
    type: FileWorkType,
    input: FileRecognitionProfileFields<FileWorkType>,
  ): FileRecognitionProfile
  'library.profiles.update'(
    type: FileWorkType,
    id: string,
    input: {
      changes: Partial<FileRecognitionProfileFields<FileWorkType>>
      expected?: Partial<FileRecognitionProfileFields<FileWorkType>>
    },
  ): FileRecognitionProfile
  'library.profiles.delete'(type: FileWorkType, id: string): void
  'library.profiles.reorder'(type: FileWorkType, input: ReorderInput): void
}
