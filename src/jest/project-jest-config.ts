import { Config } from '@jest/types';
import path from 'node:path';
import { ProjectConfig, ProjectSpec } from '../project-config.js';

/**
 * Configuration of project tests utilizing Jest.
 */
export class ProjectJestConfig implements ProjectJestInit, Required<ProjectJestInit> {

  /**
   * Gains specified configuration of project tests utilizing Jest.
   *
   * Gains {@link @run-z/project-config!ProjectConfig.of project configuration} first.
   *
   * Tests configuration can be specified by one of:
   *
   * - Tests configuration instance, which is returned as is.
   * - Tests initialization options. New tests configuration created ion this case.
   *
   * @returns Promise resolved to configuration of project tests.
   */
  static async of(spec?: ProjectJestSpec): Promise<ProjectJestConfig> {
    if (spec instanceof ProjectJestConfig) {
      return spec;
    }

    return new ProjectJestConfig({
      ...spec,
      project: await ProjectConfig.of(spec?.project),
    });
  }

  readonly #project: ProjectConfig;
  readonly #runner: 'swc' | 'ts-jest';
  readonly #options: Config.InitialOptions;

  /**
   * Constructs project tests configuration.
   *
   * @param init - Tests initialization options.
   */
  constructor(init: ProjectJestInit = {}) {
    const {
      project = new ProjectConfig(),
      runner = ProjectTests$defaultRunner(),
      options = {},
    } = init;

    this.#project = project;
    this.#runner = runner;
    this.#options = options;
  }

  /**
   * Configured project.
   */
  get project(): ProjectConfig {
    return this.#project;
  }

  get runner(): 'swc' | 'ts-jest' {
    return this.#runner;
  }

  get options(): Config.InitialOptions {
    return this.#options;
  }

  /**
   * Builds Jest options.
   *
   * @returns Promise resolved to Jest options.
   */
  async toJestOptions(): Promise<Config.InitialOptions> {
    const swc = this.runner === 'swc';
    const options = this.#options;
    const output = await this.project.output;
    const { targetDir, cacheDir } = output;
    const config: Config.InitialOptions &
      Required<Pick<Config.InitialOptions, 'reporters' | 'transform'>> = {
      ...options,
      cacheDirectory: path.join(cacheDir, 'jest'),
      extensionsToTreatAsEsm: options.extensionsToTreatAsEsm ?? ['.ts'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        ...options.moduleNameMapper,
      },
      reporters: options.reporters
        ? [...options.reporters]
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
      testEnvironment: options.testEnvironment ?? 'node',
      transform: { ...options.transform },
    };

    if (config.preset == null) {
      if (swc) {
        const { experimentalDecorators, emitDecoratorMetadata } =
          this.#project.typescript.compilerOptions;

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
              ...this.#project.typescript.compilerOptions,
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

    const { collectCoverage = true } = this.#options;

    if (collectCoverage) {
      config.collectCoverage = true;

      const srcDir = path
        .relative(this.#project.rootDir, this.#project.sourceDir)
        .replaceAll(path.sep, '/');

      config.collectCoverageFrom = options.collectCoverageFrom ?? [
        `${srcDir}/**/*.ts`,
        `!${srcDir}/**/*.spec.ts`,
        `!${srcDir}/spec/**`,
        '!**/node_modules/**',
      ];
      config.coverageDirectory = options.coverageDirectory ?? path.join(targetDir, 'coverage');
      config.coverageThreshold = options.coverageThreshold ?? {
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
export type ProjectJestSpec = ProjectJestConfig | ProjectJestInit | undefined;

/**
 * Initialization options of project tests utilizing Jest.
 */
export interface ProjectJestInit<TProject extends ProjectSpec = ProjectConfig> {
  /**
   * Configured project {@link @run-z/project-config!ProjectConfig.of specifier}.
   */
  readonly project?: TProject;

  /**
   * Test runner.
   *
   * Test may be run either with `swc`, or with `ts-jest`.
   *
   * @defaultValue `swc`, unless overridden by `RUNZ_TEST_RUNNER` environment variable.
   */
  readonly runner?: 'swc' | 'ts-jest' | undefined;

  /**
   * Jest configuration options to apply.
   */
  readonly options?: Config.InitialOptions | undefined;
}

function ProjectTests$defaultRunner(): 'swc' | 'ts-jest' {
  switch (process.env.RUNZ_TEST_RUNNER) {
    case 'ts-jest':
      return 'ts-jest';
    case 'swc':
    default:
      return 'swc';
  }
}
