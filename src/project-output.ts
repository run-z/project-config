import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ProjectConfig } from './project-config.js';

/**
 * Project output configuration.
 */
export class ProjectOutput implements ProjectOutputInit, Required<ProjectOutputInit> {

  /**
   * Creates project output configuration.
   *
   * First, tries to load configuration from `.project-output.json` file within {@link ProjectOutputInit#targetDir build
   * target directory} if the file exists.
   *
   * If output configuration can not be loaded or differs from initialization otions, stores new configuration to the
   * file.
   *
   * @param init - Output initialization options.
   *
   * @returns Promise resolved to project output configuration.
   */
  static async create(
    project: ProjectConfig,
    init: ProjectOutputInit = {},
  ): Promise<ProjectOutput> {
    const { rootDir } = project;
    let { distDir = 'dist', targetDir = 'target' } = init;

    distDir = path.resolve(rootDir, distDir);
    targetDir = path.resolve(rootDir, targetDir);

    await fs.mkdir(targetDir, { recursive: true });

    const configFile = ProjectOutput.#configFile(targetDir);
    const oldConfig = await ProjectOutput.#load(configFile);

    let { cacheDir } = init;

    if (!cacheDir) {
      if (oldConfig) {
        cacheDir = oldConfig.cacheDir;
      } else {
        cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'run-z.project-cache.'));
      }
    }

    const dirSet = new Set(oldConfig?.dirs);

    dirSet.add(distDir);
    dirSet.add(targetDir);
    dirSet.add(cacheDir);

    const dirs = [...dirSet];

    const output = new ProjectOutput(project, {
      distDir,
      targetDir,
      cacheDir,
      dirs,
    });

    if (!oldConfig || distDir !== oldConfig.distDir || cacheDir !== oldConfig.cacheDir) {
      await output.save();
    }

    return output;
  }

  static #configFile(targetDir: string): string {
    return path.join(targetDir, '.project-output.json');
  }

  static async #load(configFile: string): Promise<ProjectOutputJson | undefined> {
    try {
      return JSON.parse(await fs.readFile(configFile, 'utf-8')) as ProjectOutputJson;
    } catch {
      // No config file yet.
    }

    return;
  }

  readonly #project: ProjectConfig;
  readonly #distDir: string;
  readonly #targetDir: string;
  readonly #cacheDir: string;
  #dirs: readonly string[];
  #isSaved = false;

  private constructor(
    project: ProjectConfig,
    {
      distDir,
      targetDir,
      cacheDir,
      dirs,
    }: Required<ProjectOutputInit> & { dirs: readonly string[] },
  ) {
    this.#project = project;
    this.#distDir = distDir;
    this.#targetDir = targetDir;
    this.#cacheDir = cacheDir;
    this.#dirs = dirs;
  }

  /**
   * Parent project configuration.
   */
  get project(): ProjectConfig {
    return this.#project;
  }

  /**
   * Distributable files` directory.
   */
  get distDir(): string {
    return this.#distDir;
  }

  /**
   * Directory containing build targets.
   *
   * Unlike {@link distDir}, this one is not supposed to be published at NPM.
   */
  get targetDir(): string {
    return this.#targetDir;
  }

  /**
   * Cache directory.
   */
  get cacheDir(): string {
    return this.#cacheDir;
  }

  /**
   * List of all output directories created by project build.
   */
  get dirs(): readonly string[] {
    return this.#dirs;
  }

  /**
   * Whether this configuration is saved already.
   *
   * `true` initially.
   *
   * Becomes `false` when output directories {@link clean deleted}.
   *
   * Becomes `true` again once configuration {@link save saved}.
   */
  get isSaved(): boolean {
    return this.#isSaved;
  }

  /**
   * Saves this project output configuration.
   *
   * Creates {@link targetDir build target directory} and saves output configuration to `.project-output.json` file
   * within it.
   *
   * Does nothing if config {@link isSaved saved} already.
   *
   * @returns Promise resolved to `this` instance when config saved.
   */
  async save(): Promise<this> {
    if (this.isSaved) {
      return this;
    }

    await fs.mkdir(this.targetDir, { recursive: true });

    const output: ProjectOutputJson = {
      distDir: this.distDir,
      cacheDir: this.cacheDir,
      dirs: this.dirs,
    };

    await fs.writeFile(ProjectOutput.#configFile(this.targetDir), [
      JSON.stringify(output, null, 2),
      os.EOL,
    ]);

    this.#isSaved = true;

    return this;
  }

  /**
   * Clears and deletes all {@link dirs output directories}.
   *
   * Project output configuration becomes {@link isSaved unsaved} after this operation.
   */
  async clean(): Promise<void> {
    await Promise.all(
      this.dirs.map(async dir => await fs.rm(dir, { force: true, recursive: true })),
    );
    this.#dirs = [this.#distDir, this.#targetDir, this.#cacheDir];
    this.#isSaved = false;
  }

}

/**
 * Project output initialization options.
 */
export interface ProjectOutputInit {
  /**
   * Distributable files` directory relative to {@link ProjectConfig#rootDir project root}.
   *
   * @defaultValue `dist`
   */
  readonly distDir?: string | undefined;

  /**
   * Directory containing build targets relative to {@link ProjectConfig#rootDir project root}.
   *
   * Unlike {@link distDir}, this one is not supposed to be published at NPM.
   *
   * @defaultValue `target`.
   */
  readonly targetDir?: string | undefined;

  /**
   * Cache directory relative to {@link targetDir build target directory}.
   *
   * @defaultValue Temporary directory.
   */
  readonly cacheDir?: string | undefined;
}

interface ProjectOutputJson extends Required<Omit<ProjectOutputInit, 'targetDir'>> {
  readonly dirs: readonly string[];
}
