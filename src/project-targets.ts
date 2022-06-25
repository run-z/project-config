import path from 'node:path';
import { ProjectConfig } from './project-config.js';

/**
 * Build targets configuration.
 */
export class ProjectTargets implements ProjectTargetsInit, Required<ProjectTargetsInit> {

  readonly #project: ProjectConfig;
  readonly #distDir: string;
  readonly #buildDir: string;
  readonly #rawMainFile: string | undefined;
  #mainFile?: string;

  /**
   * Constructs build targets configuration for the `project`.
   *
   * @param project - Target project configuration.
   * @param init - Build targets initialization options.
   */
  constructor(project: ProjectConfig, init: ProjectTargetsInit = {}) {
    this.#project = project;

    const { distDir = 'dist', buildDir = 'target', mainFile } = init;

    this.#distDir = path.resolve(project.rootDir, distDir);
    this.#buildDir = path.resolve(project.rootDir, buildDir);
    this.#rawMainFile = mainFile;
  }

  get distDir(): string {
    return this.#distDir;
  }

  get buildDir(): string {
    return this.#buildDir;
  }

  get mainFile(): string {
    if (this.#mainFile) {
      return this.#mainFile;
    }

    let mainFile = this.#rawMainFile;

    if (!mainFile) {

      const defaultExport = this.#project.packageJson.exports.get('.');

      if (defaultExport) {
        mainFile = defaultExport.withConditions('import') || defaultExport.withConditions('default');
      }
    }

    if (!mainFile) {
      throw new ReferenceError('Can not find main file');
    }

    return this.#mainFile = path.resolve(this.#project.rootDir, mainFile);
  }

}

/**
 * Build targets initialization options.
 */
export interface ProjectTargetsInit {

  /**
   * Distributable files` directory relative to {@link ProjectInit.rootDir project root}.
   *
   * Defaults to `dist`
   */
  readonly distDir?: string | undefined;

  /**
   * Temporal build directory relative to {@link ProjectInit.rootDir project root}.
   *
   * Defaults to `target`.
   */
  readonly buildDir?: string | undefined;

  /**
   * Main distribution file path relative to {@link distDir distribution directory}.
   *
   * By default, extracted from `package.json` {@link PackageJson.exports exports}.
   */
  readonly mainFile?: string;

}
