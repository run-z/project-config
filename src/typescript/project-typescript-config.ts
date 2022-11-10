import path from 'node:path';
import { type RawCompilerOptions } from 'ts-jest';
import type ts from 'typescript';
import { ProjectConfig } from '../project-config.js';
import { ProjectDevTool } from '../project-dev-tool.js';

function ProjectTypescriptConfig$create(project: ProjectConfig): ProjectTypescriptConfig {
  const { typescript } = project.tools;

  if (!typescript) {
    return new ProjectTypescriptConfig(project);
  }
  if (typescript instanceof ProjectTypescriptConfig) {
    return typescript;
  }

  return new ProjectTypescriptConfig(project).extendOptions(typescript);
}

/**
 * TypeScript configuration of the project.
 */
export class ProjectTypescriptConfig extends ProjectDevTool {

  /**
   * Gains specified TypeScript configuration of the project.
   *
   * Respects {@link ProjectToolsInit#typescript defaults}.
   *
   * @param project - Configured project.
   *
   * @returns TypeScript configuration instance.
   */
  static of(project: ProjectConfig): ProjectTypescriptConfig {
    return project.get(ProjectTypescriptConfig$create);
  }

  #typescript?: Promise<typeof ts>;
  #tsconfig: string | null = 'tsconfig.json';
  #customOptions: () => RawCompilerOptions;
  #options?: Promise<RawCompilerOptions>;
  #tscOptions?: Promise<ts.CompilerOptions>;

  /**
   * Constructs TypeScript configuration.
   *
   * @param project - Configured project.
   */
  constructor(project: ProjectConfig) {
    super(project);
    this.#customOptions = () => ({});
  }

  protected override clone(): this {
    const clone = super.clone();

    clone.#typescript = this.#typescript;
    clone.#tsconfig = this.#tsconfig;
    clone.#customOptions = this.#customOptions;

    return clone;
  }

  /**
   * TypeScript API instance.
   */
  get typescript(): Promise<typeof ts> {
    return (this.#typescript ??= import('typescript').then(ts => ts.default));
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
  get options(): Promise<RawCompilerOptions> {
    return (this.#options ??= this.#toOptions());
  }

  async #toOptions(): Promise<RawCompilerOptions> {
    const customOptions = this.#customOptions();

    if (this.tsconfig == null) {
      return customOptions;
    }

    const ts = await this.typescript;
    const tsconfig = path.resolve(this.project.rootDir, this.tsconfig);
    const { config = {}, error } = ts.readConfigFile(tsconfig, ts.sys.readFile) as {
      config?: { compilerOptions?: RawCompilerOptions };
      error?: ts.Diagnostic;
    };

    if (error) {
      console.error(ts.formatDiagnosticsWithColorAndContext([error], this.#errorFormatHost(ts)));

      throw new Error(`Can not parse TypeScript configuration: ${this.#tsconfig}`);
    }

    return {
      ...config.compilerOptions,
      ...customOptions,
    };
  }

  /**
   * TypeScript compiler options suitable for passing to TypeScript compiler API.
   */
  get tscOptions(): Promise<ts.CompilerOptions> {
    return (this.#tscOptions ??= this.#toTscOptions());
  }

  async #toTscOptions(): Promise<ts.CompilerOptions> {
    const ts = await this.typescript;
    const { options, errors } = ts.convertCompilerOptionsFromJson(
      this.options,
      this.project.rootDir,
      'tsconfig.custom.json',
    );

    if (errors.length) {
      console.error(ts.formatDiagnosticsWithColorAndContext(errors, this.#errorFormatHost(ts)));

      throw new Error(
        `Can not parse TypeScript compiler options: ${this.tsconfig || 'tsconfig.custom.json'}`,
      );
    }

    return options;
  }

  #errorFormatHost(typescript: typeof ts): ts.FormatDiagnosticsHost {
    return {
      getCurrentDirectory: () => this.project.rootDir,
      getNewLine: () => typescript.sys.newLine,
      getCanonicalFileName: typescript.sys.useCaseSensitiveFileNames
        ? f => f
        : f => f.toLowerCase(),
    };
  }

  /**
   * Replaces TypeScript compiler options with custom ones.
   *
   * Clears custom options, and prevents loading them from {@link tsconfig configuration file}.
   *
   * @param options - TypeScript compiler options to use.
   *
   * @returns Updated instance.
   */
  replaceOptions(options: RawCompilerOptions): this {
    const clone = this.clone();

    clone.#tsconfig = null;
    clone.#customOptions = () => options;

    return clone;
  }

  /**
   * Replaces custom TypeScript compiler options with loaded ones.
   *
   * Clears custom options, and loads them from {@link tsconfig configuration file}.
   *
   * @param tsconfig - Configuration file to load. `tsconfig.json` by default.
   * @param options - TypeScript compiler options extending loaded ones.
   *
   * @returns Updated instance.
   */
  loadOptions(tsconfig: string | undefined, options: RawCompilerOptions): this;

  /**
   * Replaces custom TypeScript compiler options with the ones loaded from `tsconfig.json` file.
   *
   * Clears custom options, and loads them from {@link tsconfig configuration file}.
   *
   * @param options - TypeScript compiler options extending loaded ones.
   *
   * @returns Updated instance.
   */
  loadOptions(options?: RawCompilerOptions): this;

  loadOptions(
    tsconfigOrOptions: string | RawCompilerOptions = 'tsconfig.json',
    options?: RawCompilerOptions,
  ): this {
    const clone = this.clone();
    let compilerOptions: RawCompilerOptions;

    if (typeof tsconfigOrOptions === 'string') {
      clone.#tsconfig = tsconfigOrOptions;
      compilerOptions = options ?? {};
    } else {
      clone.#tsconfig = 'tsconfig.json';
      compilerOptions = tsconfigOrOptions ?? {};
    }

    clone.#customOptions = () => compilerOptions;

    return clone;
  }

  /**
   * Extends TypeScript compiler options.
   *
   * @param extension - TypeScript compiler options extending previous ones.
   *
   * @returns Updated instance.
   */
  extendOptions(extension: RawCompilerOptions): this {
    const clone = this.clone();
    const prevOptions = this.#customOptions;

    clone.#customOptions = () => ({ ...prevOptions(), ...extension });

    return clone;
  }

}
