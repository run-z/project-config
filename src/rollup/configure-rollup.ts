import { type RollupOptions } from 'rollup';
import { ProjectConfig } from '../project-config.js';
import { ProjectRollupConfig } from './project-rollup-config.js';

/**
 * Configures Rollup for the project.
 *
 * {@link ProjectConfig.load Loads} project configuration first.
 *
 * @param options - Rollup options {@link ProjectRollupConfig#extendOptions extending} default ones.
 *
 * @returns Promise resolved to array of Rollup options.
 */
export async function configureRollup(options?: RollupOptions): Promise<RollupOptions[]> {
  const project = await ProjectConfig.load();
  let config = ProjectRollupConfig.of(project);

  if (options) {
    config = config.extendOptions(options);
  }

  return await config.options;
}
