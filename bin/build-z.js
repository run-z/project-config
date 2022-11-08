#!/usr/bin/env node
import { ProjectConfig, ProjectRollupConfig } from '@run-z/project-config';

const project = await ProjectConfig.load();
const config = await ProjectRollupConfig.load(project);

await config.run();
