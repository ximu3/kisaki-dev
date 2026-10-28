/**
 * @fileoverview Installs the reader window's isolated controls and renderer readiness
 * bridge.
 */

import { exposeWindowControls } from './bridge'

exposeWindowControls('reader')
