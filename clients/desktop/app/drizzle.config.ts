import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './config/drizzle/schema.ts',
  out: './drizzle',
})
