import { describe, expect, it } from '@jest/globals';
import { ProjectPackage } from './package/project-package.js';
import { ProjectConfig } from './project-config.js';

describe('ProjectTools', () => {
  it('has undefined tool base on missing spec', () => {
    const { tools } = new ProjectConfig();

    expect(tools.package).toBeUndefined();
    expect('package' in tools).toBe(false);
    expect(Reflect.ownKeys(tools)).toEqual([]);
  });
  it('has undefined tool base on undefined spec', () => {
    const { tools } = new ProjectConfig({ tools: { package: undefined } });

    expect(tools.package).toBeUndefined();
    expect('package' in tools).toBe(true);
    expect(Reflect.ownKeys(tools)).toEqual(['package']);
  });
  it('contain initializers', () => {
    const { tools } = new ProjectConfig({
      tools: {
        package: {
          name: 'test',
        },
        typescript: {
          module: 'ES2022',
        },
      },
    });

    expect(tools).toEqual({ package: { name: 'test' }, typescript: { module: 'ES2022' } });
    expect(Reflect.ownKeys(tools)).toEqual(['package', 'typescript']);
    expect('package' in tools).toBe(true);
    expect('typescript' in tools).toBe(true);
    expect('jest' in tools).toBe(false);
  });
  it('builds base config', async () => {
    const project = new ProjectConfig({
      tools: {
        package: project => ProjectPackage.of(project).replacePackageJson({ name: 'test' }),
      },
    });

    const base = project.tools.package;

    expect(base).toBeInstanceOf(ProjectPackage);

    const tool = ProjectPackage.of(project, base);

    expect(tool).toBe(base);
    await expect(tool.packageJson).resolves.toEqual({ name: 'test' });
  });
});
