import { type ProjectConfig } from './project-config.js';
import { ProjectDevHostType, type ProjectDevHost } from './project-dev-host.js';

/**
 * Abstract project development tool.
 *
 * Development tool instances expected to be immutable.
 *
 * The {@link ProjectDevTool#clone} method can be used to create project clones prior to updating it.
 *
 * @typeParam THost - Type of development tool host.
 */
export abstract class ProjectDevTool<THost extends ProjectDevHost = ProjectConfig> {

  readonly #project: ProjectConfig;
  readonly #hostType: ProjectDevHostType<THost>;

  /**
   * Constructs development tool.
   *
   * @param host - Development tool host.
   */
  constructor(host: THost) {
    this.#project = host.project;
    this.#hostType = host.type;
  }

  /**
   * Configured project.
   */
  get project(): ProjectConfig {
    return this.#project;
  }

  /**
   * Gains actual development tools host from the {@link project}.
   */
  host(): THost {
    return this.#hostType.of(this.project);
  }

  /**
   * Creates dev tool clone.
   *
   * @returns Project clone created with its constructor.
   */
  protected clone(): this {
    return new (this.constructor as new (host: THost) => this)(this.host());
  }

}
