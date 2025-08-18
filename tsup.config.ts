import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/core/index.ts',
    react: 'src/react/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'es2018',
  external: ['axios', 'react'],
  outExtension: (ctx) => ({
    js: ctx.format === 'cjs' ? '.cjs' : '.mjs',
  }),
});
