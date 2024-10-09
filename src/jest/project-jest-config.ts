import { type Config } from '@jest/types';
import deepmerge from 'deepmerge';
import path from 'node:path';
import process from 'node:process';
import { ProjectPackage } from '../package/project-package.js';
import { type ProjectConfig } from '../project-config.js';
import { ProjectDevTool } from '../project-dev-tool.js';
import { ProjectError } from '../project.error.js';
import { ProjectTypescriptConfig } from '../typescript/project-typescript-config.js';

function ProjectJestConfig$create(this: void, project: ProjectConfig): ProjectJestConfig {
  const { jest } = project.tools;

  if (!jest) {
    return new ProjectJestConfig(project);
  }
  if (jest instanceof ProjectJestConfig) {
    return jest;
  }

  return new ProjectJestConfig(project).extendOptions(jest);
}

/**
 * Configuration of project tests utilizing Jest.
 */
export class ProjectJestConfig extends ProjectDevTool {
  /**
   * Gains Jest configuration of the project.
   *
   * Respects {@link ProjectToolsInit#jest defaults}.
   *
   * @param project - Configured project.
   *
   * @returns Jest configuration instance.
   */
  static of(project: ProjectConfig): ProjectJestConfig {
    return project.get(ProjectJestConfig$create);
  }

  /**
   * Loads Jest configuration from ESM module.
   *
   * If configuration file found, its options {@link ProjectJestConfig#replaceOptions replace} the default ones.
   * Default configuration returned otherwise.
   *
   * @param project - Configured project.
   * @param url - Jest configuration URL relative to project root. Defaults to `./jest.config.js`.
   *
   * @returns Loaded configuration.
   */
  static async load(project: ProjectConfig, url = './jest.config.js'): Promise<ProjectJestConfig> {
    const config = ProjectJestConfig.of(project);
    const options: Config.InitialOptions | null = await project.loadConfig(url, null);

    return options ? config.replaceOptions(options) : config;
  }

  #jest?: Promise<typeof import('jest')>;
  #autogenerated = true;
  #runner?: Promise<'swc' | 'ts-jest'>;
  #customOptions: () => Config.InitialOptions | Promise<Config.InitialOptions>;

  #options?: Promise<Config.InitialOptions>;

  /**
   * Constructs project tests configuration.
   *
   * @param project - Configured project.
   */
  constructor(project: ProjectConfig) {
    super(project);
    this.#customOptions = () => ({});
  }

  protected override clone(): this {
    const clone = super.clone();

    clone.#runner = this.#runner;
    clone.#customOptions = this.#customOptions;

    return clone;
  }

