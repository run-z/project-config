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

  /**
   * Constructs TypeScript configuration.
   *
   * @param project - Target project configuration.
   * @param init - TypeScript initialization options.
   */
  constructor(project: ProjectConfig, init: ProjectTypescriptInit = {}) {

    const {
      tsconfig = 'tsconfig.json',
      compilerOptions,
    } = init;

    this.#project = project;
    this.#tsconfig = tsconfig;
    this.#customCompilerOptions = compilerOptions;
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

      const formatHost: ts.FormatDiagnosticsHost = {
        getCurrentDirectory: () => this.#project.rootDir,
        getNewLine: () => ts.sys.newLine,
        getCanonicalFileName: ts.sys.useCaseSensitiveFileNames ? f => f : f => f.toLowerCase(),
      };

      console.error(ts.formatDiagnosticsWithColorAndContext([error], formatHost));

      throw new Error(`Can not parse TypeScript configuration: ${this.#tsconfig}`);
    }

    return this.#compilerOptions = {
      ...config.compilerOptions,
      ...this.#customCompilerOptions,
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
