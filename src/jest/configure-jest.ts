import { type Config } from '@jest/types';
import { ProjectConfig } from '../project-config.js';
import { ProjectJestConfig, ProjectJestSpec } from './project-jest-config.js';

/**
 * Configures Jest tests for the project.
 *
 * {@link ProjectConfig.load Loads} project configuration first.
 *
 * @param spec - Jest configuration {@link ProjectJestConfig.of specifier}.
 *
 * @returns Promise resolved to Jest options.
 */
export async function configureJest(spec?: ProjectJestSpec): Promise<Config.InitialOptions> {
  const project = await ProjectConfig.load();
  const config = ProjectJestConfig.of(project, spec);

  return await config.options;
}
