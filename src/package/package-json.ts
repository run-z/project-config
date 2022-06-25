import module from 'node:module';
import path from 'node:path';
import { ProjectConfig } from '../project-config.js';

/**
 * Loads {@link PackageJson package.json} file.
 *
 * @param packageJson - Path to `package.json` file to load. By default, loads the one from working directory.
 *
 * @returns Loaded `package.json` properties.
 */
export class PackageJson {

  readonly #raw: PackageJson.Raw;
  #exports?: Map<'.' | `./${string}`, PackageJson.Export>;

  constructor(project: ProjectConfig, raw: PackageJson.Raw = loadPackageJson(project)) {
    this.#raw = raw;
  }

  get raw(): PackageJson.Raw {
    return this.#raw;
  }

  get exports(): ReadonlyMap<'.' | `./${string}`, PackageJson.Export> {
    if (!this.#exports) {

      const items = new Map<'.' | `./${string}`, ExportItem[]>();

      for (const item of this.#listExports()) {

        const found = items.get(item.path);

        if (found) {
          found.push(item);
        } else {
          items.set(item.path, [item]);
        }
      }

      this.#exports = new Map([...items].map(([path, items]) => [path, new PackageJson$Export(items)]));
    }

    return this.#exports;
  }

  *#listExports(): IterableIterator<ExportItem> {

    const { exports } = this.#raw;

    if (!exports) {
      return;
    }

    yield* this.#condExports([], exports);
  }

  *#condExports(
      conditions: readonly string[],
      exports: PackageJson.TopConditionalExports | PackageJson.PathExports | `./${string}`,
  ): IterableIterator<ExportItem> {
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
  ): IterableIterator<ExportItem> {
    if (typeof exports === 'string') {
      yield { path, conditions, target: exports };

      return;
    }

    for (const [key, entry] of Object.entries(exports)) {
      yield* this.#pathExports(path, [...conditions, key], entry);
    }
  }

}

export interface ExportItem {
  readonly path: '.' | `./${string}`;
  readonly conditions: readonly string[];
  readonly target: `./${string}`;
}

class PackageJson$Export implements PackageJson.Export {

  #targetsByCondition = new Map<string, Set<`./${string}`>>();

  constructor(items: readonly ExportItem[]) {
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

  export interface Export {

    withConditions(...conditions: string[]): `./${string}` | undefined;

  }

  /**
   * Subset of [package.json](https://docs.npmjs.com/cli/v6/configuring-npm/package-json) properties.
   */
  export interface Raw {
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
