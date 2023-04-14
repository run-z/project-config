import path from 'node:path';
import { type PackageJson } from './package.json';
import { PackageJson$DefaultEntryPoint } from './package.json.impl.js';
import { ProjectEntry } from './project-entry.js';
import { type ProjectPackage } from './project-package.js';

/**
 * Project entry corresponding to {@link PackageJson.EntryPoint package export}.
 */
export class ProjectExport extends ProjectEntry {

  #entryPoint: PackageJson.EntryPoint;

  /**
   * Constructs project export entry of the `project`.
   *
   * @param projectPackage - Project package configuration.
   * @param entryPoint - Package entry point to represent.
   */
  constructor(
    projectPackage: ProjectPackage,
    entryPoint: PackageJson.EntryPoint = PackageJson$DefaultEntryPoint,
  ) {
    super(projectPackage, entryPoint.path);

    this.#entryPoint = entryPoint;
  }

  protected override clone(): this {
    const clone = super.clone();

    clone.#entryPoint = this.#entryPoint;

    return clone;
  }

  /**
   * Package entry point this project export represents.
   */
  get entryPoint(): PackageJson.EntryPoint {
    return this.#entryPoint;
  }

  protected override async detectDistFiles(): Promise<ProjectEntry.DistFiles | null> {
    const esm = await this.#findDistFile('import');
    const commonJS = await this.#findDistFile('require');
    const defaultDist = await this.#findDistFile('default');

    if (esm) {
      // Explicit ESM entry point.
      if (commonJS) {
        // ...and explicit CommonJS entry point.
        return {
          esm,
          commonJS,
        };
      }

      if (!defaultDist || defaultDist === esm) {
        // No default entry, or it is the same as ESM.
        // No CommonJS distribution.
        return { esm };
      }

      // Use default entry point as CommonJS one.
      return { esm, commonJS: defaultDist };
    }

    if (commonJS) {
      // Explicit CommonJS entry only.
      if (!defaultDist || defaultDist === commonJS) {
        // No default entry, or it is the same as CommonJS.
        // No ESM distribution.
        return { commonJS };
      }

      // Use default entry point as ESM one.
      return { esm: defaultDist, commonJS };
    }

    if (!defaultDist) {
      // No suitable entries.
      return null;
    }

    // No explicit ESM or CommonJS entries.
    // Detect the type of default one.

    if (defaultDist.endsWith('.mjs')) {
      // Explicitly marked as ESM.
      return { esm: defaultDist };
    }
    if (defaultDist.endsWith('.cjs')) {
      // Explicitly marked as CommonJS.
      return { commonJS: defaultDist };
    }

    const { type } = await this.package().packageJson;

    // Detect by package type as the last resort.
    return type === 'module' ? { esm: defaultDist } : { commonJS: defaultDist };
  }

  async #findDistFile(condition: string): Promise<string | undefined> {
    const file = this.entryPoint.findConditional(condition);

    if (!file) {
      return;
    }

    const filePath = path.resolve(this.project.rootDir, file);
    const { distDir } = await this.project.output;

    return filePath.startsWith(`${distDir}${path.sep}`)
      ? path.relative(distDir, filePath)
      : undefined;
  }

  protected override async detectSourceFile(): Promise<string | null> {
    const source = this.findConditional('source');

    if (source) {
      return path.relative(this.project.sourceDir, source);
    }

    return await super.detectSourceFile();
  }

  protected override async detectTypesFile(): Promise<string | null> {
    const types = this.findConditional('types');

    if (!types) {
      return await super.detectTypesFile();
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
