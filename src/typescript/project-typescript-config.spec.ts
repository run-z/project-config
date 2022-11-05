import { describe, expect, it } from '@jest/globals';
import { ProjectConfig } from '../project-config.js';

describe('ProjectTypescriptConfig', () => {
  describe('compilerOptions', () => {
    it('contains raw configuration', () => {
      expect(new ProjectConfig().typescript.options).toMatchObject({
        moduleResolution: 'Node',
        module: 'ES2020',
        target: 'ES2022',
        strict: true,
      });
    });
  });
});
