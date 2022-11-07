import { type RollupOptions } from 'rollup';
import { ProjectConfig } from '../project-config.js';
import { ProjectRollupConfig, ProjectRollupSpec } from './project-rollup-config.js';

/**
 * Configures Rollup for the project.
 *
 * {@link @run-z/project-config!ProjectConfig.load Loads} project configuration first.
 *
 * @param spec - Rollup configuration {@link ProjectRollupConfig.of specifier}.
 *
 * @returns Promise resolved to array of Rollup options.
 */
export async function configureRollup(spec?: ProjectRollupSpec): Promise<RollupOptions[]> {
  const project = await ProjectConfig.load();
  const config = ProjectRollupConfig.of(project, spec);

  return await config.options;
}