  /**
   * Jest API instance.
   */
  get jest(): Promise<typeof import('jest')> {
    return (this.#jest ??= import('jest').then(jest => jest.default || jest));
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
   * @defaultValue Promise resolved to auto-detected test runner, unless overridden by `RUNZ_TEST_RUNNER`
   * environment variable.
   */
  get runner(): Promise<'swc' | 'ts-jest'> {
    return (this.#runner ??= this.#detectRunner());
  }

  async #detectRunner(): Promise<'swc' | 'ts-jest'> {
    const runner = process.env.RUNZ_TEST_RUNNER;

    if (runner === 'swc' || runner === 'ts-jest') {
      return runner;
    }

    const pkg = ProjectPackage.of(this.project);

    if (await pkg.dependsOn('@swc/jest')) {
      return 'swc';
    }
    if (await pkg.dependsOn('ts-jest')) {
      return 'ts-jest';
    }

    throw new ProjectError(`No test runners found.

  Please add either \`@swc/jest\`, or \`ts-jest\` to project dependencies.`);
  }

  /**
   * Assigns {@link runner test runner} to use.
   *
   * @param runner - Test runner to use.
   *
   * @returns Updated instance.
   */
  useRunner(runner: 'swc' | 'ts-jest'): this {
    const clone = this.clone();

    clone.#runner = Promise.resolve(runner);

    return clone;
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
   * @returns Updated instance.
   */
  replaceOptions(options: Config.InitialOptions): this {
    const clone = this.clone();

    clone.#autogenerated = false;
    clone.#customOptions = () => options;

    return clone;
  }

  /**
   * Replaces custom Rollup options with autogenerated ones.
   *
   * Clears custom options, and forces {@link autogenerated automatic generation}.
   *
   * @param options - Jest options extending autogenerated ones.
   *
   * @returns Updated instance.
   */
  autogenerateOptions(options: Config.InitialOptions): this {
    const clone = this.clone();

    clone.#autogenerated = true;
    clone.#customOptions = () => options;

    return clone;
  }

  /**
   * Extends Jest options.
   *
   * @param extension - Jest options extending previous ones.
   *
   * @returns Updated instance instance.
   */
  extendOptions(extension: Config.InitialOptions): this {
    const clone = this.clone();
    const prevOptions = this.#customOptions;

    clone.#customOptions = async () => deepmerge(await prevOptions(), extension);

    return clone;
  }

  async #toOptions(): Promise<Config.InitialOptions> {
    const customOptions = await this.#customOptions();

    if (!this.autogenerated) {
      return customOptions;
    }

    const config: Config.InitialOptions = {
      ...customOptions,
    };

    config.cacheDirectory ??= await this.#detectCacheDir();
    config.testEnvironment ??= 'node';
    config.moduleNameMapper = { '^(\\.{1,2}/.*)\\.js$': '$1', ...config.moduleNameMapper };

    await this.#setupRunner(config);
    await this.#setupReporters(config);
    await this.#setupCoverage(config);

    return config;
  }

  async #detectCacheDir(): Promise<string> {
    const output = await this.project.output;
    const { cacheDir } = output;

    return path.join(cacheDir, 'jest');
  }

  async #setupRunner(config: Config.InitialOptions): Promise<void> {
    const tsConfig = ProjectTypescriptConfig.of(this.project);

    config.transform = { ...config.transform };

    if (config.preset == null) {
      const useESM = this.project.supportsVmModules;
      const runner = await this.runner;

      config.extensionsToTreatAsEsm ??= useESM ? ['.ts'] : undefined;

      if (runner === 'swc') {
        const { options } = await tsConfig.generatedTsconfig;
        const { experimentalDecorators, emitDecoratorMetadata, removeComments } = options;

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
              preserveAllComments: !removeComments,
              target: 'es2020',
              transform: {
                legacyDecorator: experimentalDecorators,
                decoratorMetadata: emitDecoratorMetadata,
              },
            },
          },
        ];
      } else {
        const tsconfigFile = await tsConfig.writeTsconfig('tsconfig.jest.json', {
          compilerOptions: {
            esModuleInterop: true,
            noUnusedLocals: false,
            noUnusedParameters: false,
          },
        });

        config.transform['^.+\\.tsx?$'] = [
          'ts-jest',
          {
            tsconfig: tsconfigFile.file,
            useESM,
          },
        ];
      }
    }
  }

  async #setupReporters(config: Config.InitialOptions): Promise<void> {
    config.reporters = config.reporters ? [...config.reporters] : await this.#detectReporters();

    if (process.env.CI === 'true' && process.env.GITHUB_ACTION) {
      config.reporters.push('github-actions');
    }
  }

  async #detectReporters(): Promise<(string | Config.ReporterConfig)[]> {
    const output = await this.project.output;
    const { targetDir } = output;
    const pkg = ProjectPackage.of(this.project);

    if (await pkg.dependsOn('jest-junit')) {
      return [
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
      ];
    }

    return ['default'];
  }

  async #setupCoverage(config: Config.InitialOptions): Promise<void> {
    const output = await this.project.output;
    const { targetDir } = output;
    const { collectCoverage = true } = config;

    if (collectCoverage) {
      config.collectCoverage = true;

      const srcDir = path
        .relative(this.project.rootDir, this.project.sourceDir)
        .replaceAll(path.sep, '/');

      config.collectCoverageFrom ??= [
        `${srcDir}/**/*.ts`,
        `!${srcDir}/**/*.spec.ts`,
        `!${srcDir}/spec/**`,
        '!**/node_modules/**',
      ];
      config.coverageDirectory ??= path.join(targetDir, 'coverage');
      config.coverageThreshold ??= {
        global: {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      };
    }
  }

  /**
   * Configures and run project tests with Jest.
   *
   * @param args - Array of Jest command line arguments. Defaults to arguments from `process.argv`.
   *
   * @returns Promise resolved when tests executed.
   */
  async run(args?: string[]): Promise<void> {
    const jest = await this.jest;

    await jest.run(args);
  }
}
