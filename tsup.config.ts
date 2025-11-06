import { defineConfig } from 'tsup'

export default defineConfig([
  {
    name: 'zodiac-os-sdk',
    target: 'es2024',
    format: 'esm',
    sourcemap: true,
    entry: ['./src/index.ts'],
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
