#!/usr/bin/env node
import { ProjectRollupConfig } from '@run-z/project-config/rollup';

const runner = await ProjectRollupConfig.of({ options: './rollup.config.js' });

await runner.run();
