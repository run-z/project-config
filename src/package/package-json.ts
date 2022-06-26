import module from 'node:module';
import path from 'node:path';
import { ProjectConfig } from '../project-config.js';

/**
 * `package.json` contents representation.
 *
 * @param packageJson - Path to `package.json` file to load. By default, loads the one from working directory.
 *
 * @returns Loaded `package.json` properties.
 */
export class PackageJson {

  readonly #raw: PackageJson.Raw;
  #entryPoints?: Map<'.' | `./${string}`, PackageJson.EntryPoint>;

  constructor(project: ProjectConfig, raw: PackageJson.Raw = loadPackageJson(project)) {
    this.#raw = raw;
  }

  /**
   * Raw `package.json` contents.
   */
  get raw(): PackageJson.Raw {
    return this.#raw;
  }

  /**
   * Read-only map of package entry points with exported paths or patterns as their keys.
   */
  get entryPoints(): ReadonlyMap<'.' | `./${string}`, PackageJson.EntryPoint> {
    if (!this.#entryPoints) {

      const items = new Map<'.' | `./${string}`, PackageJson$ExportItem[]>();

      for (const item of this.#listExports()) {

        const found = items.get(item.path);

        if (found) {
          found.push(item);
        } else {
          items.set(item.path, [item]);
        }
      }

      this.#entryPoints = new Map([...items].map(([path, items]) => [path, new PackageJson$EntryPoint(path, items)]));
    }

    return this.#entryPoints;
  }

  *#listExports(): IterableIterator<PackageJson$ExportItem> {

    const { exports } = this.#raw;

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

export namespace PackageJson {

  /**
   * Entry corresponding to package
   * [entry point](https://nodejs.org/dist/latest/docs/api/packages.html#package-entry-points) within `package.json`.
   */
  export interface EntryPoint {

    /**
     * Exported path or pattern.
     */
    readonly path: '.' | `./${string}`;

    /**
     * Searches for path or pattern matching to all of provided conditions.
     *
     * @param conditions - Required export conditions. When missing, searches for `default` one.
     *
     * @returns Matching path or pattern, or `undefined` when not found.
     */
    withConditions(...conditions: string[]): `./${string}` | undefined;

  }

  /**
   * Subset of [package.json](https://docs.npmjs.com/cli/v6/configuring-npm/package-json) properties.
   */
  export interface Raw {
    readonly name?: string | undefined;
    readonly exports?: Exports | undefined;
    readonly dependencies?: Dependencies;
    readonly devDependencies?: Dependencies;
    readonly peerDependencies?: Dependencies;
    readonly optionalDependencies?: Dependencies;
    readonly [key: string]: unknown;
  }

  export type Dependencies = {

    readonly [name in string]: string;

  };

  export type Exports = PathExports | TopConditionalExports | `./${string}`;

  export type PathExports = {

    readonly [key in '.' | `./${string}`]: ConditionalExports | `./${string}`;

  };

  export type ConditionalExports = {

    readonly [key in string]: ConditionalExports | `./${string}`;

  };

  export type TopConditionalExports = {

    readonly [key in string]: TopConditionalExports | PathExports | `./${string}`;

  };

}

function loadPackageJson(project: ProjectConfig): PackageJson.Raw {

  const require = module.createRequire(import.meta.url);

  return require(path.join(project.rootDir, 'package.json')) as PackageJson.Raw;
}

function isPathExport(key: string): key is '.' | './${string' {
  return key.startsWith('.');
}
