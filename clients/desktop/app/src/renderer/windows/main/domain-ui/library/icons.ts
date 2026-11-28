import {
  mdiGamepadVariantOutline,
  mdiTelevision,
  mdiThoughtBubbleOutline,
  mdiBookOpenBlankVariantOutline,
  mdiGhostOutline,
  mdiAccountCircleOutline,
  mdiOfficeBuildingOutline,
  mdiFolderOutline,
  mdiTagOutline,
} from '@mdi/js'
import type { EntryType } from '@kisaki3/desktop-contracts/library'

export const catalogIcon = {
  game: mdiGamepadVariantOutline,
  anime: mdiTelevision,
  comic: mdiThoughtBubbleOutline,
  novel: mdiBookOpenBlankVariantOutline,
  character: mdiGhostOutline,
  person: mdiAccountCircleOutline,
  organization: mdiOfficeBuildingOutline,
  collection: mdiFolderOutline,
  tag: mdiTagOutline,
} satisfies Record<EntryType | 'collection' | 'tag', string>
