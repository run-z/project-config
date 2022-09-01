import path from 'node:path';
import process from 'node:process';
import { PackageJson } from './package/package-json.js';
import { ProjectEntry } from './project-entry.js';
import { ProjectExport } from './project-export.js';
import { ProjectTypescript, ProjectTypescriptInit } from './typescript/project-typescript.js';

/**
 * Project configuration.
 */
export class ProjectConfig implements ProjectInit, Required<ProjectInit> {

  readonly #rootDir: string;
  readonly #sourceDir: string;
  readonly #distDir: string;
  readonly #buildDir: string;
  readonly #typescript: ProjectTypescript;
  #packageJson?: PackageJson;
  #exports?: Promise<ReadonlyMap<string, ProjectExport>>;
  #mainEntry?: Promise<ProjectEntry>;

  /**
   * Constructs project configuration.
   *
   * @param init - Project initialization options.
   */
  constructor(init: ProjectInit = {}) {
    const {
      rootDir = process.cwd(),
      sourceDir = 'src',
      distDir = 'dist',
      buildDir = 'target',
      typescript,
    } = init;

    this.#rootDir = path.resolve(rootDir);
    this.#sourceDir = path.resolve(this.#rootDir, sourceDir);
    this.#distDir = path.resolve(this.#rootDir, distDir);
    this.#buildDir = path.resolve(this.#rootDir, buildDir);
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

  get rootDir(): string {
    return this.#rootDir;
  }

  get sourceDir(): string {
    return this.#sourceDir;
  }

  get buildDir(): string {
    return this.#buildDir;
  }

  get distDir(): string {
    return this.#distDir;
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
        const entry = await ProjectExport.create({ project: this, entryPoint });

        return entry ? ([entry.name, entry] as const) : undefined;
      }),
    );

    return new Map(entries.filter(entry => !!entry) as (readonly [string, ProjectExport])[]);
  }

}

/**
 * Project initialization options.
 */
export interface ProjectInit {
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
   * Distributable files` directory relative to {@link rootDir project root}.
   *
   * @defaultValue `dist`
   */
  readonly distDir?: string | undefined;

  /**
   * Temporal build directory relative to {@link rootDir project root}.
   *
   * @defaultValue `target`.
   */
  readonly buildDir?: string | undefined;

  /**
   * TypeScript initialization options.
   *
   * @defaultValue Loaded from `tsconfig.json`.
   */
  readonly typescript?: ProjectTypescriptInit;
}
