import { createPreferencesTable } from '../../src/main/infrastructure/database/schema/preferences'
import { getPreferenceDefaults } from '../../src/main/features/preferences/defaults'

export * from '../../src/main/infrastructure/database/schema'

// These platform defaults configure the preference codecs. The DDL is shared across platforms.
export const preferences = createPreferencesTable(getPreferenceDefaults('win32', []))
