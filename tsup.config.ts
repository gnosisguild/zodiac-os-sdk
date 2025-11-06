import { defineConfig } from 'tsup'

export default defineConfig([
  {
    name: 'zodiac-os-sdk',
    target: 'es2020',
    format: ['cjs', 'esm'],
    sourcemap: true,
    entry: ['./src/index.ts'],
    cjsInterop: true,
    clean: true,
    dts: {
      resolve: true,
    },
  },
  {
    name: 'cli',
    target: 'node24',
    format: 'cjs',
    entry: ['./cli/index.ts'],
    outDir: 'lib',
  },
])
