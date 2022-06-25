import path from 'node:path';
import process from 'node:process';
import { PackageJson } from './package/package-json.js';
import { ProjectSources, ProjectSourcesInit } from './project-sources.js';
import { ProjectTargets, ProjectTargetsInit } from './project-targets.js';

/**
 * Project configuration.
 */
export class ProjectConfig implements ProjectInit, Required<ProjectInit> {

  readonly #rootDir: string;
  readonly #sources: ProjectSources;
  readonly #targets: ProjectTargets;
  #packageJson?: PackageJson;

  /**
   * Constructs project configuration.
   *
   * @param init - Project initialization options.
   */
  constructor(init: ProjectInit = {}) {

    const { rootDir = process.cwd(), sources, targets } = init;

    this.#rootDir = path.resolve(rootDir);
    this.#sources = new ProjectSources(this, sources);
    this.#targets = new ProjectTargets(this, targets);
  }

  get rootDir(): string {
    return this.#rootDir;
  }

  get sources(): ProjectSources {
    return this.#sources;
  }

  get targets(): ProjectTargets {
    return this.#targets;
  }

  get packageJson(): PackageJson {
    return this.#packageJson ||= new PackageJson(this);
  }

}

/**
 * Project initialization options.
 */
export interface ProjectInit {

  /**
   * Root project directory.
   *
   * Defaults to current working directory.
   */
  readonly rootDir?: string | undefined;

  /**
   * Source files configuration.
   */
  readonly sources?: ProjectSourcesInit | undefined;

  /**
   * Target files configuration.
   */
  readonly targets?: ProjectTargetsInit | undefined;

}
