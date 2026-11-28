import type {
  FileWorkType,
  HoldingsRefreshResult,
  LocalContentRegistrationResult,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { DirectoryWindowApi } from './directories'
import type { FileWindowApi } from './files'
import type { LaunchConfigWindowApi } from './launch-configs'
import type { HoldingPreferencesWindowApi } from './preferences'
import type { RecognitionProfileWindowApi } from './profiles'

export interface HoldingsWindowApi
  extends
    HoldingPreferencesWindowApi,
    FileWindowApi,
    DirectoryWindowApi,
    RecognitionProfileWindowApi,
    LaunchConfigWindowApi {
  'library.holdings.choosePath'(kind: 'file' | 'directory'): string | null
  'library.holdings.register'(
    work: WorkRef,
    input: { type: 'file' | 'directory'; path: string },
  ): LocalContentRegistrationResult
  'library.holdings.refresh'(work: WorkRef<FileWorkType>): HoldingsRefreshResult
}
