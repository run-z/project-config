import { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PackageJson } from './package/package-json.js';
import { ProjectConfig } from './project-config.js';
import { ProjectEntry } from './project-entry.js';
import { ProjectOutput } from './project-output.js';

/**
 * Project entry corresponding to {@link PackageJson.EntryPoint package export}.
 */
export class ProjectExport extends ProjectEntry {

  /**
   * Tries to create project entry.
   *
   * @param init - Export initialization options.
   *
   * @returns Promise resolved either to project export instance, or to `undefined` if source file unspecified
   * or can not be found.
   */
  static async create(
    this: void,
    init: ProjectExportInit = {},
  ): Promise<ProjectExport | undefined> {
    const { project = new ProjectConfig(), entryPoint = project.packageJson.entryPoints.get('.') } =
      init;

    if (!entryPoint) {
      return;
    }

    const distFilePath =
      entryPoint.withConditions('import') || entryPoint.withConditions('default');

    if (!distFilePath) {
      return;
    }

    const output = await project.output;
    const distFile = path.relative(output.distDir, distFilePath);

    const { sourceFile = await ProjectExport$detectSourceFile(project, distFile) } = init;

    if (!sourceFile) {
      return;
    }

    return new ProjectExport({ output, entryPoint, sourceFile, distFile });
  }

  readonly #entryPoint: PackageJson.EntryPoint;
  readonly #sourceFile: string;
  readonly #distFile: string;

  /**
   * Constructs project export entry of the `project`.
   *
   * @param init - Export initialization options.
   */
  protected constructor(
    init: Omit<Required<ProjectExportInit>, 'project'> & {
      readonly output: ProjectOutput;
      readonly distFile: string;
    },
  ) {
    const { output, entryPoint, sourceFile, distFile } = init;

    super(output);

    this.#entryPoint = entryPoint;
    this.#sourceFile = sourceFile;
    this.#distFile = distFile;
  }

  /**
   * Package entry point this project export represents.
   */
  get entryPoint(): PackageJson.EntryPoint {
    return this.#entryPoint;
  }

  /**
   * Searches for path or pattern matching to all of provided conditions.
   *
   * Tries to find an entry point without `default` and `import` conditions if not found.
   *
   * @param conditions - Required export conditions. When missing, searches for `default` one.
   *
   * @returns Matching path or pattern, or `undefined` when not found.
   */
  withConditions(...conditions: string[]): `./${string}` | undefined {
    return (
      this.entryPoint.withConditions(...conditions)
      || this.entryPoint.withConditions(
        ...conditions.filter(condition => condition !== 'import' && condition !== 'default'),
      )
    );
  }

  get isMain(): boolean {
    return this.entryPoint.path === '.';
  }

  get sourceFile(): string {
    return this.#sourceFile;
  }

  get distFile(): string {
    return this.#distFile;
  }

  toExport(): this {
    return this;
  }

}

/**
 * Project export initialization options.
 */
export interface ProjectExportInit {
  /**
   * Target project configuration.
   *
   * New one will be constructed if omitted.
   */
  readonly project?: ProjectConfig | undefined;

  /**
   * Package entry point the project export represents.
   *
   * The one corresponding to the
   * [main entry point](https://nodejs.org/dist/latest/docs/api/packages.html#main-entry-point-export) (`"."`) will be
   * used when omitted.
   */
  readonly entryPoint?: PackageJson.EntryPoint | undefined;

  /**
   * Source file that will be transpiled to exported one.
   *
   * Will be reconstructed by export path when omitted.
   */
  readonly sourceFile?: string | undefined;
}

async function ProjectExport$detectSourceFile(
  project: ProjectConfig,
  distFile: string,
): Promise<string | undefined> {
  const ext = path.extname(distFile);
  const name = ext ? distFile.slice(0, -ext.length) : ext;
  let parts = name.split(path.sep);
  const lastPart = parts[parts.length - 1];
  const lastParts = lastPart.split('.').slice(1);

  parts = [...parts.slice(0, -1), ...lastParts];

  return await ProjectExport$findSourceFile(project, [...parts]);
}

const SOURCE_FILE_NAMES = [null, 'mod', 'main', 'index'];
const SOURCE_FILE_EXTENSIONS = ['.ts', '.mts', '.cts'];

async function ProjectExport$findSourceFile(
  project: ProjectConfig,
  searchPath: readonly string[],
): Promise<string | undefined> {
  for (const fileName of SOURCE_FILE_NAMES) {
    for (const extension of SOURCE_FILE_EXTENSIONS) {
      let filePath: string[];

      if (fileName) {
        filePath = [...searchPath, `${fileName}${extension}`];
      } else if (searchPath.length) {
        filePath = [...searchPath.slice(0, -1), searchPath[searchPath.length - 1] + extension];
      } else {
        continue;
      }

      let stat: Stats;

      try {
        stat = await fs.stat(path.join(project.sourceDir, ...filePath));
      } catch {
        continue;
      }

      if (stat.isFile()) {
        return path.join(...filePath);
      }
    }
  }

  return;
}
