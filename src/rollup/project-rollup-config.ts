import deepmerge from 'deepmerge';
import module from 'node:module';
import path from 'node:path';
import type { RollupOptions, RollupOutput } from 'rollup';
import { ProjectEntry } from '../package/project-entry.js';
import { ProjectPackage } from '../package/project-package.js';
import { ProjectConfig, ProjectSpec } from '../project-config.js';
import { ProjectTypescriptConfig } from '../typescript/project-typescript-config.js';
import {
  ProjectRollupPlugin$create,
  ProjectRollupPlugin$get,
} from './project-rollup-plugin.impl.js';

function ProjectRollupConfig$create(
  project: ProjectConfig,
  options?: RollupOptions | readonly RollupOptions[],
): ProjectRollupConfig {
  const { rollup } = project.tools;

  if (rollup) {
    const config =
      rollup instanceof ProjectRollupConfig ? rollup : new ProjectRollupConfig(project, rollup);

    config.extendOptions(...RollupOptions$asArray(options));

    return config;
  }

  return new ProjectRollupConfig(project, options);
}

/**
 * Rollup configuration of the project.
 */
export class ProjectRollupConfig {

  /**
   * Gains specified Rollup configuration of the project.
   *
   * Respects {@link ProjectToolsInit#rollup base configuration}.
   *
   * Rollup configuration can be specified by one of:
   *
   * - Rollup configuration instance, which is returned as is.
   * - Custom Rollup initialization options to apply on top of autogenerated ones.
   *   New Rollup configuration created in this case.
   * - Nothing to create default configuration.
   *
   * @param project - Configured project {@link ProjectConfig.of specifier}.
   * @param spec - Rollup configuration specifier.
   *
   * @returns Rollup configuration of the `project`.
   */
  static of(project?: ProjectSpec, spec: ProjectRollupSpec = {}): ProjectRollupConfig {
    if (spec instanceof ProjectRollupConfig) {
      return spec;
    }

    const projectConfig = ProjectConfig.of(project);

    return spec
      ? ProjectRollupConfig$create(projectConfig, spec)
      : projectConfig.get(ProjectRollupConfig$create);
  }

  readonly #project: ProjectConfig;
  #rollup?: Promise<typeof import('rollup')>;
  #autogenerated = true;
  #customOptions: () => RollupOptions[] | Promise<RollupOptions[]>;
  #options?: Promise<RollupOptions[]>;

  /**
   * Constructs rollup configuration for the project.
   *
   * @param project - Configured project {@link ProjectConfig.of specifier}.
   * @param options - Custom Rollup options to apply on top of autogenerated ones.
   */
  constructor(project?: ProjectSpec, options: RollupOptions | readonly RollupOptions[] = []) {
    this.#project = ProjectConfig.of(project);
    this.#customOptions = Array.isArray(options) ? () => options.slice() : () => [options];
  }

  #rebuild(): this {
    this.#options = undefined;

