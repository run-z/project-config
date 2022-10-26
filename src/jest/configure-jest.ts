import { Config } from '@jest/types';
import { ProjectJestConfig, ProjectJestSpec } from './project-jest-config.js';

/**
 * Configures Jest tests for the project.
 *
 * @param spec - Jest configuration {@link ProjectJestConfig.of specifier}.
 *
 * @returns Promise resolved to Jest options.
 */
export async function configureJest(spec?: ProjectJestSpec): Promise<Config.InitialOptions> {
  const config = await ProjectJestConfig.of(spec);

  return await config.toJestOptions();
}
