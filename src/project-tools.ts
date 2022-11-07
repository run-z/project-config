import { ProjectJestConfig, ProjectJestSpec } from './jest/project-jest-config.js';
import { ProjectPackage, ProjectPackageSpec } from './package/project-package.js';
import { ProjectConfig } from './project-config.js';
import { ProjectRollupConfig, ProjectRollupSpec } from './rollup/project-rollup-config.js';
import {
  ProjectTypescriptConfig,
  ProjectTypescriptSpec,
} from './typescript/project-typescript-config.js';

/**
 * Base configurations of project development tools.
 *
 * The tools are actually created by static methods of corresponding tool classes. The values in this configuration
 * are used as bases for corresponding tools.
 */
export type ProjectToolsBase = {
  readonly [K in keyof ProjectToolsInit]?: ProjectToolType<ProjectToolsInit[K]>;
};

export type ProjectToolType<
  TInit extends ((project: ProjectConfig) => object) | object | undefined,
> = TInit extends (project: ProjectConfig) => infer TTool ? TTool : TInit;

/**
 * Development tools specifiers for the project.
 *
 * Each property contains either project tool specifier, or a function creating such tool for the given project.
 */
export interface ProjectToolsInit {
  /**
   * {@link ProjectJestConfig.of Specifier} of Jest configuration of the project.
   */
  readonly jest?: ProjectJestSpec | ((project: ProjectConfig) => ProjectJestConfig);

  /**
   * {@link ProjectPackage.of Specifier} of project's package configuration.
   */
  readonly package?: ProjectPackageSpec | ((project: ProjectConfig) => ProjectPackage);

  /**
   * {@link ProjectRollupConfig.of Specifier} of Rollup configuration of the project.
   */
  readonly rollup?: ProjectRollupSpec | ((project: ProjectConfig) => ProjectRollupConfig);

  /**
   * {@link ProjectTypescriptConfig.of Specifier} of project's TypeScript configuration.
   */
  readonly typescript?:
    | ProjectTypescriptSpec
    | ((project: ProjectConfig) => ProjectTypescriptConfig);
}
