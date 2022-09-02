import path from 'node:path';
import { ProjectConfig } from './project-config.js';
import { ProjectExport } from './project-export.js';
import { ProjectOutput } from './project-output.js';

/**
 * Abstract project entry configuration.
 */
export abstract class ProjectEntry {

  readonly #output: ProjectOutput;
  #name?: string;

  /**
   * Constructs project entry configuration for the `project`.
   *
   * @param output - Target project output configuration.
   */
  constructor(output: ProjectOutput) {
    this.#output = output;
  }

  /**
   * Whether this entry is main one.
   */
  get isMain(): boolean {
    return false;
  }

  /**
   * Target project configuration.
   */
  get project(): ProjectConfig {
    return this.output.project;
  }

  /**
   * Target project output configuration.
   */
  get output(): ProjectOutput {
    return this.#output;
  }

  /**
   * Short entry name.
   *
   * By defaults, equals to {@link distFile distribution file} path relative to {@link ProjectOutput#distDir
   * distribution directory} without an extension.
   */
  get name(): string {
    if (!this.#name) {
      const distFile = this.distFile;
      const fileExt = path.extname(distFile);
      const fileName = path.relative(
        this.output.distDir,
        path.resolve(this.output.distDir, distFile),
      );

      this.#name = fileExt ? fileName.slice(0, -fileExt.length) : fileExt;
    }

    return this.#name;
  }

  /**
   * Path to source file to transpile during the build relative to {@link ProjectConfig#sourceDir sources directory}.
   */
  abstract get sourceFile(): string;

  /**
   * Path to distribution file relative to {@link ProjectOutput#distDir distribution directory}.
   *
   * This is typically a file listed in `package.json` exports section and generated from
   * {@link sourceFile source file}.
   */
  abstract get distFile(): string;

  /**
   * Tries to represent this entry as {@link ProjectExport project export}.
   *
   * @returns Either project export, or `undefined` if this entry does not represent a project export.
   */
  toExport(): ProjectExport | undefined {
    return;
  }

}
