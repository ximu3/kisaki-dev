/** @fileoverview Defines the SQLite schema used to generate the desktop migration chain. */

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './config/drizzle/schema.ts',
})
