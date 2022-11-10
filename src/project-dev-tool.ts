import { ProjectConfig } from './project-config.js';

/**
 * Abstract project development tool.
 *
 * Development tool instances expected to be immutable.
 *
 * The {@link ProjectDevTool#clone} method can be used to create project clones prior to updating it.
 */
export abstract class ProjectDevTool {

  readonly #project: ProjectConfig;

  /**
   * Constructs development tool.
   *
   * @param project - Configured project.
   */
  constructor(project: ProjectConfig) {
    this.#project = project;
  }

  /**
   * Configured project.
   */
  get project(): ProjectConfig {
    return this.#project;
  }

  /**
   * Creates dev tool clone.
   *
   * @returns Project clone created with its constructor.
   */
  protected clone(): this {
    return new (this.constructor as new (project: ProjectConfig) => this)(this.project);
  }

}
