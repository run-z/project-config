import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { ProjectJestSpec } from './jest/project-jest-config.js';
import { PackageJson } from './package/package-json.js';
import { ProjectEntry } from './project-entry.js';
import { ProjectExport } from './project-export.js';
import { ProjectOutput, ProjectOutputInit } from './project-output.js';
import { ProjectRollupSpec } from './rollup/project-rollup-config.js';
import { ProjectTypescript, ProjectTypescriptInit } from './typescript/project-typescript.js';

/**
 * Project configuration.
 */
export class ProjectConfig implements ProjectInit {

  /**
   * Loads project configuration from specified module.
   *
   * The default export of target ESM module treated as {@link ProjectConfig.of project specifier}, i.e. either as
   * project configuration instance, or its initialization options.
   *
   * If no configuration module found, then new project configuration created.
   *
   * @param url - Configuration module specifier relative to current working dir. `./project.config.js` by default.
   *
   * @returns Promise resolved to project configuration.
   */
  static async load(url = './project.config.js'): Promise<ProjectConfig> {
    return this.of(await loadConfig(process.cwd(), url, {}));
  }

  /**
   * Gains specified project configuration.
   *
   * Project configuration can be specified by one of:
   *
   * - Project configuration instance, which is returned as is.
   * - Project initialization options. New project configuration created in this case.
   * - Nothing to create default configuration.
   *
   * @param spec - Project configuration specifier.
   *
   * @returns Project configuration instance.
   */
  static of(spec?: ProjectSpec): ProjectConfig {
    if (spec instanceof ProjectConfig) {
      return spec;
    }

    return new ProjectConfig(spec);
  }

  readonly #tools: ProjectToolsInit;
  readonly #rootDir: string;
  readonly #sourceDir: string;
  readonly #typescript: ProjectTypescript;
  readonly #outInit: ProjectOutputInit;
  #output?: Promise<ProjectOutput>;
  #packageJson?: PackageJson;
  #exports?: Promise<ReadonlyMap<string, ProjectExport>>;
  #mainEntry?: Promise<ProjectEntry>;

  /**
   * Constructs project configuration.
   *
   * @param init - Project initialization options.
   */
  constructor(init: ProjectInit = {}) {
    const { tools = {}, rootDir = process.cwd(), sourceDir = 'src', typescript } = init;

    this.#tools = tools;
    this.#rootDir = path.resolve(rootDir);
    this.#sourceDir = path.resolve(rootDir, sourceDir);
    this.#typescript = new ProjectTypescript(this, typescript);
    this.#outInit = init;
  }

  /**
   * A reference to itself.
   *
   * Allows to use project configuration instance as initialization options.
   */
  get project(): this {
    return this;
  }

  get tools(): ProjectToolsInit {
    return this.#tools;
  }

  /**
   * Root project directory.
   */
  get rootDir(): string {
    return this.#rootDir;
  }

  /**
   * Root source files directory.
   */
  get sourceDir(): string {
    return this.#sourceDir;
  }

  /**
   * Promise resolved to project output configuration.
   */
  get output(): Promise<ProjectOutput> {
    if (!this.#output) {
      this.#output = ProjectOutput.create(this, this.#outInit);
    }

    return this.#output;
  }

  /**
   * `package.json` contents.
   */
  get packageJson(): PackageJson {
    return (this.#packageJson ||= new PackageJson(this));
  }

  /**
   * TypeScript configuration of the project.
   */
  get typescript(): ProjectTypescript {
    return this.#typescript;
  }

  /**
   * Promise resolved to the main entry of the project.
   */
  get mainEntry(): Promise<ProjectEntry> {
    if (!this.#mainEntry) {
      this.#mainEntry = this.#findMainEntry();
    }

    return this.#mainEntry;
  }

  async #findMainEntry(): Promise<ProjectEntry> {
    const entries = await this.entries;

    for (const entry of entries.values()) {
      if (entry.isMain) {
        return entry;
      }
    }

    throw new ReferenceError('No main entry');
  }

  /**
   * Promise resolved to project entries map with their {@link ProjectEntry.name names} as keys.
   */
  get entries(): Promise<ReadonlyMap<string, ProjectEntry>> {
    return this.exports;
  }

  /**
   * Promise resolved to project exports map with their {@link ProjectEntry.name names} as keys.
   */
  get exports(): Promise<ReadonlyMap<string, ProjectExport>> {
    if (!this.#exports) {
      this.#exports = this.#loadExports();
    }

    return this.#exports;
  }

  /**
   * Loads arbitrary configuration represented as ESM module.
   *
   * The module has to export configuration as default export.
   *
   * @param url - Configuration module specifier relative to {@link rootDir project root}.
   * @param defaultConfig - Default configuration used when module not found.
   *
   * @returns Promise resolved to loaded configuration, or to `undefined` if no configuration file found.
   *
   * @throws When module not found and no default configuration provided.
   */
  async loadConfig<TConfig>(url: string, defaultConfig?: TConfig): Promise<TConfig> {
    return await loadConfig(this.rootDir, url, defaultConfig);
  }

  async #loadExports(): Promise<ReadonlyMap<string, ProjectExport>> {
    const entries = await Promise.all(
      [...this.packageJson.entryPoints.values()].map(async entryPoint => {
        const entry = await ProjectExport.create(this, { entryPoint });

        return entry ? ([entry.name, entry] as const) : undefined;
      }),
    );

    return new Map(entries.filter(entry => !!entry) as (readonly [string, ProjectExport])[]);
  }

}

/**
 * Project configuration {@link ProjectConfig.of specifier}.
 */
export type ProjectSpec = ProjectConfig | ProjectInit | undefined;

/**
 * Project initialization options.
 */
export interface ProjectInit extends ProjectOutputInit {
  /**
   * Root project directory.
   *
   * @defaultValue current working directory.
   */
  readonly rootDir?: string | undefined;

  /**
   * Root source files directory relative to {@link rootDir project root}.
   *
   * @defaultValue `src`.
   */
  readonly sourceDir?: string | undefined;

  /**
   * TypeScript initialization options.
   *
   * @defaultValue Loaded from `tsconfig.json`.
   */
  readonly typescript?: ProjectTypescriptInit;

  /**
   * Initializers of this project's development tools.
   */
  readonly tools?: ProjectToolsInit | undefined;
}

/**
 * Initializers of project's development tools.
 */
export interface ProjectToolsInit {
  /**
   * {@link @run-z/project-config/jest!ProjectJestConfig.of Specifier} of Jest configuration of the project.
   */
  readonly jest?: ProjectJestSpec;

  /**
   * {@link @run-z/project-config/rollup!ProjectRollupConfig.of Specifier} of Rollup configuration of the project.
   */
  readonly rollup?: ProjectRollupSpec;
}

async function loadConfig<TConfig>(
  rootDir: string,
  url: string,
  defaultConfig?: TConfig,
): Promise<TConfig> {
  if (url.startsWith('./') || url.startsWith('../')) {
    url = `${pathToFileURL(rootDir)}/${url}`;
  }

  try {
    const configModule: { default: TConfig } = await import(url);

    return configModule.default;
  } catch (error) {
    if (
      defaultConfig !== undefined
      && error instanceof Error
      && (error as unknown as { code: string }).code === 'ERR_MODULE_NOT_FOUND'
    ) {
      // No configuration module found.
      return defaultConfig;
    }

    throw error;
  }
}
