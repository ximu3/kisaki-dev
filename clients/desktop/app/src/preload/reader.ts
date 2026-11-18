/** @fileoverview Connects the sandboxed reader document to its native endpoint. */

import { connectWindow } from './bridge'

connectWindow('reader')
