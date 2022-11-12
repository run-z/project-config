import deepmerge from 'deepmerge';
import { isPresent } from '../impl/is-present.js';
import { type ProjectConfig } from '../project-config.js';
import { ProjectDevHostType, type ProjectDevHost } from '../project-dev-host.js';
import { ProjectDevTool } from '../project-dev-tool.js';
import { type PackageJson } from './package.json';
import {
  isPathExport,
  loadPackageJson,
  PackageJson$EntryPoint,
  PackageJson$ExportItem,
} from './package.json.impl.js';
import { ProjectEntry$, ProjectEntry$Main } from './project-entry.impl.js';
import { ProjectEntry } from './project-entry.js';
import { ProjectExport } from './project-export.js';

function ProjectPackage$create(project: ProjectConfig): ProjectPackage {
  const pkg = project.tools.package;

  if (!pkg) {
    return new ProjectPackage(project);
  }
  if (pkg instanceof ProjectPackage) {
    return pkg;
  }

  return new ProjectPackage(project).extendPackageJson(pkg);
}

/**
 * Package configuration constructed by `package.json` contents.
 */
export class ProjectPackage extends ProjectDevTool implements ProjectDevHost {

  /**
   * Gains package configuration of the project.
   *
   * Respects {@link ProjectToolsInit#package defaults}.
   *
   * @param project - Configured project.
   *
   * @returns Package configuration instance.
   */
  static of(project: ProjectConfig): ProjectPackage {
    return project.get(ProjectPackage$create);
  }

  #autoloaded = true;
  #customPackageJson: () => PackageJson | PromiseLike<PackageJson>;
  #customEntries?: Map<PackageJson.EntryPath, ProjectEntry>;

  #packageJson?: Promise<PackageJson>;
  #entryPoints?: Promise<ReadonlyMap<PackageJson.EntryPath, PackageJson.EntryPoint>>;
  #exports?: Promise<ReadonlyMap<PackageJson.EntryPath, ProjectExport>>;
  #entries?: Promise<ReadonlyMap<PackageJson.EntryPath, ProjectEntry>>;
  #generatedEntries?: Promise<ReadonlyMap<PackageJson.EntryPath, ProjectEntry.Generated>>;
  #mainEntry?: Promise<ProjectEntry>;

  /**
   * Constructs project package configuration.
   *
   * @param project - Configured project.
   */
  constructor(project: ProjectConfig) {
    super(project);
    this.#customPackageJson = () => ({});
  }

  protected override clone(): this {
    const clone = super.clone();

    clone.#autoloaded = this.#autoloaded;
    clone.#customPackageJson = this.#customPackageJson;
    clone.#customEntries = this.#customEntries;

    return clone;
  }

  get type(): ProjectDevHostType<this> {
    return this.constructor as ProjectDevHostType<this>;
  }

  /**
   * Whether contents loaded from `package.json` file automatically prior to applying custom ones.
   *
   * `true` by default.
   */
  get autoloaded(): boolean {
    return this.#autoloaded;
  }

  /**
   * Promise resolved to `package.json` contents.
   */
  get packageJson(): Promise<PackageJson> {
    return (this.#packageJson ||= this.#buildPackageJson());
  }

  async #buildPackageJson(): Promise<PackageJson> {
    const custom = await this.#customPackageJson();

    if (!this.autoloaded) {
      return custom;
    }

    return deepmerge(loadPackageJson(this.project), custom);
  }

  /**
   * Detects whether this package depends on the given one.
   *
   * @param packageName - Dependency package name.
   *
   * @returns Promise resolved to `true` when the package found among {@link PackageJson#dependencies runtime
   * dependencies}, to `'dev'` when it is found among {@link PackageJson#devDependencies development dependencies},
   * or to `false` otherwise.
   */
  async dependsOn(packageName: string): Promise<boolean | 'dev'> {
    const packageJson = await this.packageJson;

    if (packageJson.dependencies?.[packageName]) {
      return true;
    }
    if (packageJson.devDependencies?.[packageName]) {
      return 'dev';
    }

    return false;
  }

  /**
   * Read-only map of package entry points with exported paths or patterns as their keys.
   */
  get entryPoints(): Promise<ReadonlyMap<PackageJson.EntryPath, PackageJson.EntryPoint>> {
    return (this.#entryPoints ??= this.#buildEntryPoints());
  }

  async #buildEntryPoints(): Promise<ReadonlyMap<PackageJson.EntryPath, PackageJson.EntryPoint>> {
    const items = new Map<PackageJson.EntryPath, PackageJson$ExportItem[]>();

    for await (const item of this.#listExports()) {
      const found = items.get(item.path);

      if (found) {
        found.push(item);
      } else {
        items.set(item.path, [item]);
      }
    }

    return new Map(
      [...items].map(([path, items]) => [path, new PackageJson$EntryPoint(path, items)]),
    );
  }

  async *#listExports(): AsyncIterableIterator<PackageJson$ExportItem> {
    const { exports, main } = await this.packageJson;

    if (!exports) {
      if (!main) {
        return;
      }

      yield {
        path: '.',
        conditions: [],
        target: main.startsWith('./') ? (main as `./${string}`) : `./${main}`,
      };

      return;
    }

