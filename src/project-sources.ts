import fs from 'node:fs/promises';
import path from 'node:path';
import { ProjectConfig } from './project-config.js';

/**
 * Source files configuration.
 */
export class ProjectSources implements ProjectSourcesInit, Required<ProjectSourcesInit> {

  readonly #project: ProjectConfig;
  readonly #dir: string;
  readonly #entryFile: string;
  readonly #rawTsconfig: string | PromiseLike<string> | undefined;
  #tsconfig?: Promise<string>;

  /**
   * Constructs source files configuration for the `project`.
   *
   * @param project - Target project configuration.
   * @param init - Source files initialization options.
   */
  constructor(project: ProjectConfig, init: ProjectSourcesInit = {}) {
    this.#project = project;

    const { dir = 'src', entryFile = 'mod.ts', tsconfig } = init;

    this.#dir = path.resolve(project.rootDir, dir);
    this.#entryFile = path.join(this.#dir, entryFile);
    this.#rawTsconfig = tsconfig;

    path.resolve();
  }

  get dir(): string {
    return this.#dir;
  }

  get entryFile(): string {
    return this.#entryFile;
  }

  get tsconfig(): Promise<string> {
    if (this.#tsconfig) {
      return this.#tsconfig;
    }

    return this.#tsconfig = this.#findTsconfig();
  }

  async #findTsconfig(): Promise<string> {
    if (this.#rawTsconfig) {
      return path.resolve(this.#project.rootDir, await this.#rawTsconfig);
    }

    const mainTsconfig = path.resolve(this.#project.rootDir, 'tsconfig.main.json');
    const stat = await fs.stat(mainTsconfig);

    if (!stat.isFile()) {
      return path.resolve(this.#project.rootDir, 'tsconfig.json');
    }

    return mainTsconfig;
  }

}

/**
 * Source files initialization options.
 */
export interface ProjectSourcesInit {

  /**
   * Root source files directory relative to {@link ProjectInit.rootDir project root}.
   *
   * Defaults to `src`.
   */
  readonly dir?: string | undefined;

  /**
   * Entry file name relative to {@link dir source files directory}.
   *
   * Defaults to `mod.ts`.
   */
  readonly entryFile?: string | undefined;

  /**
   * Path to typescript configuration file relative to {@link ProjectInit.rootDir project root}.
   *
   * Defaults to `tsconfig.main.json` when exists, `tsconfig.json` otherwise.
   */
  readonly tsconfig?: string | PromiseLike<string> | undefined;

}
