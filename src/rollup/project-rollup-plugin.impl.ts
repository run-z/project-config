import type { InputOptions, InputPluginOption, Plugin } from 'rollup';
import { ProjectRollupConfig } from './project-rollup-config.js';

const ProjectRollupPlugin$name = '@run-z/project-config';

/**
 * @internal
 */
export interface ProjectRollupPlugin extends Plugin {
  readonly name: typeof ProjectRollupPlugin$name;
  readonly api: {
    config(): ProjectRollupConfig;
  };
}

/**
 * @internal
 */
export function ProjectRollupPlugin$create(config: ProjectRollupConfig): ProjectRollupPlugin {
  return {
    name: ProjectRollupPlugin$name,
    api: {
      config() {
        return config;
      },
    },
  };
}

/**
 * @internal
 */
export async function ProjectRollupPlugin$get(
  options: InputOptions,
): Promise<ProjectRollupPlugin | undefined> {
  const { plugins = [] } = options;

  return await ProjectRollupPlugin$extract(plugins);
}

async function ProjectRollupPlugin$extract(
  plugin: InputPluginOption,
): Promise<ProjectRollupPlugin | undefined> {
  const pluginInstance = await plugin;

  if (!pluginInstance) {
    return;
  }
  if (Array.isArray(pluginInstance)) {
    for (const element of pluginInstance) {
      const extracted = await ProjectRollupPlugin$extract(element);

      if (extracted) {
        return extracted;
      }
    }
  } else if (pluginInstance.name === ProjectRollupPlugin$name) {
    return pluginInstance as ProjectRollupPlugin;
  }

  return;
}
