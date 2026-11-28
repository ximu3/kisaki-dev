import type {
  ReorderInput,
  ShowcaseFields,
  ShowcasePreset,
  ShowcaseSection,
  ShowcaseUpdate,
} from '@kisaki3/desktop-contracts/library'
import type { NonEmptyArray } from '@kisaki3/desktop-contracts/operations'

export interface ShowcaseWindowApi {
  'library.showcase.list'(): readonly ShowcaseSection[]
  'library.showcase.get'(id: string): ShowcaseSection | null
  'library.showcase.listPresets'(): readonly ShowcasePreset[]
  'library.showcase.create'(input: ShowcaseFields): ShowcaseSection
  'library.showcase.createMany'(input: NonEmptyArray<ShowcaseFields>): readonly ShowcaseSection[]
  'library.showcase.update'(id: string, input: ShowcaseUpdate): ShowcaseSection
  'library.showcase.delete'(id: string): void
  'library.showcase.reorder'(input: ReorderInput): void
}
