import { describe, expect, it } from '@jest/globals';
import { ProjectTypescriptConfig } from './project-typescript-config.js';

describe('ProjectTypescriptConfig', () => {
  describe('compilerOptions', () => {
    it('contains raw configuration', async () => {
      await expect(new ProjectTypescriptConfig().options).resolves.toMatchObject({
        moduleResolution: 'Node',
        module: 'ES2020',
        target: 'ES2022',
        strict: true,
      });
    });
  });
});
