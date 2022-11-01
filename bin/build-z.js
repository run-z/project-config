#!/usr/bin/env node
import { ProjectConfig } from '@run-z/project-config';
import { ProjectRollupConfig } from '@run-z/project-config/rollup';
import process from 'node:process';

const project = await ProjectConfig.load();
const config = ProjectRollupConfig.of(project);
const options = await project.loadConfig('./rollup.config.js', null);

if (options) {
  config.replaceOptions(typeof options === 'function' ? options(process.argv.slice(2)) : options);
}

await config.run();
