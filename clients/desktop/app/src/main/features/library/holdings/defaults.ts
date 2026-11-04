/** @fileoverview Chooses initial directory discovery and file association behavior. */

import type {
  DirectoryDiscoveryDefinition,
  FileAssociationInput,
  FileAssociationMode,
} from '@kisaki3/desktop-contracts/library'

/** Return the complete initial discovery value; callers do not silently substitute this for a broken saved definition. */
export function getDirectoryDiscoveryDefaults(): DirectoryDiscoveryDefinition {
  return { maxDepth: null, include: [], exclude: [] }
}

/** Explicit empty association input is a manual decision, not a failed automatic match. */
export function initialFileAssociationMode(
  associations: readonly FileAssociationInput[] | undefined,
): FileAssociationMode {
  return associations === undefined ? 'automatic' : 'manual'
}