    yield* this.#condExports([], exports);
  }

  *#condExports(
    conditions: readonly string[],
    exports: PackageJson.TopConditionalExports | PackageJson.PathExports | `./${string}`,
  ): IterableIterator<PackageJson$ExportItem> {
    if (typeof exports === 'string') {
      yield { path: '.', conditions, target: exports };

      return;
    }

    for (const [key, entry] of Object.entries(exports)) {
      if (isPathExport(key)) {
        yield* this.#pathExports(key, conditions, entry);
      } else {
        yield* this.#condExports([...conditions, key], entry);
      }
    }
  }

  *#pathExports(
    path: PackageJson.EntryPath,
    conditions: readonly string[],
    exports: PackageJson.ConditionalExports | `./${string}`,
  ): IterableIterator<PackageJson$ExportItem> {
    if (typeof exports === 'string') {
      yield { path, conditions, target: exports };

      return;
    }

    for (const [key, entry] of Object.entries(exports)) {
      yield* this.#pathExports(path, [...conditions, key], entry);
    }
  }

  /**
   * Promise resolved to the main entry of the project.
   */
  get mainEntry(): Promise<ProjectEntry> {
    return (this.#mainEntry ??= this.#findMainEntry());
  }

  /**
   * Assigns main project entry.
   *
   * @param entry - New main entry to assign.
   *
   * @returns Updated instance.
   */
  withMainEntry(entry: ProjectEntry): this {
    return this.withEntry('.', entry);
  }

  async #findMainEntry(): Promise<ProjectEntry> {
    return await this.entryFor('.');
  }

  /**
   * Promise resolved to project entries map with their {@link ProjectEntry.name names} as keys.
   */
  get entries(): Promise<ReadonlyMap<PackageJson.EntryPath, ProjectEntry>> {
    return (this.#entries ??= this.#buildEntries());
  }

  async #buildEntries(): Promise<ReadonlyMap<PackageJson.EntryPath, ProjectEntry>> {
    const exports = await this.exports;
    let entries: Map<PackageJson.EntryPath, ProjectEntry> | undefined;

    if (this.#customEntries) {
      entries = new Map(exports);
      for (const [path, entry] of this.#customEntries) {
        entries.set(path, entry);
      }
    }
    if (entries ? !entries.has('.') : !exports.has('.')) {
      entries ??= new Map(exports);
      entries.set('.', new ProjectEntry$Main(this));
    }

    return entries ?? exports;
  }

  /**
   * Gains project entry for the given export path.
   *
   * @param path - Target export path.
   *
   * @returns Corresponding project entry, or new one if not exists yet.
   */
  async entryFor(path: PackageJson.EntryPath): Promise<ProjectEntry> {
    const entries = await this.entries;

    return entries.get(path) ?? new ProjectEntry$(this);
  }

  /**
   * Assigns project entry for the given export path.
   *
   * @param path - Export path of the entry.
   * @param entry - Project entry to assign.
   *
   * @returns Updated instance.
   */
  withEntry(path: PackageJson.EntryPath, entry: ProjectEntry): this {
    const clone = this.clone();

    clone.#customEntries = this.#customEntries ? new Map(this.#customEntries) : new Map();
    clone.#customEntries.set(path, entry);

    return clone;
  }

  /**
   * Promise resolved to {@link ProjectEntry#isGEnerated generated} project entries with their
   * {@link ProjectEntry.name names} as keys.
   */
  get generatedEntries(): Promise<ReadonlyMap<PackageJson.EntryPath, ProjectEntry.Generated>> {
    return (this.#generatedEntries ??= this.#detectGeneratedEntries());
  }

  async #detectGeneratedEntries(): Promise<
    ReadonlyMap<PackageJson.EntryPath, ProjectEntry.Generated>
  > {
    const allEntries = await this.entries;
    const entries = await Promise.all(
      [...allEntries].map(
        async ([name, entry]): Promise<
          [PackageJson.EntryPath, ProjectEntry.Generated] | undefined
        > => {
          const generated = await entry.toGenerated();

          return generated && [name, generated];
        },
      ),
    );

    return new Map(entries.filter(isPresent));
  }

  /**
   * Promise resolved to project exports map with their {@link ProjectEntry.name names} as keys.
   */
  get exports(): Promise<ReadonlyMap<PackageJson.EntryPath, ProjectExport>> {
    return (this.#exports ??= this.#detectExports());
  }

  async #detectExports(): Promise<ReadonlyMap<PackageJson.EntryPath, ProjectExport>> {
    const entryPoints = await this.entryPoints;

    return new Map(
      [...entryPoints].map(([name, entryPoint]) => [name, new ProjectExport(this, entryPoint)]),
    );
  }

  /**
   * Replaces `package.json` contents with custom ones.
   *
   * Clears custom `package.json` contents, and prevents their {@link autoloaded automatic loading}.
   *
   * @param packageJson - New `package.json` contents to apply.
   *
   * @returns Updated instance.
   */
  replacePackageJson(packageJson: PackageJson | PromiseLike<PackageJson>): this {
    const clone = this.clone();

    clone.#autoloaded = false;
    clone.#customPackageJson = () => packageJson;

    return clone;
  }

  /**
   * Replaces custom `package.json` contents with autoloaded ones.
   *
   * Clears custom options, and forces {@link autoloaded automatic loading}.
   *
   * @param packageJson - `package.json` contents extending autoloaded ones.
   *
   * @returns Updated instance.
   */
  autoloadPackageJson(packageJson: PackageJson | PromiseLike<PackageJson>): this {
    const clone = this.clone();

    clone.#autoloaded = true;
    clone.#customPackageJson = () => packageJson;

    return clone;
  }

  /**
   * Extends `package.json` contents.
   *
   * @param extension - `package.json` contents extending previous ones.
   *
   * @returns Updated instance.
   */
  extendPackageJson(extension: PackageJson | PromiseLike<PackageJson>): this {
    const clone = this.clone();
    const prevPackageJson = this.#customPackageJson;

    clone.#customPackageJson = async () => deepmerge(await prevPackageJson(), await extension);

    return clone;
  }

}
