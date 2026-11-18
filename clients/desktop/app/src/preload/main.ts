/** @fileoverview Connects the sandboxed main document to its native endpoint. */

import { connectWindow } from './bridge'

connectWindow('main')
