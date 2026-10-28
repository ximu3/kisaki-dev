/** @fileoverview Checks the child environment supplied by the engineering command runner. */

import assert from 'node:assert/strict'

assert.equal(process.env.KISAKI_COMMAND_REMOVED, undefined)
assert.equal(process.env.KISAKI_COMMAND_RETAINED, 'child-value')
