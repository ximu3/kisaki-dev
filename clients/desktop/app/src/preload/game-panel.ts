/** @fileoverview Connects the sandboxed game-panel document to its native endpoint. */

import { connectWindow } from './bridge'

connectWindow('game-panel')
