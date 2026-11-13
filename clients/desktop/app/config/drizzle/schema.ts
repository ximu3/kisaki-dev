// Drizzle Kit reads the same tables as the application. Preference defaults do not enter DDL.
export * from '../../src/main/infrastructure/database/schema'

import { createPreferencesTable } from '../../src/main/infrastructure/database/schema/preferences'
import { getPreferenceDefaults } from '../../src/main/features/preferences/defaults'

export const preferences = createPreferencesTable(getPreferenceDefaults('win32', []))
