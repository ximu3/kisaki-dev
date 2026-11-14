import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    minify: false,
    lib: {
      entry: {
        entry: 'src/main/entry.ts',
        database: '../../../src/main/infrastructure/database/executor/worker.ts',
      },
      formats: ['es'],
      /** Keeps the compiled Node program at its declared runtime entry name. */
      fileName: (_format, name) => name + '.js',
    },
    // Bundle the driver's JavaScript; initializeDatabase supplies the deployed nativeBinding path.
    rolldownOptions: { external: [/^node:/, 'electron'] },
  },
  ssr: { target: 'node', noExternal: true },
})
