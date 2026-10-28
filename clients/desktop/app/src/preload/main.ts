/**
 * @fileoverview Installs the main window's isolated controls and renderer readiness
 * bridge.
 */

import { exposeWindowControls } from './bridge'

exposeWindowControls('main')
