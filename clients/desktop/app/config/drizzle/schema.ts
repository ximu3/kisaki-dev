import { createPreferencesTable } from '../../src/main/infrastructure/database/schema/preferences'
import { getPreferenceDefaults } from '../../src/main/features/preferences/defaults'

export * from '../../src/main/infrastructure/database/schema'

const migrationCodecDefaults = getPreferenceDefaults('win32', [])
export const preferences = createPreferencesTable(migrationCodecDefaults)
