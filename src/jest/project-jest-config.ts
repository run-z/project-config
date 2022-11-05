import { Config } from '@jest/types';
import deepmerge from 'deepmerge';
import path from 'node:path';
import process from 'node:process';
import { ProjectConfig, ProjectSpec } from '../project-config.js';
import { ProjectTypescriptConfig } from '../typescript/project-typescript-config.js';

function ProjectJestConfig$create(
  this: void,
  project: ProjectConfig,
  options?: Config.InitialOptions,
): ProjectJestConfig {
  const { jest } = project.tools;

  if (jest) {
    const config = jest instanceof ProjectJestConfig ? jest : new ProjectJestConfig(project, jest);

    if (options) {
      config.extendOptions(options);
    }

    return config;
  }

  return new ProjectJestConfig(project, options);
}

/**
 * Configuration of project tests utilizing Jest.
 */
export class ProjectJestConfig {

  /**
   * Gains specified configuration of project tests utilizing Jest.
   *
   * Utilizes {@link @run-z/project-config!ProjectToolsInit#jest Jest tool initializer}.
   *
   * Jest configuration can be specified by one of:
   *
   * - Jest configuration instance, which is returned as is.
   * - Jest initialization options to apply on top of autogenerated ones.
   *   New Jest configuration created in this case.
   * - Nothing to create default configuration.
   *
   * @param project - Configured project {@link @run-z/project-config!ProjectConfig.of specifier}.
   * @param spec - Jest configuration specifier.
   *
   * @returns Jest configuration instance.
   */
  static of(project?: ProjectSpec, spec?: ProjectJestSpec): ProjectJestConfig {
    if (spec instanceof ProjectJestConfig) {
      return spec;
    }

    const projectConfig = ProjectConfig.of(project);

    return spec
      ? ProjectJestConfig$create(projectConfig, spec)
      : projectConfig.get(ProjectJestConfig$create);
  }

  readonly #project: ProjectConfig;
  #autogenerated = true;
  #runner: 'swc' | 'ts-jest';
  #customOptions: () => Config.InitialOptions | Promise<Config.InitialOptions>;
  #options?: Promise<Config.InitialOptions>;

  /**
   * Constructs project tests configuration.
   *
   * @param project - Configured project {@link @run-z/project-config!ProjectConfig.of specifier}.
   * @param options - Custom Jest options to apply on top of autogenerated ones.
   */
  constructor(project?: ProjectSpec, options: Config.InitialOptions = {}) {
    this.#project = ProjectConfig.of(project);
    this.#runner = ProjectJestConfig$defaultRunner();
    this.#customOptions = () => options;
  }

  #rebuild(): this {
    this.#options = undefined;

