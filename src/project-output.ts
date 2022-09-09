import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GitIgnoreFile, gitIgnorePath } from './gitignore/mod.js';
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
      gitignore: await ProjectOutput.#loadGitignore(project, { ...init, distDir, targetDir }),
      npmignore: await ProjectOutput.#loadNpmignore(project, {
        ...init,
        distDir,
        targetDir,
      }),
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

  static async #loadGitignore(
    project: ProjectConfig,
    {
      distDir,
      targetDir,
      gitignore = true,
    }: Required<Pick<ProjectOutputInit, 'distDir' | 'targetDir'>> &
      Pick<ProjectOutputInit, 'gitignore'>,
  ): Promise<GitIgnoreFile | false> {
    if (gitignore !== true) {
      return gitignore;
    }

    const { rootDir } = project;
    const filePath = path.join(rootDir, '.gitignore');
    const file = new GitIgnoreFile();

    try {
      await file.load(filePath);
    } catch {
      // No `.gitignore` file exists yet.
    }

    file
      .section('Node.js modules')
      .entry('node_modules/')
      .ignore()
      .file.section('IntelliJ IDEA files')
      .entry('.idea')
      .ignore()
      .entry('*.iml')
      .ignore()
      .file.section('Logs')
      .entry('*.log')
      .ignore()
      .file.section('Ignore lock files as this project developed within (private) pnpm worktree')
      .entry('yarn.lock')
      .ignore()
      .entry('package-lock.json')
      .ignore()
      .entry('pnpm-lock.yaml')
      .ignore()
      .file.section('Package archive')
      .entry('*.tgz')
      .ignore()
      .file.section('Intermediate files')
      .entry(gitIgnorePath(rootDir, targetDir))
      .setMatch('dirs')
      .ignore()
      .file.section('Distribution directory')
      .entry(gitIgnorePath(rootDir, distDir))
      .setMatch('dirs')
      .ignore()
      .file.section('Type definitions')
      .entry('*.d.ts')
      .ignore()
      .entry('*.d.ts.map')
      .ignore();

    return await file.save(filePath);
  }

  static async #loadNpmignore(
    project: ProjectConfig,
    {
      distDir,
      targetDir,
      npmignore = true,
    }: Required<Pick<ProjectOutputInit, 'distDir' | 'targetDir'>> &
      Pick<ProjectOutputInit, 'npmignore'>,
  ): Promise<GitIgnoreFile | false> {
    if (!npmignore) {
      return npmignore;
    }

    const { rootDir, sourceDir } = project;
    const filePath = path.join(rootDir, '.npmignore');
    const file = new GitIgnoreFile();

    try {
      await file.load(filePath);
    } catch {
      // No `.npmignore` file exists yet.
    }

    file
      .section('Node.js modules')
      .entry('node_modules/')
      .ignore()
      .file.section('IntelliJ IDEA files')
      .entry('.idea')
      .ignore()
      .entry('*.iml')
      .ignore()
      .file.section('Logs')
      .entry('*.log')
      .ignore()
      .file.section('Package archive')
      .entry('*.tgz')
      .ignore()
      .file.section('Source files')
      .entry(gitIgnorePath(rootDir, sourceDir))
      .setMatch('dirs')
      .file.section('Intermediate files')
      .entry(gitIgnorePath(rootDir, targetDir))
      .setMatch('dirs')
      .ignore()
      .file.section('Build configurations')
      .entry('/.*')
      .ignore()
      .entry('/*.cjs')
      .ignore()
      .entry('/*.js')
      .ignore()
      .entry('/.json')
      .ignore()
      .entry('/*.mjs')
      .ignore()
      .file.section('Package lock')
      .entry('yarn.lock')
      .ignore()
      .entry('package-lock.json')
      .ignore()
      .entry('pnpm-lock.yaml')
      .ignore()
      .file.section('Include distribution dir')
      .entry(gitIgnorePath(rootDir, distDir))
      .setMatch('dirs')
      .ignore(false)
      .file.section('Include type definitions')
      .entry('*.d.ts')
      .ignore(false)
      .entry('*.d.ts.map')
      .ignore(false);

    return file.save(filePath);
  }

  readonly #project: ProjectConfig;
  readonly #distDir: string;
  readonly #targetDir: string;
  readonly #cacheDir: string;
  readonly #gitignore: GitIgnoreFile | false;
  readonly #npmignore: GitIgnoreFile | false;
  #dirs: readonly string[];
  #isSaved = false;

  private constructor(
    project: ProjectConfig,
    {
      distDir,
      targetDir,
      cacheDir,
      gitignore,
      npmignore,
      dirs,
    }: Required<Omit<ProjectOutputInit, 'gitignore' | 'npmignore'>> & {
      dirs: readonly string[];
      gitignore: GitIgnoreFile | false;
      npmignore: GitIgnoreFile | false;
    },
  ) {
    this.#project = project;
    this.#distDir = distDir;
    this.#targetDir = targetDir;
    this.#cacheDir = cacheDir;
    this.#gitignore = gitignore;
    this.#npmignore = npmignore;
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
   * `.gitignore` file representation, or `false` if the file is not managed
   */
  get gitignore(): GitIgnoreFile | false {
    return this.#gitignore;
  }

  /**
   * `.npmignore` file representation, or `false` if the file is not managed
   */
  get npmignore(): GitIgnoreFile | false {
    return this.#npmignore;
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

  /**
   * How to manage `.gitignore` file.
   *
   * Either a flag, or custom {@link GitIgnoreFile} instance.
   *
   * @defaultValue `true`.
   */
  readonly gitignore?: boolean | GitIgnoreFile | undefined;

  /**
   * How to manage `.npmignore` file.
   *
   * Either a flag, or custom {@link GitIgnoreFile} instance.
   *
   * @defaultValue `true`.
   */
  readonly npmignore?: boolean | GitIgnoreFile | undefined;
}

interface ProjectOutputJson extends Required<Pick<ProjectOutputInit, 'distDir' | 'cacheDir'>> {
  readonly dirs: readonly string[];
}
