import { RollupOptions } from 'rollup';
import { ProjectRollupConfig, ProjectRollupSpec } from './project-rollup-config.js';

/**
 * Configures Rollup for the project.
 *
 * @param spec - Rollup configuration {@link ProjectRollupConfig.of specifier}.
 *
 * @returns Promise resolved to array of Rollup options.
 */
export async function configureRollup(spec?: ProjectRollupSpec): Promise<RollupOptions[]> {
  const config = await ProjectRollupConfig.of(spec, ({ pure = 'auto', ...init }) => ({
    ...init,
    pure,
  }));
  const options = await config.toRollupOptions();

  return options.list;
}
