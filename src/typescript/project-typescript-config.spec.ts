import { describe, expect, it } from '@jest/globals';
import ts from 'typescript';
import { ProjectConfig } from '../project-config.js';
import { ProjectTypescriptConfig } from './project-typescript-config.js';

describe('ProjectTypescriptConfig', () => {
  describe('createTsconfig', () => {
    it('includes combined compiler options', async () => {
      const tsConfig = new ProjectTypescriptConfig(new ProjectConfig());
      const tsconfigFile = await tsConfig.createTsconfig('tsconfig.test.json', {});

      expect(tsconfigFile.options).toMatchObject({
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        module: ts.ModuleKind.Node16,
        target: ts.ScriptTarget.ES2022,
        strict: true,
      });
    });
  });
});
