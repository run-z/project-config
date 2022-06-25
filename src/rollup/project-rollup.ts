import module from 'node:module';
import path from 'node:path';
import { RollupOptions } from 'rollup';
import flatDts from 'rollup-plugin-flat-dts';
import sourcemaps from 'rollup-plugin-sourcemaps';
import ts from 'rollup-plugin-typescript2';
import typescript from 'typescript';
import { ProjectConfig } from '../project-config.js';

/**
 * Rollup configuration.
 */
export class ProjectRollup {

  readonly #project: ProjectConfig;

  /**
   * Constructs rollup configuration for the project.
   *
   * @param project - Target project configuration.
   */
  constructor(project: ProjectConfig) {
    this.#project = project;
  }

  async build(): Promise<RollupOptions> {

    const { entryFile } = this.#project.sources;
    const { distDir, buildDir, mainFile } = this.#project.targets;
    const mainEntry = this.#entryName(mainFile);
    const tsconfig = await this.#project.sources.tsconfig;

    return {
      input: {
        [mainEntry]: entryFile,
      },
      plugins: [
        ts({
          typescript,
          tsconfig,
          cacheRoot: path.join(buildDir, '.rts2_cache'),
        }),
        sourcemaps(),
      ],
      external: this.#externalModules(),
      output: {
        dir: distDir,
        format: 'esm',
        sourcemap: true,
        entryFileNames: '[name].js',
        plugins: [
          flatDts({
            tsconfig,
            lib: true,
            file: `${mainEntry}.d.ts`,
            compilerOptions: {
              declarationMap: true,
            },
          }),
        ],
      },
    };
  }

  #entryName(filePath: string): string {

    const fileName = path.relative(this.#project.targets.distDir, filePath);
    const fileExt = path.extname(fileName);

    return fileExt ? fileName.slice(0, -fileExt.length) : fileExt;
  }

  #externalModules(): (this: void, id: string) => boolean {

    const {
      dependencies = {},
      devDependencies = {},
      peerDependencies = {},
      optionalDependencies = {},
    } = this.#project.packageJson.raw;

    const externals = new Set([
      ...module.builtinModules,
      ...Object.keys(dependencies),
      ...Object.keys(devDependencies),
      ...Object.keys(peerDependencies),
      ...Object.keys(optionalDependencies),
    ]);

    return id => {
      if (id.startsWith('node:')) {
        // Built-in Node.js module.
        return true;
      }

      let slashIdx = id.indexOf('/');

      if (slashIdx > 0) {
        if (id.startsWith('@')) {
          // Scoped package.
          // Module name includes one slash.
          slashIdx = id.indexOf('/', slashIdx + 1);
        }
        if (slashIdx > 0) {
          id = id.substr(0, slashIdx);
        }
      }

      return externals.has(id);
    };
  }

}
