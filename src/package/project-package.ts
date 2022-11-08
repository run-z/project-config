import deepmerge from 'deepmerge';
import module from 'node:module';
import path from 'node:path';
import { ProjectConfig } from '../project-config.js';
import { PackageJson } from './package.json';
import { ProjectEntry } from './project-entry.js';
import { ProjectExport } from './project-export.js';

function ProjectPackage$create(project: ProjectConfig): ProjectPackage {
  const pkg = project.tools.package;

  if (pkg) {
    if (pkg instanceof ProjectPackage) {
      return pkg;
    }

    return new ProjectPackage(project).extendOptions(pkg);
  }

  return new ProjectPackage(project);
}

/**
 * Package configuration constructed by `package.json` contents.
 */
export class ProjectPackage {

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

  readonly #project: ProjectConfig;
  #autoloaded = true;
  #customPackageJson: () => PackageJson | PromiseLike<PackageJson>;
  #packageJson?: Promise<PackageJson>;
  #entryPoints?: Promise<ReadonlyMap<'.' | `./${string}`, PackageJson.EntryPoint>>;
  #exports?: Promise<ReadonlyMap<string, ProjectExport>>;
  #mainEntry?: Promise<ProjectEntry>;

  /**
   * Constructs project package configuration.
   *
   * @param project - Configured project.
   */
  constructor(project: ProjectConfig) {
    this.#project = project;
    this.#customPackageJson = () => ({});
  }

  protected clone(): ProjectPackage {
    const clone = new ProjectPackage(this.project);

    clone.#autoloaded = this.#autoloaded;
    clone.#customPackageJson = this.#customPackageJson;

    return clone;
  }

  /**
   * Configured project.
   */
  get project(): ProjectConfig {
    return this.#project;
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
   * Read-only map of package entry points with exported paths or patterns as their keys.
   */
  get entryPoints(): Promise<ReadonlyMap<'.' | `./${string}`, PackageJson.EntryPoint>> {
    return (this.#entryPoints ??= this.#buildEntryPoints());
  }

  async #buildEntryPoints(): Promise<ReadonlyMap<'.' | `./${string}`, PackageJson.EntryPoint>> {
    const items = new Map<'.' | `./${string}`, PackageJson$ExportItem[]>();

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
    const { exports } = await this.packageJson;

    if (!exports) {
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
    path: '.' | `./${string}`,
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
    if (!this.#mainEntry) {
      this.#mainEntry = this.#findMainEntry();
    }

    return this.#mainEntry;
  }

  async #findMainEntry(): Promise<ProjectEntry> {
    const entries = await this.entries;

    for (const entry of entries.values()) {
      if (entry.isMain) {
        return entry;
      }
    }

    throw new ReferenceError('No main entry');
  }

  /**
   * Promise resolved to project entries map with their {@link ProjectEntry.name names} as keys.
   */
  get entries(): Promise<ReadonlyMap<string, ProjectEntry>> {
    return this.exports;
  }

  /**
   * Promise resolved to project exports map with their {@link ProjectEntry.name names} as keys.
   */
  get exports(): Promise<ReadonlyMap<string, ProjectExport>> {
    if (!this.#exports) {
      this.#exports = this.#loadExports();
    }

    return this.#exports;
  }

  async #loadExports(): Promise<ReadonlyMap<string, ProjectExport>> {
    const entryPoints = await this.entryPoints;
    const entries = await Promise.all(
      [...entryPoints.values()].map(async entryPoint => {
        const entry = await ProjectExport.create(this, { entryPoint });

        return entry ? ([entry.name, entry] as const) : undefined;
      }),
    );

    return new Map(entries.filter(entry => !!entry) as (readonly [string, ProjectExport])[]);
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
  replacePackageJson(packageJson: PackageJson | PromiseLike<PackageJson>): ProjectPackage {
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
  autoloadPackageJson(packageJson: PackageJson | PromiseLike<PackageJson>): ProjectPackage {
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
  extendOptions(extension: PackageJson | PromiseLike<PackageJson>): ProjectPackage {
    const clone = this.clone();
    const prevPackageJson = this.#customPackageJson;

    clone.#customPackageJson = async () => deepmerge(await prevPackageJson(), await extension);

    return clone;
  }

}

interface PackageJson$ExportItem {
  readonly path: '.' | `./${string}`;
  readonly conditions: readonly string[];
  readonly target: `./${string}`;
}

class PackageJson$EntryPoint implements PackageJson.EntryPoint {

  readonly #path: '.' | `./${string}`;
  #targetsByCondition = new Map<string, Set<`./${string}`>>();

  constructor(path: '.' | `./${string}`, items: readonly PackageJson$ExportItem[]) {
    this.#path = path;

    for (const { conditions, target } of items) {
      for (const condition of conditions.length ? conditions : ['default']) {
        let targets = this.#targetsByCondition.get(condition);

        if (!targets) {
          targets = new Set();
          this.#targetsByCondition.set(condition, targets);
        }

        targets.add(target);
      }
    }
  }

  get path(): '.' | `./${string}` {
    return this.#path;
  }

  withConditions(...conditions: string[]): `./${string}` | undefined {
    if (!conditions.length) {
      conditions = ['default'];
    }

    let candidates: Set<`./${string}`> | undefined;

    for (const condition of conditions.length ? conditions : ['default']) {
      const matching = this.#targetsByCondition.get(condition);

      if (!matching) {
        return;
      }

      if (!candidates) {
        candidates = new Set(matching);
      } else {
        for (const match of matching) {
          if (!candidates.has(match)) {
            candidates.delete(match);
          }
        }

        if (!candidates.size) {
          return;
        }
      }
    }

    if (!candidates?.size) {
      return;
    }

    return candidates.values().next().value;
  }

}

function loadPackageJson(project: ProjectConfig): PackageJson {
  const require = module.createRequire(import.meta.url);

  return require(path.join(project.rootDir, 'package.json')) as PackageJson;
}

function isPathExport(key: string): key is '.' | './${string' {
  return key.startsWith('.');
}
