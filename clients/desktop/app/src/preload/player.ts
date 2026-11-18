/** @fileoverview Connects the sandboxed player document to its native endpoint. */

import { connectWindow } from './bridge'

connectWindow('player')
