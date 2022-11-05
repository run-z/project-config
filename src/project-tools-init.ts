import { ProjectJestSpec } from './jest/project-jest-config.js';
import { ProjectPackageSpec } from './project-package.js';
import { ProjectRollupSpec } from './rollup/project-rollup-config.js';

/**
 * Development tools initializers for the project.
 */
export interface ProjectToolsInit {
  /**
   * {@link @run-z/project-config/jest!ProjectJestConfig.of Specifier} of Jest configuration of the project.
   */
  readonly jest?: ProjectJestSpec;

  /**
   * {@link ProjectPackage.of Specifier} of project package configuration.
   */
  readonly package?: ProjectPackageSpec;

  /**
   * {@link @run-z/project-config/rollup!ProjectRollupConfig.of Specifier} of Rollup configuration of the project.
   */
  readonly rollup?: ProjectRollupSpec;
}
