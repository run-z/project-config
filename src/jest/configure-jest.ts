import { type Config } from '@jest/types';
import { ProjectConfig } from '../project-config.js';
import { ProjectJestConfig } from './project-jest-config.js';

/**
 * Configures Jest tests for the project.
 *
 * {@link ProjectConfig.load Loads} project configuration first.
 *
 * @param options - Jest configuration options {@link ProjectJestConfig#extendOptions extending} default ones.
 *
 * @returns Promise resolved to Jest options.
 */
export async function configureJest(
  options?: Config.InitialOptions,
): Promise<Config.InitialOptions> {
  const project = await ProjectConfig.load();
  let config = ProjectJestConfig.of(project);

  if (options) {
    config = config.extendOptions(options);
  }

  return await config.options;
}
