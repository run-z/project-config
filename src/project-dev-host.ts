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
   * Retrieves actual instance of itself from the project.
   */
  get actual(): this;
}
