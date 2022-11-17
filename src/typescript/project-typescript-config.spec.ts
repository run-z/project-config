import { describe, expect, it } from '@jest/globals';
import { ProjectConfig } from '../project-config.js';
import { ProjectTypescriptConfig } from './project-typescript-config.js';

describe('ProjectTypescriptConfig', () => {
  describe('compilerOptions', () => {
    it('contains raw configuration', async () => {
      await expect(new ProjectTypescriptConfig(new ProjectConfig()).options).resolves.toMatchObject(
        {
          moduleResolution: 'Node',
          module: 'Node16',
          target: 'ES2022',
          strict: true,
        },
      );
    });
  });
});
