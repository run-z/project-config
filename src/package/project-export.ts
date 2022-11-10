import path from 'node:path';
import { ProjectConfig } from '../project-config.js';
import { ProjectError } from '../project.error.js';
import { PackageJson } from './package.json';
import { ProjectEntry } from './project-entry.js';

/**
 * Project entry corresponding to {@link PackageJson.EntryPoint package export}.
 */
export class ProjectExport extends ProjectEntry {

  readonly #entryPoint: PackageJson.EntryPoint;
  #distFile?: Promise<string>;

  /**
   * Constructs project export entry of the `project`.
   *
   * @param project - Configured project.
   * @param entryPoint - Package entry point to represent.
   */
  constructor(project: ProjectConfig, entryPoint: PackageJson.EntryPoint) {
    super(project);

    this.#entryPoint = entryPoint;
  }

  protected clone(): this {
    const clone = this.clone();

    clone.#distFile = this.#distFile;

    return clone;
  }

  /**
   * Package entry point this project export represents.
   */
  get entryPoint(): PackageJson.EntryPoint {
    return this.#entryPoint;
  }

  override get isMain(): boolean {
    return this.entryPoint.path === '.';
  }

  override get distFile(): Promise<string> {
    return (this.#distFile ??= this.#detectDistFile());
  }

  async #detectDistFile(): Promise<string> {
    const distFilePath =
      this.entryPoint.findConditional('import') || this.entryPoint.findConditional('default');

    if (!distFilePath) {
      throw new ProjectError(`Nothing exported for "${this.entryPoint.path}" package export`);
    }

    const { distDir } = await this.project.output;

    return path.relative(distDir, distFilePath);
  }

  protected override async detectTypesFile(): Promise<string> {
    const types = this.findConditional('types');

    if (!types) {
      return await super.typesFile;
    }

    const { distDir } = await this.project.output;

    return path.relative(distDir, types);
  }

  /**
   * Searches for path or pattern matching all provided conditions.
   *
   * Tries to find an entry point without `default` and `import` conditions if not found.
   *
   * @param conditions - Required export conditions. When missing, searches for `default` one.
   *
   * @returns Matching path or pattern, or `undefined` when not found.
   */
  findConditional(...conditions: string[]): `./${string}` | undefined {
    return (
      this.entryPoint.findConditional(...conditions)
      || this.entryPoint.findConditional(
        ...conditions.filter(condition => condition !== 'import' && condition !== 'default'),
      )
    );
  }

}
