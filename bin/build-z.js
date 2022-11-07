#!/usr/bin/env node
import { ProjectConfig, ProjectRollupConfig } from '@run-z/project-config';

const project = await ProjectConfig.load();
const config = ProjectRollupConfig.of(project);
const options = await project.loadConfig('./rollup.config.js', null);

if (options) {
  config.replaceOptions(options);
}

await config.run();
