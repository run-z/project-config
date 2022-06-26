import module from 'node:module';
import path from 'node:path';
import { RollupOptions } from 'rollup';
import flatDts from 'rollup-plugin-flat-dts';
import sourcemaps from 'rollup-plugin-sourcemaps';
import ts from 'rollup-plugin-typescript2';
import typescript from 'typescript';
import { ProjectConfig } from '../project-config.js';
import { ProjectEntry } from '../project-entry.js';

/**
 * Rollup configuration.
 */
export class ProjectRollup {

  /**
   * Configures and builds Rollup options.
   *
   * @param init - Rollup initialization options.
   *
   * @returns A promise resolved to Rollup options.
   */
  static async build(this: void, init?: ProjectRollupInit): Promise<RollupOptions> {
    return await new ProjectRollup(init).build();
  }

  readonly #project: ProjectConfig;

  /**
   * Constructs rollup configuration for the project.
   *
   * @param init - Rollup initialization options.
   */
  constructor(init: ProjectRollupInit = {}) {

    const { project = new ProjectConfig() } = init;

    this.#project = project;
  }

  /**
   * Builds Rollup options.
   *
   * @returns A promise resolved to Rollup options.
   */
  async build(): Promise<RollupOptions> {

    const { sourceDir, distDir, buildDir } = this.#project;
    const entries = await this.#project.entries;
    const mainEntry = await this.#project.mainEntry;
    const tsconfig = 'tsconfig.json';
    const chunksByDir: [string, string][] = ([...entries].map(([name, entry]) => {

      const entryDir = path.dirname(path.resolve(sourceDir, entry.sourceFile));

      return [`${entryDir}/${path.sep}`, `_${name}.js`];
    }));

    return {
      input: Object.fromEntries(
          [...entries].map(([name, entry]) => [name, path.resolve(sourceDir, entry.sourceFile)]),
      ),
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
        entryFileNames: chunk => entries.get(chunk.name)?.distFile || '',
        manualChunks: (moduleId, moduleApi) => {

          const moduleInfo = moduleApi.getModuleInfo(moduleId);

          if (!moduleInfo || moduleInfo.isExternal) {
            return null;
          }

          for (const [dir, chunk] of chunksByDir) {
            if (moduleId.startsWith(dir)) {
              return chunk;
            }
          }

          return null;
        },
        plugins: [
          flatDts({
            tsconfig,
            lib: true,
            file: this.#dtsName(mainEntry),
            compilerOptions: {
              declarationMap: true,
            },
            entries: Object.fromEntries(
                ([...entries]
                    .filter(item => item[1] !== mainEntry)
                    .map(([name, entry]) => [name, { file: this.#dtsName(entry) }])),
            ),
          }),
        ],
      },
    };
  }

  #dtsName(entry: ProjectEntry): string {

    const projectExport = entry.toExport();

    if (projectExport) {
      // Try to extract `.d.ts` file name from corresponding export condition.
      const types = projectExport.withConditions('types');

      if (types) {
        return path.relative(this.#project.distDir, types);
      }
    }

    // Fall back to entry name with `.d.ts` extension.
    return `${entry.name}.d.ts`;
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

/**
 * Rollup initialization options.
 */
export interface ProjectRollupInit {

  /**
   * Project configuration.
   *
   * New one will be constructed if omitted.
   */
  readonly project?: ProjectConfig;

}