    return this;
  }

  /**
   * Configured project.
   */
  get project(): ProjectConfig {
    return this.#project;
  }

  /**
   * Whether options generated automatically prior to applying custom ones.
   *
   * `true` by default.
   */
  get autogenerated(): boolean {
    return this.#autogenerated;
  }

  /**
   * Test runner.
   *
   * Test may be run either with `swc`, or with `ts-jest`.
   *
   * @defaultValue `swc`, unless overridden by `RUNZ_TEST_RUNNER` environment variable.
   */
  get runner(): 'swc' | 'ts-jest' {
    return this.#runner;
  }

  /**
   * Assigns {@link runner test runner} to use.
   *
   * @param runner - Test runner to use.
   *
   * @returns `this` instance.
   */
  useRunner(runner: 'swc' | 'ts-jest'): this {
    this.#runner = runner;

    return this;
  }

  /**
   * Promise resolved to customized Jest options.
   */
  get options(): Promise<Config.InitialOptions> {
    return (this.#options ||= this.#toOptions());
  }

  /**
   * Replaces Jest options with custom ones.
   *
   * Clears custom options, and prevents {@link autogenerated automatic generation}.
   *
   * @param options - Jest options to apply.
   *
   * @returns `this` instance.
   */
  replaceOptions(options: Config.InitialOptions): this {
    this.#autogenerated = false;
    this.#customOptions = () => options;

    return this.#rebuild();
  }

  /**
   * Replaces custom Rollup options with autogenerated ones.
   *
   * Clears custom options, and forces {@link autogenerated automatic generation}.
   *
   * @param options - Jest options extending autogenerated ones.
   *
   * @returns `this` instance.
   */
  autogenerateOptions(options: Config.InitialOptions): this {
    this.#autogenerated = true;
    this.#customOptions = () => options;

    return this.#rebuild();
  }

  /**
   * Extends Jest options.
   *
   * @param extension - Jest options extending previous ones.
   *
   * @returns `this` instance.
   */
  extendOptions(extension: Config.InitialOptions): this {
    const prevOptions = this.#customOptions;

    this.#customOptions = async () => deepmerge(await prevOptions(), extension);

    return this.#rebuild();
  }

  async #toOptions(): Promise<Config.InitialOptions> {
    const customOptions = await this.#customOptions();

    if (!this.autogenerated) {
      return customOptions;
    }

    const swc = this.runner === 'swc';
    const output = await this.project.output;
    const { targetDir, cacheDir } = output;
    const config: Config.InitialOptions &
      Required<Pick<Config.InitialOptions, 'reporters' | 'transform'>> = {
      ...customOptions,
      cacheDirectory: path.join(cacheDir, 'jest'),
      extensionsToTreatAsEsm: customOptions.extensionsToTreatAsEsm ?? ['.ts'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        ...customOptions.moduleNameMapper,
      },
      reporters: customOptions.reporters
        ? [...customOptions.reporters]
        : [
            'default',
            [
              'jest-junit',
              {
                suiteName: 'All Tests',
                outputDirectory: path.join(targetDir, 'test-results'),
                classNameTemplate: '{classname}: {title}',
                titleTemplate: '{classname}: {title}',
                ancestorSeparator: ' › ',
                usePathForSuiteName: 'false',
              },
            ],
          ],
      testEnvironment: customOptions.testEnvironment ?? 'node',
      transform: { ...customOptions.transform },
    };

    const typescript = ProjectTypescriptConfig.of(this.project);

    if (config.preset == null) {
      if (swc) {
        const { experimentalDecorators, emitDecoratorMetadata } = typescript.options;

        config.transform['^.+\\.(t|j)sx?$'] = [
          '@swc/jest',
          {
            jsc: {
              parser: {
                syntax: 'typescript',
                decorators: experimentalDecorators,
                dynamicImport: true,
              },
              keepClassNames: true,
              preserveAllComments: true,
              target: 'es2020',
              transform: {
                legacyDecorator: experimentalDecorators,
                decoratorMetadata: emitDecoratorMetadata,
              },
            },
          },
        ];
      } else {
        config.preset = 'ts-jest/presets/default-esm';
        config.transform['^.+\\.tsx?$'] = [
          'ts-jest',
          {
            tsconfig: {
              ...typescript.options,
              esModuleInterop: true,
              noUnusedLocals: false,
              noUnusedParameters: false,
            },
            useESM: true,
          },
        ];
      }
    }
    if (process.env.CI === 'true' && process.env.GITHUB_ACTION) {
      config.reporters.push('github-actions');
    }

    const { collectCoverage = true } = customOptions;

    if (collectCoverage) {
      config.collectCoverage = true;

      const srcDir = path
        .relative(this.#project.rootDir, this.#project.sourceDir)
        .replaceAll(path.sep, '/');

      config.collectCoverageFrom = customOptions.collectCoverageFrom ?? [
        `${srcDir}/**/*.ts`,
        `!${srcDir}/**/*.spec.ts`,
        `!${srcDir}/spec/**`,
        '!**/node_modules/**',
      ];
      config.coverageDirectory =
        customOptions.coverageDirectory ?? path.join(targetDir, 'coverage');
      config.coverageThreshold = customOptions.coverageThreshold ?? {
        global: {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      };
    }

    return config;
  }

}

/**
 * {@link ProjectJestConfig.of Specifier} of project tests utilizing Jest
 */
export type ProjectJestSpec = ProjectJestConfig | Config.InitialOptions | undefined;

function ProjectJestConfig$defaultRunner(): 'swc' | 'ts-jest' {
  switch (process.env.RUNZ_TEST_RUNNER) {
    case 'ts-jest':
      return 'ts-jest';
    case 'swc':
    default:
      return 'swc';
  }
}
