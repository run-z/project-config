import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { ProjectOutput, ProjectOutputInit } from './project-output.js';
import { ProjectToolsInit } from './project-tools-init.js';

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
  readonly #outInit: ProjectOutputInit;
  readonly #values = new Map<object, unknown>();
  #output?: Promise<ProjectOutput>;

  /**
   * Constructs project configuration.
   *
   * @param init - Project initialization options.
   */
  constructor(init: ProjectInit = {}) {
    const { tools = {}, rootDir = process.cwd(), sourceDir = 'src' } = init;

    this.#tools = tools;
    this.#rootDir = path.resolve(rootDir);
    this.#sourceDir = path.resolve(rootDir, sourceDir);
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
   * Gains value of the given `kind` or creates one if not yet exists.
   *
   * Caches the value once constructed.
   *
   * @param kind - Kind of values to gain. This function is used as a cache key. It is called to create
   *
   * @returns Gained value.
   */
  get<T>(kind: (this: void, project: ProjectConfig) => T): T {
    if (this.#values.has(kind)) {
      return this.#values.get(kind) as T;
    }

    const created = kind(this);

    this.#values.set(kind, created);

    return created;
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
   * Development tools initializers for the project.
   */
  readonly tools?: ProjectToolsInit | undefined;
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
