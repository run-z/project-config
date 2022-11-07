import { builtinModules } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'rollup';
import flatDts from 'rollup-plugin-flat-dts';
import ts from 'rollup-plugin-typescript2';
import typescript from 'typescript';

const externalModules = new Set(builtinModules);

externalModules.add('deepmerge');
externalModules.add('typescript');

export default defineConfig({
  input: {
    'project-config': './src/mod.ts',
    'rollup.config': './src/rollup.config.js/main.ts',
  },
  plugins: [
    ts({
      typescript,
      cacheRoot: 'target/.rts2_cache',
    }),
  ],
  external(id) {
    return id.startsWith('node:') || externalModules.has(id) || id.startsWith('rollup');
  },
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].js',
    chunkFileNames: '_[name].js',
    manualChunks(id) {
      if (id.startsWith(path.resolve('src', 'rollup.config.js'))) {
        return 'rollup.config.js';
      }

      return 'project-config';
    },
    plugins: [
      flatDts({
        lib: true,
        file: 'project-config.d.ts',
        compilerOptions: {
          declarationMap: true,
        },
        entries: {
          jest: { file: 'project-config.jest.d.ts' },
          rollup: { file: 'project-config.rollup.d.ts' },
        },
      }),
    ],
  },
});
