import deepmerge from 'deepmerge';
import module from 'node:module';
import path from 'node:path';
import { ProjectConfig, ProjectSpec } from '../project-config.js';
import { PackageJson } from './package.json';
import { ProjectEntry } from './project-entry.js';
import { ProjectExport } from './project-export.js';

function ProjectPackage$create(
  project: ProjectConfig,
  packageJson?: PackageJson | PromiseLike<PackageJson>,
): ProjectPackage {
  const pkg = project.tools.package;

  if (pkg) {
    const config = pkg instanceof ProjectPackage ? pkg : new ProjectPackage(project, pkg);

    if (packageJson) {
      config.extendOptions(packageJson);
    }

    return config;
  }

  return new ProjectPackage(project, packageJson);
}

/**
 * Package configuration constructed by `package.json` contents.
 */
export class ProjectPackage {

  /**
   * Gains package configuration by its specifier.
   *
   * Respects {@link ProjectToolsInit#package base configuration}.
   *
   * Project package configuration can be specified by one of:
   *
   * - Package configuration instance returned as is.
   * - Raw `package.json` contents, or promise-like instance resolving to ones.
   *   New package configuration created in this case.
   * - Nothing to create default configuration.
   *
   * @param project - Configured project specifier.
   * @param spec - Project package specifier.
   *
   * @returns Package configuration instance.
   */
  static of(project?: ProjectSpec, spec?: ProjectPackageSpec): ProjectPackage {
    if (spec instanceof ProjectPackage) {
      return spec;
    }

    const projectConfig = ProjectConfig.of(project);

    return spec
      ? ProjectPackage$create(projectConfig, spec)
      : projectConfig.get(ProjectPackage$create);
  }

  readonly #project: ProjectConfig;
  #autoloaded = true;
  #customPackageJson: () => PackageJson | PromiseLike<PackageJson>;
  #packageJson?: Promise<PackageJson>;
  #entryPoints?: Promise<ReadonlyMap<'.' | `./${string}`, PackageJson.EntryPoint>>;
  #exports?: Promise<ReadonlyMap<string, ProjectExport>>;
  #mainEntry?: Promise<ProjectEntry>;

  /**
   * Constructs `package.json` representation.
   *
   * @param project - Configured project specifier.
   * @param packageJson - Raw `package.json` contents.
   */
  constructor(project: ProjectSpec, packageJson: PackageJson | PromiseLike<PackageJson> = {}) {
    this.#project = ProjectConfig.of(project);
    this.#customPackageJson = () => packageJson;
  }

  #rebuild(): this {
    this.#packageJson = undefined;
    this.#entryPoints = undefined;
    this.#exports = undefined;
    this.#mainEntry = undefined;

    return this;
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
   * @returns `this` instance.
   */
  replacePackageJson(packageJson: PackageJson | PromiseLike<PackageJson>): this {
    this.#autoloaded = false;
    this.#customPackageJson = () => packageJson;

    return this.#rebuild();
  }

  /**
   * Replaces custom `package.json` contents with autoloaded ones.
   *
   * Clears custom options, and forces {@link autoloaded automatic loading}.
   *
   * @param packageJson - `package.json` contents extending autoloaded ones.
   *
   * @returns `this` instance.
   */
  autoloadPackageJson(packageJson: PackageJson | PromiseLike<PackageJson>): this {
    this.#autoloaded = true;
    this.#customPackageJson = () => packageJson;

    return this.#rebuild();
  }

  /**
   * Extends `package.json` contents.
   *
   * @param extension - `package.json` contents extending previous ones.
   *
   * @returns `this` instance.
   */
  extendOptions(extension: PackageJson | PromiseLike<PackageJson>): this {
    const prevPackageJson = this.#customPackageJson;

    this.#customPackageJson = async () => deepmerge(await prevPackageJson(), await extension);

    return this.#rebuild();
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

/**
 * Project package {@link ProjectPackage.of specifier}.
 */
export type ProjectPackageSpec =
  | ProjectPackage
  | PackageJson
  | PromiseLike<PackageJson>
  | undefined;

function loadPackageJson(project: ProjectConfig): PackageJson {
  const require = module.createRequire(import.meta.url);

  return require(path.join(project.rootDir, 'package.json')) as PackageJson;
}

function isPathExport(key: string): key is '.' | './${string' {
  return key.startsWith('.');
}
