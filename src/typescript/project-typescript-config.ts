import path from 'node:path';
import { RawCompilerOptions } from 'ts-jest';
import ts from 'typescript';
import { ProjectConfig, ProjectSpec } from '../project-config.js';

function ProjectTypescriptConfig$create(
  project: ProjectConfig,
  options?: RawCompilerOptions,
): ProjectTypescriptConfig {
  const { typescript } = project.tools;

  if (typescript) {
    const config =
      typescript instanceof ProjectTypescriptConfig
        ? typescript
        : new ProjectTypescriptConfig(project, typescript);

    if (options) {
      config.extendOptions(options);
    }

    return config;
  }

  return new ProjectTypescriptConfig(project, options);
}

/**
 * TypeScript configuration of the project.
 */
export class ProjectTypescriptConfig {

  /**
   * Gains specified TypeScript configuration of the project.
   *
   * Utilizes {@link ProjectToolsInit#typescript TypeScript tool initializer}.
   *
   * TypeScript configuration can be specified by one of:
   *
   * - TypeScript configuration instance, which is returned as is.
   * - TypeScript compiler options to apply on top of the ones loaded from `tsconfig.json` file.
   *   New TypeScript configuration created in this case.
   * - Nothing to create default configuration.
   *
   * @param project - Configured project {@link @run-z/project-config!ProjectConfig.of specifier}.
   * @param spec - TypeScript configuration specifier.
   *
   * @returns TypeScript configuration instance.
   */
  static of(project?: ProjectSpec, spec?: ProjectTypescriptSpec): ProjectTypescriptConfig {
    if (spec instanceof ProjectTypescriptConfig) {
      return spec;
    }

    const projectConfig = ProjectConfig.of(project);

    return spec
      ? ProjectTypescriptConfig$create(projectConfig, spec)
      : projectConfig.get(ProjectTypescriptConfig$create);
  }

  readonly #project: ProjectConfig;
  #tsconfig: string | null = 'tsconfig.json';
  #customOptions: () => RawCompilerOptions;
  #options?: RawCompilerOptions;
  #tscOptions?: ts.CompilerOptions;

  /**
   * Constructs TypeScript configuration.
   *
   * @param project - Configured project specifier.
   * @param options - TypeScript compiler options.
   */
  constructor(project?: ProjectSpec, options: RawCompilerOptions = {}) {
    this.#project = ProjectConfig.of(project);
    this.#customOptions = () => options;
  }

  #rebuild(): this {
    this.#options = undefined;
    this.#tscOptions = undefined;

    return this;
  }

  get project(): ProjectConfig {
    return this.#project;
  }

  /**
   * TypeScript's configuration file path relative to {@link ProjectConfig.rootDir project root}.
   *
   * `null` to ignore configuration files.
   */
  get tsconfig(): string | null {
    return this.#tsconfig;
  }

  /**
   * TypeScript compiler options.
   */
  get options(): RawCompilerOptions {
    return (this.#options ??= this.#toOptions());
  }

  #toOptions(): RawCompilerOptions {
    const customOptions = this.#customOptions();

    if (this.tsconfig == null) {
      return customOptions;
    }

    const tsconfig = path.resolve(this.#project.rootDir, this.tsconfig);
    const { config = {}, error } = ts.readConfigFile(tsconfig, ts.sys.readFile) as {
      config?: { compilerOptions?: RawCompilerOptions };
      error?: ts.Diagnostic;
    };

    if (error) {
      console.error(ts.formatDiagnosticsWithColorAndContext([error], this.#errorFormatHost()));

      throw new Error(`Can not parse TypeScript configuration: ${this.#tsconfig}`);
    }

    return (this.#options = {
      ...config.compilerOptions,
      ...customOptions,
    });
  }

  /**
   * TypeScript compiler options suitable for passing to TypeScript compiler API.
   */
  get tscOptions(): ts.CompilerOptions {
    return (this.#tscOptions ??= this.#toTscOptions());
  }

  #toTscOptions(): ts.CompilerOptions {
    const { options, errors } = ts.convertCompilerOptionsFromJson(
      this.options,
      this.project.rootDir,
      'tsconfig.custom.json',
    );

    if (errors.length) {
      console.error(ts.formatDiagnosticsWithColorAndContext(errors, this.#errorFormatHost()));

      throw new Error(
        `Can not parse TypeScript compiler options: ${this.tsconfig || 'tsconfig.custom.json'}`,
      );
    }

    return options;
  }

  #errorFormatHost(): ts.FormatDiagnosticsHost {
    return {
      getCurrentDirectory: () => this.#project.rootDir,
      getNewLine: () => ts.sys.newLine,
      getCanonicalFileName: ts.sys.useCaseSensitiveFileNames ? f => f : f => f.toLowerCase(),
    };
  }

  /**
   * Replaces TypeScript compiler options with custom ones.
   *
   * Clears custom options, and prevents loading them from {@link tsconfig configuration file}.
   *
   * @param options - TypeScript compiler options to use.
   *
   * @returns `this` instance.
   */
  replaceOptions(options: RawCompilerOptions): this {
    this.#tsconfig = null;
    this.#customOptions = () => options;

    return this.#rebuild();
  }

  /**
   * Replaces custom TypeScript compiler options with loaded ones.
   *
   * Clears custom options, and loads them from {@link tsconfig configuration file}.
   *
   * @param tsconfig - Configuration file to load. `tsconfig.json` by default.
   * @param options - TypeScript compiler options extending loaded ones.
   *
   * @returns `this` instance.
   */
  loadOptions(tsconfig: string | undefined, options: RawCompilerOptions): this;

  /**
   * Replaces custom TypeScript compiler options with the ones loaded from `tsconfig.json` file.
   *
   * Clears custom options, and loads them from {@link tsconfig configuration file}.
   *
   * @param options - TypeScript compiler options extending loaded ones.
   *
   * @returns `this` instance.
   */
  loadOptions(options?: RawCompilerOptions): this;

  loadOptions(
    tsconfigOrOptions: string | RawCompilerOptions = 'tsconfig.json',
    options?: RawCompilerOptions,
  ): this {
    let compilerOptions: RawCompilerOptions;

    if (typeof tsconfigOrOptions === 'string') {
      this.#tsconfig = tsconfigOrOptions;
      compilerOptions = options ?? {};
    } else {
      this.#tsconfig = 'tsconfig.json';
      compilerOptions = tsconfigOrOptions ?? {};
    }

    this.#customOptions = () => compilerOptions;

    return this.#rebuild();
  }

  /**
   * Extends TypeScript compiler options.
   *
   * @param extension - TypeScript compiler options extending previous ones.
   *
   * @returns `this` instance.
   */
  extendOptions(extension: RawCompilerOptions): this {
    const prevOptions = this.#customOptions;

    this.#customOptions = () => ({ ...prevOptions(), ...extension });

    return this.#rebuild();
  }

}

/**
 * {@link ProjectTypescriptConfig.of Specifier} of TypeScript configuration of the project.
 */
export type ProjectTypescriptSpec = ProjectTypescriptConfig | RawCompilerOptions | undefined;
