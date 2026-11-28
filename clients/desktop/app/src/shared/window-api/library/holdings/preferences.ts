import type {
  FilePreferenceChangeByType,
  FilePreferencesByType,
  FileWorkType,
  UsagePreferenceTarget,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { StoredValue } from '@kisaki3/desktop-contracts/operations'
import type { UsageOverride } from '@kisaki3/desktop-contracts/preferences'

export interface HoldingPreferencesWindowApi {
  'library.holdings.preferences'(
    work: WorkRef<FileWorkType>,
    target: UsagePreferenceTarget,
  ): {
    saved: StoredValue<UsageOverride<FilePreferencesByType[FileWorkType]>> | null
    inherited: FilePreferencesByType[FileWorkType]
  }
  'library.holdings.updatePreferences'(
    work: WorkRef<FileWorkType>,
    target: UsagePreferenceTarget,
    input: FilePreferenceChangeByType[FileWorkType],
  ): void
}
