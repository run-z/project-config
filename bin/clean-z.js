#!/usr/bin/env node
import { ProjectConfig } from '@run-z/project-config';

const output = await new ProjectConfig().output;

await output.clean();
