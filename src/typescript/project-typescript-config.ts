import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type RawCompilerOptions } from 'ts-jest';
import type ts from 'typescript';
import { ProjectPackage } from '../package/project-package.js';
import { ProjectConfig } from '../project-config.js';
import { ProjectDevTool } from '../project-dev-tool.js';
import { ProjectError } from '../project.error.js';

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

  #generatedTsconfig?: Promise<TsConfigFile>;

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
   * Generated `tsconfig.json` file with custom options applied.
   */
  get generatedTsconfig(): Promise<TsConfigFile> {
    return (this.#generatedTsconfig ??= this.#generateTsconfig());
  }

  async #generateTsconfig(): Promise<TsConfigFile> {
    const { sourceDir } = this.project;
    const pkg = ProjectPackage.of(this.project);
    const entries = await pkg.generatedEntries;

    return await this.writeTsconfig('tsconfig.json', {
      files: await Promise.all(
        [...entries.values()].map(async entry => path.resolve(sourceDir, await entry.sourceFile)),
      ),
      include: [],
    });
  }

  /**
   * Creates custom `tsconfig.json` file, but does not write it to file system.
   *
   * The configuration file extends {@link #tsconfig project's `tsconfig.json`} by default and applies custom options.
   *
   * @param name - File name relative to {@link ProjectOutput#cacheDir cache directory}.
   * @param contents - Custom file contents.
   *
   * @returns Created file representation.
   */
  async createTsconfig(name: string, contents: TsConfigJson): Promise<TsConfigFile> {
    const { rootDir, sourceDir } = this.project;
    const { distDir, cacheDir } = await this.project.output;
    const file = path.resolve(cacheDir, name);
    const customOptions = this.tsconfig != null ? this.#customOptions() : undefined;

    const json = {
      ...contents,
      extends:
        contents.extends ?? (this.tsconfig ? path.resolve(rootDir, this.tsconfig) : undefined),
      compilerOptions: {
        ...customOptions,
        ...contents.compilerOptions,
        rootDir: sourceDir,
        outDir: distDir,
      },
    };

    const basePath = path.dirname(file);
    const ts = await this.typescript;
    const {
      options,
      errors,
      fileNames: files,
    } = ts.parseJsonConfigFileContent(json, ts.sys, basePath, undefined, file);

    if (errors.length) {
      throw new ProjectError(
        `Can not write TypeScript configuration (${file}):\n` +
          ts.formatDiagnosticsWithColorAndContext(errors, this.#errorFormatHost(ts)),
      );
    }

    return { file, json, options, files };
  }

  /**
   * Writes {@link createTsconfig custom} `tsconfig.json` file to specified location.
   *
   * The configuration file extends {@link #tsconfig project's `tsconfig.json`} by default and applies custom options.
   *
   * @param name - File name relative to {@link ProjectOutput#cacheDir cache directory}.
   * @param contents - Custom file contents.
   *
   * @returns Written file representation.
   */
  async writeTsconfig(name: string, contents: TsConfigJson): Promise<TsConfigFile> {
    const tsconfig = await this.createTsconfig(name, contents);

    const { file, json } = tsconfig;
    const basePath = path.dirname(file);

    await fs.mkdir(basePath, { recursive: true });
    await fs.writeFile(file, JSON.stringify(json, null, 2) + os.EOL);

    return tsconfig;
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

/**
 * Contents of `tsconfig.json` file.
 */
export interface TsConfigJson {
  readonly compilerOptions?: RawCompilerOptions | undefined;
  readonly exclude?: readonly string[] | undefined;
  readonly extends?: string | undefined;
  readonly files?: readonly string[] | undefined;
  readonly include?: readonly string[] | undefined;
}

/**
 * Representation to `tsconfig.json` file.
 */
export interface TsConfigFile {
  /**
   * Absolute path to the file.
   */
  readonly file: string;

  /**
   * File contents.
   */
  readonly json: TsConfigJson;

  /**
   * TypeScript compiler options extracted from file contents.
   */
  readonly options: ts.CompilerOptions;

  /**
   * Array of transpiled files.
   */
  readonly files: readonly string[];
}
