// Drizzle Kit reads the same tables as the application. Preference defaults do not enter DDL.
export * from '../../src/main/infrastructure/database/schema'

import { createPreferencesTable } from '../../src/main/infrastructure/database/schema/preferences'
import { getPreferenceDefaults } from '../../src/main/features/preferences/defaults'

/**
 * Preference singleton used by Kit; injected values configure codecs without adding platform
 * defaults to DDL.
 */
export const preferences = createPreferencesTable(getPreferenceDefaults('win32', []))
