import deepmerge from 'deepmerge';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  OutputOptions,
  OutputPlugin,
  Plugin,
  PreRenderedChunk,
  RollupOptions,
  RollupOutput,
} from 'rollup';
import type { FlatDts } from 'rollup-plugin-flat-dts';
import type { ProjectEntry } from '../package/project-entry.js';
import { ProjectPackage } from '../package/project-package.js';
import type { ProjectConfig } from '../project-config.js';
import { ProjectDevTool } from '../project-dev-tool.js';
import { ProjectError } from '../project.error.js';
import { ProjectTypescriptConfig } from '../typescript/project-typescript-config.js';
import {
  ProjectRollupPlugin$create,
  ProjectRollupPlugin$get,
} from './project-rollup-plugin.impl.js';

function ProjectRollupConfig$create(project: ProjectConfig): ProjectRollupConfig {
  const { rollup } = project.tools;

  if (!rollup) {
    return new ProjectRollupConfig(project);
  }
  if (rollup instanceof ProjectRollupConfig) {
    return rollup;
  }

  return new ProjectRollupConfig(project).extendOptions(...RollupOptions$asArray(rollup));
}

/**
 * Rollup configuration of the project.
 */
export class ProjectRollupConfig extends ProjectDevTool {

  /**
   * Gains Rollup configuration of the project.
   *
   * Respects {@link ProjectToolsInit#rollup defaults}.
   *
   * @param project - Configured project.
   *
   * @returns Rollup configuration of the `project`.
   */
  static of(project: ProjectConfig): ProjectRollupConfig {
    return project.get(ProjectRollupConfig$create);
  }

  /**
   * Loads Rollup configuration from ESM module.
   *
   * If configuration file found, its options {@link ProjectRollupConfig#replaceOptions replace} the default ones.
   * Default configuration returned otherwise.
   *
   * @param project - Configured project.
   * @param url - Rollup configuration URL relative to project root. Defaults to `./rollup.config.js`.
   *
   * @returns Loaded configuration.
   */
  static async load(
    project: ProjectConfig,
    url = './rollup.config.js',
  ): Promise<ProjectRollupConfig> {
    const config = ProjectRollupConfig.of(project);
    const options: RollupOptions | null = await project.loadConfig(url, null);

    return options ? config.replaceOptions(options) : config;
  }

  #rollup?: Promise<typeof import('rollup')>;
  #autogenerated = true;
  #customOptions: () => RollupOptions[] | Promise<RollupOptions[]>;
  #options?: Promise<RollupOptions[]>;

  /**
   * Constructs rollup configuration for the project.
   *
   * @param project - Configured project.
   */
  constructor(project: ProjectConfig) {
    super(project);
    this.#customOptions = () => [];
  }