    return this;
  }

  /**
   * Configured project.
   */
  get project(): ProjectConfig {
    return this.#project;
  }

  /**
   * Rollup API instance.
   */
  get rollup(): Promise<typeof import('rollup')> {
    return (this.#rollup ??= import('rollup').then(rollup => rollup.default || rollup));
  }

  /**
   * Whether options generated automatically prior to applying custom ones.
   *
   * `true` by default.
   */
  get autogenerated(): boolean {
    return this.#autogenerated;
  }

  /**
   * Promise resolved to array of customized Rollup options.
   */
  get options(): Promise<RollupOptions[]> {
    return (this.#options ||= this.#toOptions());
  }

  /**
   * Replaces Rollup options with custom ones.
   *
   * Clears custom options, and prevents {@link autogenerated automatic generation}.
   *
   * @param options - Rollup options to apply.
   *
   * @returns `this` instance.
   */
  replaceOptions(...options: RollupOptions[]): this {
    this.#autogenerated = false;
    this.#customOptions = () => options;

    return this.#rebuild();
  }

  /**
   * Replaces custom Rollup options with autogenerated ones.
   *
   * Clears custom options, and forces {@link autogenerated automatic generation}.
   *
   * @param options - Rollup options extending autogenerated ones.
   *
   * @returns `this` instance.
   */
  autogenerateOptions(...options: RollupOptions[]): this {
    this.#autogenerated = true;
    this.#customOptions = () => options;

    return this.#rebuild();
  }

  /**
   * Extends Rollup options.
   *
   * If extension created by {@link ProjectRollupConfig#options Rollup configuration}, it will be used as is.
   * Otherwise, new custom options instance will be created with options merged.
   *
   * @param extensions - Rollup options extending previous ones.
   *
   * @returns `this` instance.
   */
  extendOptions(...extensions: RollupOptions[]): this {
    if (extensions.length) {
      const prevOptions = this.#customOptions;

      this.#customOptions = async () => await RollupOptions$extendAll(await prevOptions(), extensions);

      return this.#rebuild();
    }

    return this;
  }

  /**
   * Configures and runs Rollup.
   *
   * @returns Promise resolved to array of rollup outputs.
   */
  async run(): Promise<RollupOutput[]> {
    const { rollup } = await this.rollup;
    const result: RollupOutput[] = [];

    for (const options of await this.options) {
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
   * @returns Promise resolved to array of customized Rollup options.
   */
  async #toOptions(): Promise<RollupOptions[]> {
    const customOptions = await this.#customOptions();

    if (!this.autogenerated) {
      // Ignore autogenerated options.
      return customOptions;
    }

    const autogeneratedOptions = await this.#autogenerateOptions();

    // Extend autogenerated options with custom ones.
    return await RollupOptions$extendAll([autogeneratedOptions], customOptions);
  }

  async #autogenerateOptions(): Promise<RollupOptions> {
    const { sourceDir } = this.project;
    const pkg = ProjectPackage.of(this.project);
    const output = await this.#project.output;
    const { distDir, cacheDir } = output;
    const entries = await pkg.entries;
    const mainEntry = await pkg.mainEntry;
    const chunksByDir: [string, string][] = [...entries].map(([name, entry]) => {
      const entryDir = path.dirname(path.resolve(sourceDir, entry.sourceFile));

      return [`${entryDir}/${path.sep}`, `_${name}.js`];
    });

    const tsConfig = ProjectTypescriptConfig.of(this.project);
    const { default: tsPlugin } = await import('rollup-plugin-typescript2');
    const { default: flatDts } = await import('rollup-plugin-flat-dts');

    return {
      input: Object.fromEntries(
        [...entries].map(([name, entry]) => [name, path.resolve(sourceDir, entry.sourceFile)]),
      ),
      plugins: [
        ProjectRollupPlugin$create(this),
        tsPlugin({
          typescript: await tsConfig.typescript,
          tsconfigOverride: await tsConfig.options,
          cacheRoot: path.join(cacheDir, 'rts2'),
        }),
      ],
      external: await this.#externalModules(),
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
            tsconfig: tsConfig.tsconfig || undefined,
            compilerOptions: {
              ...(await tsConfig.tscOptions),
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
    };
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

  async #externalModules(): Promise<(this: void, id: string) => boolean> {
    const pkg = ProjectPackage.of(this.project);
    const {
      dependencies = {},
      devDependencies = {},
      peerDependencies = {},
      optionalDependencies = {},
    } = await pkg.packageJson;

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
 */
export type ProjectRollupSpec =
  | ProjectRollupConfig
  | RollupOptions
  | readonly RollupOptions[]
  | undefined;

function RollupOptions$asArray(
  options: RollupOptions | readonly RollupOptions[] | undefined,
): readonly RollupOptions[] {
  return options ? (Array.isArray(options) ? options : [options]) : [];
}

async function RollupOptions$extendAll(
  base: RollupOptions[],
  extensions: RollupOptions[],
): Promise<RollupOptions[]> {
  if (!extensions.length) {
    return base;
  }
  if (!base.length) {
    return extensions;
  }

  const length = Math.min(base.length, extensions.length);
  const result: RollupOptions[] = [];

  for (let i = 0; i < length; ++i) {
    if (i >= extensions.length) {
      result.push(base[i]);
    } else if (i >= base.length) {
      result.push(extensions[i]);
    } else {
      result.push(await RollupOptions$extend(base[i], extensions[i]));
    }
  }

  return result;
}

async function RollupOptions$extend(
  base: RollupOptions,
  extension: RollupOptions,
): Promise<RollupOptions> {
  if (await ProjectRollupPlugin$get(extension)) {
    return extension;
  }

  return deepmerge(base, extension, {
    arrayMerge(target: unknown[], source: unknown[]): unknown[] {
      // TODO Merge Rollup plugins?
      return [...target, ...source];
    },
  });
}
