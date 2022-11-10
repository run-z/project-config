#!/usr/bin/env node
import { ProjectConfig, ProjectError, ProjectRollupConfig } from '@run-z/project-config';
import process from 'node:process';

try {
  const project = await ProjectConfig.load();
  const config = await ProjectRollupConfig.load(project);

  await config.run();
} catch (error) {
  if (error instanceof ProjectError) {
    console.error(error.message);
    process.exit(1);
  } else {
    throw error;
  }
}
