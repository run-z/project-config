import { ProjectConfig } from './project-config.js';

/**
 * Abstract project development tool.
 *
 * Development tool instances expected to be immutable.
 *
 * The {@link ProjectDevTool#clone} method can be used to create project clones prior to updating it.
 *
 * @typeParam THost - Type of development tool host.
 */
export abstract class ProjectDevTool<
  THost extends { readonly project: ProjectConfig } = ProjectConfig,
> {

  readonly #host: THost;

  /**
   * Constructs development tool.
   *
   * @param host - Development tool host.
   */
  constructor(host: THost) {
    this.#host = host;
  }

  /**
   * Development tool host.
   */
  get host(): THost {
    return this.#host;
  }

  /**
   * Configured project.
   */
  get project(): ProjectConfig {
    return this.host.project;
  }

  /**
   * Creates dev tool clone.
   *
   * @returns Project clone created with its constructor.
   */
  protected clone(): this {
    return new (this.constructor as new (host: THost) => this)(this.host);
  }

}
