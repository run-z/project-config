import module from 'node:module';
import path from 'node:path';
import { ProjectConfig } from '../project-config.js';
import { PackageJson } from './package.json.js';

export const PackageJson$DefaultEntryPoint: PackageJson.EntryPoint = {
  path: '.',
  findConditional(): undefined {
    return;
  },
};

export class PackageJson$EntryPoint implements PackageJson.EntryPoint {

  readonly #path: PackageJson.EntryPath;
  #targetsByCondition = new Map<string, Set<`./${string}`>>();

  constructor(path: PackageJson.EntryPath, items: readonly PackageJson$ExportItem[]) {
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

  get path(): PackageJson.EntryPath {
    return this.#path;
  }

  findConditional(...conditions: string[]): `./${string}` | undefined {
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

export interface PackageJson$ExportItem {
  readonly path: PackageJson.EntryPath;
  readonly conditions: readonly string[];
  readonly target: `./${string}`;
}

export function loadPackageJson(project: ProjectConfig): PackageJson {
  const require = module.createRequire(import.meta.url);

  return require(path.join(project.rootDir, 'package.json')) as PackageJson;
}

export function isPathExport(key: string): key is '.' | './${string' {
  return key.startsWith('.');
}
