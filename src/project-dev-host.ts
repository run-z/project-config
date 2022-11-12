import { ProjectConfig } from './project-config.js';

/**
 * Abstract project development tools host.
 *
 * May contain other development tools.
 */
export interface ProjectDevHost {
  /**
   * Configured project.
   */
  get project(): ProjectConfig;

  /**
   * Type of this development host.
   */
  get type(): ProjectDevHostType<this>;
}

export interface ProjectDevHostType<THost extends ProjectDevHost> {
  new (project: ProjectConfig): THost;
  of(project: ProjectConfig): THost;
}
