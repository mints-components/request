import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'es2018',
  external: ['axios'],
  outExtension: (ctx) => ({
    js: ctx.format === 'cjs' ? '.cjs' : '.mjs',
  }),
});
