import type {
  GameLaunchConfig,
  GameLaunchConfigCreate,
  GameLaunchConfigUpdate,
  ReorderInput,
} from '@kisaki3/desktop-contracts/library'

export interface LaunchConfigWindowApi {
  'library.configs.openLocation'(game: string, id: string): void
  'library.configs.list'(game: string): readonly GameLaunchConfig[]
  'library.configs.get'(game: string, id: string): GameLaunchConfig | null
  'library.configs.create'(game: string, input: GameLaunchConfigCreate): string
  'library.configs.update'(game: string, id: string, input: GameLaunchConfigUpdate): void
  'library.configs.delete'(game: string, id: string): void
  'library.configs.reorder'(game: string, input: ReorderInput): void
  'library.configs.prefer'(game: string, id: string | null, expected: string | null): void
}
