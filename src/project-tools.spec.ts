import { describe, expect, it } from '@jest/globals';
import { ProjectPackage } from './package/project-package.js';
import { ProjectConfig } from './project-config.js';

describe('ProjectTools', () => {
  it('has undefined tool base on missing spec', () => {
    const { tools } = new ProjectConfig();

    expect(tools.package).toBeUndefined();
    expect('package' in tools).toBe(false);
    expect(Reflect.ownKeys(tools)).toEqual([]);
    expect(Reflect.getOwnPropertyDescriptor(tools, 'package')).toBeUndefined();
  });
  it('has undefined tool base on undefined spec', () => {
    const { tools } = new ProjectConfig({ tools: { package: undefined } });

    expect(tools.package).toBeUndefined();
    expect('package' in tools).toBe(true);
    expect(Reflect.ownKeys(tools)).toEqual(['package']);

    const desc = Reflect.getOwnPropertyDescriptor(tools, 'package');

    expect(desc).toBeDefined();
    expect(desc?.get?.()).toBeUndefined();
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

    const pkg = project.tools.package as ProjectPackage;

    expect(pkg).toBeInstanceOf(ProjectPackage);

    const packageInfo = await pkg.packageInfo;

    expect(packageInfo.packageJson).toEqual({ name: 'test', version: '0.0.0' });
  });
  it('reflects tool construction failure', () => {
    const error = new Error('test');
    const { tools } = new ProjectConfig({
      tools: {
        package() {
          throw error;
        },
      },
    });

    expect(() => tools.package).toThrow(error);
    expect(() => tools.package).toThrow(error);
  });
});
