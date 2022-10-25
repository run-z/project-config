import path from 'node:path';
import process from 'node:process';
import { PackageJson } from './package/package-json.js';
import { ProjectEntry } from './project-entry.js';
import { ProjectExport } from './project-export.js';
import { ProjectOutput, ProjectOutputInit } from './project-output.js';
import { ProjectTypescript, ProjectTypescriptInit } from './typescript/project-typescript.js';

/**
 * Project configuration.
 */
export class ProjectConfig implements ProjectInit {

  /**
   * Loads project configuration from the given module if one exists.
   *
   * Target default export of target ESM module contains either {@link ProjectConfig project configuration} instance,
   * or {@link ProjectInit project initialization options}. The latter is used to construct new project configuration.
   *
   * If no configuration module found, then new project configuration constructed.
   *
   * @param url - URL of project configuration module. `project.config.js` by default.
   *
   * @returns Project configuration.
   */
  static async load(url = 'project.config.js'): Promise<ProjectConfig> {
    let config: ProjectInit | undefined;

    try {
      const configModule: { default: ProjectInit } = await import(url);

      config = configModule.default;
    } catch {
      // No project config.
    }

    return config instanceof ProjectConfig ? config : new ProjectConfig();
  }

  readonly #init: ProjectInit;
  readonly #rootDir: string;
  readonly #sourceDir: string;
  readonly #typescript: ProjectTypescript;
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
    this.#init = init;

    const { rootDir = process.cwd(), sourceDir = 'src', typescript } = init;

    this.#rootDir = path.resolve(rootDir);
    this.#sourceDir = path.resolve(rootDir, sourceDir);
    this.#typescript = new ProjectTypescript(this, typescript);
  }

  /**
   * A reference to itself.
   *
   * Allows to use project configuration instance as initialization options.
   */
  get project(): this {
    return this;
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
      this.#output = ProjectOutput.create(this, this.#init);
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
}
