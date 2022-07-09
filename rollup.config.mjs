import { builtinModules } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'rollup';
import flatDts from 'rollup-plugin-flat-dts';
import sourcemaps from 'rollup-plugin-sourcemaps';
import ts from 'rollup-plugin-typescript2';
import typescript from 'typescript';

const externalModules = new Set(builtinModules);

externalModules.add('typescript');

export default defineConfig({
  input: {
    'project-config': './src/mod.ts',
    'project-config.jest': './src/jest/mod.ts',
    'project-config.rollup': './src/rollup/mod.ts',
  },
  plugins: [
    ts({
      typescript,
      cacheRoot: 'target/.rts2_cache',
    }),
    sourcemaps(),
  ],
  external(id) {
    return id.startsWith('node:') || externalModules.has(id) || id.startsWith('rollup');
  },
  manualChunks(id) {
    if (id.startsWith(path.resolve('src', 'jest'))) {
      return 'project-config.jest';
    }
    if (id.startsWith(path.resolve('src', 'rollup'))) {
      return 'project-config.rollup';
    }

    return 'project-config';
  },
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].js',
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
