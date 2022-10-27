import module from 'node:module';
import path from 'node:path';
import { rollup, RollupOutput } from 'rollup';
import flatDts from 'rollup-plugin-flat-dts';
import ts from 'rollup-plugin-typescript2';
import typescript from 'typescript';
import { ProjectConfig, ProjectSpec } from '../project-config.js';
import { ProjectEntry } from '../project-entry.js';
import { ProjectRollupOptions, ProjectRollupOptionsSpec } from './project-rollup-options.js';
import { ProjectRollupPlugin$create } from './project-rollup-plugin.impl.js';

/**
 * Rollup configuration of the project.
 */
export class ProjectRollupConfig implements ProjectRollupInit, Required<ProjectRollupInit> {

  /**
   * Gains specified Rollup configuration of the project.
   *
   * Gains {@link @run-z/project-config!ProjectConfig.of project configuration} first.
   *
   * Rollup configuration can be specified by one of:
   *
   * - Rollup configuration instance, which is returned as is.
   * - Rollup initialization options. New Rollup configuration created ion this case.
   *
   * @param spec - Rollup configuration specifier.
   *
   * @returns Promise resolved to Rollup configuration of the project.
   */
  static async of(spec?: ProjectRollupSpec): Promise<ProjectRollupConfig> {
    if (spec instanceof ProjectRollupConfig) {
      return spec;
    }

    const project = await ProjectConfig.of(spec?.project);

    return new ProjectRollupConfig({
      ...spec,
      project,
      options: await ProjectRollupOptions.of(project, spec?.options),
    });
  }

  readonly #project: ProjectConfig;
  readonly #options: ProjectRollupOptions;

  /**
   * Constructs rollup configuration for the project.
   *
   * @param init - Rollup initialization options.
   */
  constructor(init: ProjectRollupInit = {}) {
    const { project = new ProjectConfig(), options = new ProjectRollupOptions(project) } = init;

    this.#project = project;
    this.#options = options;
  }

  /**
   * Configured project.
   */
  get project(): ProjectConfig {
    return this.#project;
  }

  /**
   * Custom Rollup options.
   */
  get options(): ProjectRollupOptions {
    return this.#options;
  }

  /**
   * Configures and runs Rollup.
   *
   * @returns Promise resolved to array of rollup outputs.
   */
  async run(): Promise<RollupOutput[]> {
    const result: RollupOutput[] = [];

    for (const options of await this.toRollupOptions()) {
      const { write } = await rollup(options);
      let { output = [] } = options;

      if (!Array.isArray(output)) {
        output = [output];
      }

      await Promise.all(
        output.map(async output => {
          result.push(await write(output));
        }),
      );
    }

    return result;
  }

  /**
   * Customizes Rollup options.
   *
   * @returns Promise resolved to customized Rollup options.
   */
  async toRollupOptions(): Promise<ProjectRollupOptions> {
    const baseOptions = await this.#createRollupOptions();

    return await baseOptions.extend(...this.options);
  }

  async #createRollupOptions(): Promise<ProjectRollupOptions> {
    const { sourceDir } = this.#project;
    const output = await this.#project.output;
    const { distDir, cacheDir } = output;
    const entries = await this.#project.entries;
    const mainEntry = await this.#project.mainEntry;
    const chunksByDir: [string, string][] = [...entries].map(([name, entry]) => {
      const entryDir = path.dirname(path.resolve(sourceDir, entry.sourceFile));

      return [`${entryDir}/${path.sep}`, `_${name}.js`];
    });

    const { tsconfig, compilerOptions, tscOptions } = this.project.typescript;

    return new ProjectRollupOptions(this.project, {
      input: Object.fromEntries(
        [...entries].map(([name, entry]) => [name, path.resolve(sourceDir, entry.sourceFile)]),
      ),
      plugins: [
        ProjectRollupPlugin$create(this),
        ts({
          typescript,
          tsconfig,
          tsconfigOverride: compilerOptions,
          cacheRoot: path.join(cacheDir, 'rts2'),
        }),
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
            compilerOptions: {
              ...tscOptions,
              declarationMap: true,
            },
            lib: true,
            file: this.#dtsName(distDir, mainEntry),
            entries: Object.fromEntries(
              [...entries]
                .filter(item => item[1] !== mainEntry)
                .map(([name, entry]) => [name, { file: this.#dtsName(distDir, entry) }]),
            ),
          }),
        ],
      },
    });
  }

  #dtsName(distDir: string, entry: ProjectEntry): string {
    const projectExport = entry.toExport();

    if (projectExport) {
      // Try to extract `.d.ts` file name from corresponding export condition.
      const types = projectExport.withConditions('types');

      if (types) {
        return path.relative(distDir, types);
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
          id = id.slice(0, slashIdx);
        }
      }

      return externals.has(id);
    };
  }

}

/**
 * {@link ProjectRollupConfig.of Specifier} of Rollup configuration of the project.
 *
 * @typeParam TProject - Type of project configuration specifier.
 */
export type ProjectRollupSpec<TProject extends ProjectSpec = ProjectSpec> =
  | ProjectRollupConfig
  | ProjectRollupInit<TProject>
  | undefined;

/**
 * Rollup initialization options.
 *
 * @typeParam TProject - Type of project configuration specifier.
 */
export interface ProjectRollupInit<
  TProject extends ProjectSpec = ProjectConfig,
  TOptions extends ProjectRollupOptionsSpec = ProjectRollupOptions,
> {
  /**
   * Configured project {@link @run-z/project-config!ProjectConfig.of specifier}.
   */
  readonly project?: TProject;

  /**
   * Custom Rollup options {@link ProjectRollupOptions.of specifier}.
   */
  readonly options?: TOptions;
}
