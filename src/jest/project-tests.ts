import path from 'node:path';
import { InitialOptionsTsJest } from 'ts-jest';
import { ProjectConfig } from '../project-config.js';

/**
 * Configuration of project tests utilizing Jest.
 */
export class ProjectTests implements ProjectTestsInit, Required<ProjectTestsInit> {

  /**
   * Configures and builds Jest options.
   *
   * @returns A promise resolved to Jest options.
   */
  static async build(this: void, init?: ProjectTestsInit): Promise<InitialOptionsTsJest> {
    return new ProjectTests(init).build();
  }

  readonly #project: ProjectConfig;
  readonly #runner: 'swc' | 'ts-jest';
  readonly #options: InitialOptionsTsJest;

  /**
   * Constructs project tests configuration.
   *
   * @param init - Tests initialization options.
   */
  constructor(init: ProjectTestsInit = {}) {
    const {
      project = new ProjectConfig(),
      runner = ProjectTests$defaultRunner(),
      options = {},
    } = init;

    this.#project = project;
    this.#runner = runner;
    this.#options = options;
  }

  get project(): ProjectConfig {
    return this.#project;
  }

  get runner(): 'swc' | 'ts-jest' {
    return this.#runner;
  }

  get options(): InitialOptionsTsJest {
    return this.#options;
  }

  /**
   * Builds Jest options.
   *
   * @returns A promise resolved to Jest options.
   */
  build(): Promise<InitialOptionsTsJest> {
    const swc = this.runner === 'swc';
    const options = this.#options;
    const config: InitialOptionsTsJest &
      Required<Pick<InitialOptionsTsJest, 'globals' | 'reporters' | 'transform'>> = {
      ...options,
      extensionsToTreatAsEsm: options.extensionsToTreatAsEsm ?? ['.ts'],
      globals: {
        ...(options.globals || { 'ts-jest': {} }),
      },
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
                outputDirectory: path.join(this.#project.targetDir, 'test-results'),
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
        const { experimentalDecorators, emitDecoratorMetadata }
          = this.#project.typescript.compilerOptions;

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
        config.globals['ts-jest'] = {
          tsconfig: {
            ...this.#project.typescript.compilerOptions,
            esModuleInterop: true,
            noUnusedLocals: false,
            noUnusedParameters: false,
          },
          useESM: true,
        };
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
      config.coverageDirectory
        = options.coverageDirectory ?? path.join(this.#project.targetDir, 'coverage');
      config.coverageThreshold = options.coverageThreshold ?? {
        global: {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      };
    }

    return Promise.resolve(config);
  }

}

/**
 * Tests initialization options.
 */
export interface ProjectTestsInit {
  /**
   * Project configuration.
   *
   * New one will be constructed if omitted.
   */
  readonly project?: ProjectConfig | undefined;

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
  readonly options?: InitialOptionsTsJest | undefined;
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
