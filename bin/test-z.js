#!/usr/bin/env node
import { ProjectConfig, ProjectJestConfig } from '@run-z/project-config';

const project = await ProjectConfig.load();
const config = await ProjectJestConfig.load(project);

await config.run();
