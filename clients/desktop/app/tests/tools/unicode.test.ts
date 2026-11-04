/** @fileoverview Verifies the retained Unicode inputs and generated name-index tables agree. */
import { test } from 'vitest'
import { checkUnicodeTables } from '../../tools/generate-unicode'

test('pinned Unicode inputs reproduce the checked-in tables', checkUnicodeTables)