  protected override clone(): this {
    const clone = super.clone();

    clone.#rollup = this.#rollup;
    clone.#autogenerated = this.#autogenerated;
    clone.#customOptions = this.#customOptions;

    return clone;
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
   * @returns Updated instance.
   */
  replaceOptions(...options: RollupOptions[]): this {
    const clone = this.clone();

    clone.#autogenerated = false;
    clone.#customOptions = () => options;

    return clone;
  }

  /**
   * Replaces custom Rollup options with autogenerated ones.
   *
   * Clears custom options, and forces {@link autogenerated automatic generation}.
   *
   * @param options - Rollup options extending autogenerated ones.
   *
   * @returns Updated instance.
   */
  autogenerateOptions(...options: RollupOptions[]): this {
    const clone = this.clone();

    clone.#autogenerated = true;
    clone.#customOptions = () => options;

    return clone;
  }

  /**
   * Extends Rollup options.
   *
   * If extension created by {@link ProjectRollupConfig#options Rollup configuration}, it will be used as is.
   * Otherwise, new custom options instance will be created with options merged.
   *
   * @param extensions - Rollup options extending previous ones.
   *
   * @returns Updated instance.
   */
  extendOptions(...extensions: RollupOptions[]): this {
    if (extensions.length) {
      const clone = this.clone();
      const prevOptions = this.#customOptions;

      clone.#customOptions = async () => await RollupOptions$extendAll(await prevOptions(), extensions);

      return clone;
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

    try {
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
    } catch (error) {
      this.#handleError(error);
    }
  }

  #handleError(error: unknown): never {
    if (!isRollupError(error)) {
      throw error;
    }

    const name = error.name || error.cause?.name;
    const nameSection = name ? `${name}: ` : '';
    const pluginSection = error.plugin ? `(plugin ${error.plugin}) ` : '';
    let message = `${pluginSection}${nameSection}${error.message}`;

    message += error.loc
      ? `${error.loc.file || error.id} (${error.loc.line}:${error.loc.column})`
      : error.id;

    if (error.frame) {
      message += `\n${error.frame}`;
    }
    if (error.stack) {
      message += `\n${error.stack}`;
    }

    console.error(error.id, error.loc, error.frame);

    throw new ProjectError(message);
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
    const entries = await pkg.generatedEntries;

    return {
      input: Object.fromEntries(
        await Promise.all(
          [...entries].map(
            async ([name, entry]): Promise<[string, string]> => [
              name,
              path.resolve(sourceDir, await entry.sourceFile),
            ],
          ),
        ),
      ),
      plugins: [
        ProjectRollupPlugin$create(this),
        ...(await this.#createTsPlugin()),
        ...(await this.#createUnbundlePlugin()),
      ],
      output: await this.#createOutputs(),
    };
  }

  async #createTsPlugin(): Promise<Plugin[]> {
    const { default: tsPlugin } = await import('@rollup/plugin-typescript');
    const { cacheDir } = await this.project.output;
    const tsConfig = ProjectTypescriptConfig.of(this.project);
    const { file } = await tsConfig.generatedTsconfig;

    return [
      tsPlugin({
        typescript: await tsConfig.typescript,
        tsconfig: file,
        cacheDir: path.join(cacheDir, 'rts'),
      }),
    ];
  }

  async #createUnbundlePlugin(): Promise<Plugin[]> {
    const { default: unbundle } = await import('rollup-plugin-unbundle');

    return [unbundle()];
  }

  async #createOutputs(): Promise<OutputOptions | OutputOptions[]> {
    const pkg = ProjectPackage.of(this.project);
    const entries = await pkg.generatedEntries;
    let hasESM = false;
    let hasCommonJS = false;

    for (const entry of entries.values()) {
      const distFiles = await entry.distFiles;

      hasESM ||= !!distFiles.esm;
      hasCommonJS ||= !!distFiles.commonJS;

      if (hasESM && hasCommonJS) {
        break;
      }
    }

    if (hasESM && hasCommonJS) {
      return await Promise.all([this.#createOutput('esm', true), this.#createOutput('commonjs')]);
    }
    if (hasCommonJS) {
      return await this.#createOutput('commonjs', true);
    }

    return await this.#createOutput('esm', true);
  }

  async #createOutput(format: 'esm' | 'commonjs', withDts?: boolean): Promise<OutputOptions> {
    const distFilePath = await this.#distFilePath(format);
    const pkg = ProjectPackage.of(this.project);
    const output = await this.project.output;
    const entries = await pkg.generatedEntries;

    return {
      dir: output.distDir,
      format,
      sourcemap: true,
      entryFileNames: await this.#createEntryFileNames(entries, distFilePath),
      // chunkFileNames: `_[name]`,
      // manualChunks: await this.#createManualChunks(entries, distFilePath),
      plugins: withDts ? await this.#createFlatDtsPlugin() : [],
    };
  }

  async #distFilePath(
    format: 'esm' | 'commonjs',
  ): Promise<(entry: ProjectEntry.Generated) => Promise<string>> {
    const output = await this.project.output;
    const { distDir } = output;
    const distFileOf = format === 'esm' ? ProjectEntry$esmDist : ProjectEntry$commonJSDist;

    return async (entry: ProjectEntry.Generated): Promise<string> => {
      const distFile = distFileOf(await entry.distFiles);

      path.relative(distDir, path.resolve(distDir, distFileOf(await entry.distFiles)));

      return distFile;
    };
  }

