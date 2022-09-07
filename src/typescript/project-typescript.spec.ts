import { describe, expect, it } from '@jest/globals';
import { ProjectConfig } from '../project-config.js';

describe('ProjectTypescript', () => {
  describe('compilerOptions', () => {
    it('contains raw configuration', () => {
      expect(new ProjectConfig().typescript.compilerOptions).toMatchObject({
        moduleResolution: 'Node',
        module: 'ES2020',
        target: 'ES2022',
        strict: true,
      });
    });
  });
});
