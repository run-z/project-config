#!/usr/bin/env node
import { ProjectConfig, ProjectJestConfig } from '@run-z/project-config';

const project = await ProjectConfig.load();
const config = ProjectJestConfig.of(project);
const options = await project.loadConfig('./jest.config.js', null);

if (options) {
  config.replaceOptions(options);
}

await config.run();