  async #createEntryFileNames(
    entries: ReadonlyMap<string, ProjectEntry.Generated>,
    distFilePath: (entry: ProjectEntry.Generated) => Promise<string>,
  ): Promise<(chunkInfo: PreRenderedChunk) => string> {
    const distFiles = new Map<string, string>(
      await Promise.all(
        [...entries].map(
          async ([name, entry]): Promise<[string, string]> => [name, await distFilePath(entry)],
        ),
      ),
    );

    return chunk => distFiles.get(chunk.name) || '';
  }

  // async #createManualChunks(
  //   entries: ReadonlyMap<string, ProjectEntry.Generated>,
  //   distFilePath: (entry: ProjectEntry.Generated) => Promise<string>,
  // ): Promise<ManualChunksOption> {
  //   const { sourceDir } = this.project;
  //   const chunksByDir: [string, string][] = await Promise.all(
  //     [...entries.values()].map(async (entry): Promise<[string, string]> => {
  //       const sourceFile = await entry.sourceFile;
  //       const distFile = await distFilePath(entry);
  //       const entryDir = path.dirname(path.resolve(sourceDir, sourceFile));

  //       return [`${entryDir}${path.sep}`, distFile];
  //     }),
  //   );

  //   return (moduleId, moduleApi) => {
  //     const moduleInfo = moduleApi.getModuleInfo(moduleId);

  //     if (!moduleInfo || moduleInfo.isExternal) {
  //       return null;
  //     }

  //     let result: string | null = null;

  //     for (const [dir, chunk] of chunksByDir) {
  //       if (moduleId.startsWith(dir)) {
  //         if (!result || chunk.length > result.length) {
  //           // Select the longest match.
  //           result = chunk;
  //         }
  //       }
  //     }

  //     return result;
  //   };
  // }

  async #createFlatDtsPlugin(): Promise<OutputPlugin[]> {
    const { project } = this;
    const pkg = ProjectPackage.of(project);
    const packageInfo = await pkg.packageInfo;
    const moduleName = packageInfo.name;
    const mainEntry = await pkg.mainEntry;
    const generatedMainEntry = await mainEntry.toGenerated();

    if (!generatedMainEntry) {
      return [];
    }

    const tsConfig = ProjectTypescriptConfig.of(project);
    const entries = await pkg.generatedEntries;
    const { default: flatDts } = await import('rollup-plugin-flat-dts');
    const tsconfigRef = await tsConfig.generatedTsconfig;

    return [
      flatDts({
        tsconfig: tsconfigRef.file,
        compilerOptions: {
          declarationMap: true,
        },
        lib: true,
        file: await generatedMainEntry.typesFile,
        moduleName,
        entries: Object.fromEntries(
          await Promise.all(
            [...entries.values()]
              .filter(entry => entry !== generatedMainEntry)
              .map(async entry => await this.#dtsEntry(entry)),
          ),
        ),
        internal: ['**/impl/**', '**/*.impl'],
      }),
    ];
  }

  async #dtsEntry(entry: ProjectEntry.Generated): Promise<readonly [string, FlatDts.EntryDecl]> {
    const { sourceDir } = this.project;
    const sourceFile = path.resolve(sourceDir, await entry.sourceFile);
    const entrySourceDir = path.dirname(sourceFile);
    const sourceURL = pathToFileURL(sourceDir).href + '/';
    const entrySourceURL = pathToFileURL(entrySourceDir).href;

    if (!entrySourceURL.startsWith(sourceURL)) {
      throw new TypeError(
        `Source file "${sourceFile}" is outside root source directory "${sourceDir}"`,
      );
    }

    return [
      entrySourceURL.slice(sourceURL.length),
      {
        as: entry.path.slice(2) /* remove `./` prefix */,
        file: await entry.typesFile,
      },
    ];
  }

}

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

function ProjectEntry$esmDist({ esm, commonJS }: ProjectEntry.DistFiles): string {
  if (esm) {
    return esm;
  }

  const extIdx = commonJS!.lastIndexOf('.');

  return extIdx > 0 ? `${commonJS!.slice(0, extIdx)}.mjs` : `${commonJS}.mjs`;
}

function ProjectEntry$commonJSDist({ esm, commonJS }: ProjectEntry.DistFiles): string {
  if (commonJS) {
    return commonJS;
  }

  const extIdx = esm!.lastIndexOf('.');

  return extIdx > 0 ? `${esm!.slice(0, extIdx)}.cjs` : `${esm}.cjs`;
}

interface RollupError extends Error {
  readonly id?: string;
  readonly cause?: Error;
  readonly plugin?: string;
  readonly loc?: {
    readonly file?: string;
    readonly line: number;
    readonly column: number;
  };
  readonly frame?: string;
}

function isRollupError(error: unknown): error is RollupError {
  if (!(error && typeof error === 'object')) {
    return false;
  }

  const rollupError = error as RollupError;

  return !rollupError.plugin || !!rollupError.id || !!rollupError.loc || !!rollupError.frame;
}
