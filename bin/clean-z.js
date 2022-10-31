#!/usr/bin/env node
import { ProjectConfig } from '@run-z/project-config';

clean().catch(error => {
  console.error(error);
  process.exit(1);
});

async function clean() {
  const output = await new ProjectConfig().output;

  await output.clean();
}
