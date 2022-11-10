#!/usr/bin/env node
import { ProjectConfig, ProjectError } from '@run-z/project-config';
import process from 'node:process';

try {
  const output = await new ProjectConfig().output;

  await output.clean();
} catch (error) {
  if (error instanceof ProjectError) {
    console.error(error.message);
    process.exit(1);
  } else {
    throw error;
  }
}
