import path from 'node:path';
import { RawCompilerOptions } from 'ts-jest';
import ts from 'typescript';
import { ProjectConfig } from '../project-config.js';

/**
 * TypeScript's configuration of the project.
 */
export class ProjectTypescript implements ProjectTypescriptInit, Required<ProjectTypescriptInit> {

  readonly #project: ProjectConfig;
  readonly #tsconfig: string;
  readonly #customCompilerOptions: RawCompilerOptions | undefined;
  #compilerOptions?: RawCompilerOptions;
  #tscOptions?: ts.CompilerOptions;

  /**
   * Constructs TypeScript configuration.
   *
   * @param project - Target project configuration.
   * @param init - TypeScript initialization options.
   */
  constructor(project: ProjectConfig, init: ProjectTypescriptInit = {}) {
    const { tsconfig = 'tsconfig.json', compilerOptions } = init;

    this.#project = project;
    this.#tsconfig = tsconfig;
    this.#customCompilerOptions = compilerOptions;
  }

  get project(): ProjectConfig {
    return this.#project;
  }

  /**
   * TypeScript's configuration file path relative to {@link ProjectConfig.rootDir project root}
   */
  get tsconfig(): string {
    return this.#tsconfig;
  }

  /**
   * TypeScript compiler options.
   */
  get compilerOptions(): RawCompilerOptions {
    if (this.#compilerOptions) {
      return this.#compilerOptions;
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

    return (this.#compilerOptions = {
      ...config.compilerOptions,
      ...this.#customCompilerOptions,
    });
  }

  get tscOptions(): ts.CompilerOptions {
    if (this.#tscOptions) {
      return this.#tscOptions;
    }

    const { options, errors } = ts.convertCompilerOptionsFromJson(
      this.compilerOptions,
      this.project.rootDir,
      'tsconfig.custom.json',
    );

    if (errors.length) {
      console.error(ts.formatDiagnosticsWithColorAndContext(errors, this.#errorFormatHost()));

      throw new Error(`Can not parse TypeScript compiler options: ${this.#tsconfig}`);
    }

    return (this.#tscOptions = options);
  }

  #errorFormatHost(): ts.FormatDiagnosticsHost {
    return {
      getCurrentDirectory: () => this.#project.rootDir,
      getNewLine: () => ts.sys.newLine,
      getCanonicalFileName: ts.sys.useCaseSensitiveFileNames ? f => f : f => f.toLowerCase(),
    };
  }

}

/**
 * TypeScript initialization options.
 */
export interface ProjectTypescriptInit {
  /**
   * TypeScript's configuration file path relative to {@link ProjectConfig#rootDir project root}.
   *
   * @defaultValue `tsconfig.json`
   */
  readonly tsconfig?: string | undefined;

  /**
   * Compiler options to apply.
   */
  readonly compilerOptions?: RawCompilerOptions | undefined;
}
