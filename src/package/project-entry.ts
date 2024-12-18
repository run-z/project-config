import { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { type ProjectConfig } from '../project-config.js';
import { ProjectDevTool } from '../project-dev-tool.js';
import { type ProjectOutput } from '../project-output.js';
import { type ProjectPackage } from './project-package.js';

/**
 * Abstract project entry configuration.
 *
 * @typeParam TEntry - Entry type.
 */
export abstract class ProjectEntry extends ProjectDevTool<ProjectPackage> {
  readonly #path: string;
  #name?: Promise<string | null>;
  #distFiles?: Promise<ProjectEntry.DistFiles | null>;
  #sourceFile?: Promise<string | null>;
  #typesFile?: Promise<string | null>;

  constructor(host: ProjectPackage, path: string) {
    super(host);
    this.#path = path;
  }

  /**
   * Export path of this entry.
   */
  get path(): string {
    return this.#path;
  }

  protected override clone(): this {
    const clone = super.clone();

    clone.#name = this.#name;
    clone.#distFiles = this.#distFiles;
    clone.#sourceFile = this.#sourceFile;
    clone.#typesFile = this.#typesFile;

    return clone;
  }

  /**
   * Gains project package configuration.
   */
  package(): ProjectPackage {
    return this.host();
  }

  /**
   * Whether this entry is generated by build tool.
   */
  get isGenerated(): Promise<boolean> {
    return this.#isGenerated();
  }

  async #isGenerated(): Promise<boolean> {
    const files = await Promise.all([this.distFiles, this.name, this.sourceFile, this.typesFile]);

    return files.every(file => !!file);
  }

  /**
   * Whether this entry has distribution file.
   */
  get hasDistFile(): boolean {
    return this.#distFile() != null;
  }

  /**
   * Short entry name.
   *
   * By default, equals to {@link distFiles distribution file} path relative to {@link ProjectOutput#distDir
   * distribution directory} without an extension.
   *
   * May be `null` for {@link isGenerated non-generated entries}.
   */
  get name(): Promise<string | null> {
    return (this.#name ??= this.detectName());
  }

  /**
   * Assigns entry name.
   *
   * @param name - New entry name.
   *
   * @returns Updated instance.
   */
  withName(name: string): this {
    const clone = this.clone();

    clone.#name = Promise.resolve(name);

    return clone;
  }

  protected async detectName(): Promise<string | null> {
    const distFile = await this.#distFile();

    if (!distFile) {
      return null;
    }

    const fileExt = path.extname(distFile);

    const { distDir } = await this.project.output;
    const fileName = path.relative(distDir, path.resolve(distDir, distFile));

    return fileExt ? fileName.slice(0, -fileExt.length) : fileExt;
  }

  /**
   * Path to source file to transpile during the build relative to {@link ProjectConfig#sourceDir sources directory},
   * or `null` if this entry is not transpiled.
   *
   * By default, searches for `main.(m|c)?ts`, `mod.(m|c)?ts`, or `index.(m|c)?ts` file in sources sub-directory
   * corresponding to {@link path export path} of the entry.
   *
   * For example:
   *
   * - `.` converted to `./src/mod.ts`,
   * - `./util` converted to `./src/util/mod.ts`.
   */
  get sourceFile(): Promise<string | null> {
    return (this.#sourceFile ??= this.detectSourceFile());
  }

  /**
   * Assigns source file to transpile during the build.
   *
   * @param file - New path to source file relative to {@link ProjectConfig#sourceDir sources directory}, or `null`
   * to not transpile this entry.
   *
   * @returns Updated instance.
   */
  withSourceFile(file: string | null): this {
    const clone = this.clone();

    clone.#sourceFile = Promise.resolve(file);

    return clone;
  }

  protected async detectSourceFile(): Promise<string | null> {
    if (!this.hasDistFile) {
      return null;
    }

    const { sourceDir } = this.project;

    for (const sourceName of this.#sourceCandidates()) {
      let stat: Stats;

      try {
        stat = await fs.stat(path.join(sourceDir, sourceName));
      } catch {
        continue;
      }

      if (stat.isFile()) {
        return sourceName;
      }
    }

    return null;
  }

  *#sourceCandidates(): IterableIterator<string> {
    const entryPath = this.path;
    let searchPath: string;
    let extPath: string | undefined;

    if (entryPath.endsWith('.js')) {
      searchPath = entryPath.slice(0, -3);
      extPath = entryPath;
    } else {
      searchPath = entryPath;
    }

    yield* this.#sourceNames(searchPath);
    yield* this.#indexNames(searchPath);
    if (extPath) {
      yield* this.#indexNames(extPath);
    }
  }

  *#indexNames(dir: string): IterableIterator<string> {
    for (const fileName of INDEX_FILE_NAMES) {
      yield* this.#sourceNames(path.join(dir, fileName));
    }
  }

  *#sourceNames(fileName: string): IterableIterator<string> {
    for (const extension of SOURCE_FILE_EXTENSIONS) {
      yield `${fileName}${extension}`;
    }
  }

  /**
   * Path to distribution files relative to {@link ProjectOutput#distDir distribution directory}.
   *
   * This is typically a file listed in `package.json` exports section and generated from
   * {@link sourceFile source file}.
   *
   * May be `null` when distribution files missing.
   */
  get distFiles(): Promise<ProjectEntry.DistFiles | null> {
    return (this.#distFiles ??= this.detectDistFiles());
  }

  /**
   * Assigns distribution files.
   *
   * @param distFiles - New distribution files, or `null` to omit entry generation.
   *
   * @returns Updated instance.
   */
  withDistFiles(distFiles: ProjectEntry.DistFiles | null): this {
    const clone = this.clone();

    clone.#distFiles = Promise.resolve(distFiles);

    return clone;
  }

  protected abstract detectDistFiles(): Promise<ProjectEntry.DistFiles | null>;

  async #distFile(): Promise<string | undefined> {
    const distFiles = await this.distFiles;

    if (!distFiles) {
      return;
    }

    return distFiles.esm ?? distFiles.commonJS;
  }

  /**
   * Path to types definition file relative to {@link ProjectOutput#distDir distribution directory}.
   *
   * By default, equals to {@link name entry name} with `.d.ts` extension.
   *
   * May be `null` for non-generated file.
   */
  get typesFile(): Promise<string | null> {
    return (this.#typesFile ??= this.detectTypesFile());
  }

  /**
   * Assigns types definition file.
   *
   * @param file - New types definition file path relative to {@link ProjectOutput#distDir distribution directory}.
   *
   * @returns Updated instance.
   */
  withTypesFile(file: string): this {
    const clone = this.clone();

    clone.#typesFile = Promise.resolve(file);

    return clone;
  }

  protected async detectTypesFile(): Promise<string | null> {
    const name = await this.name;

    return `${name}.d.ts`;
  }

  async toGenerated(): Promise<(this & ProjectEntry.Generated) | undefined> {
    return (await this.isGenerated) ? (this as this & ProjectEntry.Generated) : undefined;
  }
}

export namespace ProjectEntry {
  /**
   * Distribution files.
   *
   * One of ESM or CommonJS distribution files should always present.
   */
  export type DistFiles = ESMDistFiles | CommonJSDistFiles;

  export interface ESMDistFiles {
    readonly esm: string;
    readonly commonJS?: string | undefined;
  }

  export interface CommonJSDistFiles {
    readonly esm?: string | undefined;
    readonly commonJS: string;
  }

  export interface Generated extends ProjectEntry {
    readonly name: Promise<string>;
    readonly sourceFile: Promise<string>;
    readonly distFiles: Promise<DistFiles>;
    readonly typesFile: Promise<string>;
  }
}

const INDEX_FILE_NAMES = ['main', 'mod', 'index'];
const SOURCE_FILE_EXTENSIONS = ['.ts', '.mts', '.cts'];
