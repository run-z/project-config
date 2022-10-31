import deepmerge from 'deepmerge';
import { RollupOptions } from 'rollup';
import { ProjectConfig } from '../project-config.js';
import { ProjectRollupPlugin$get } from './project-rollup-plugin.impl.js';

/**
 * Custom Rollup options {@link ProjectRollupOptions.of specifier}.
 */
export type ProjectRollupOptionsSpec =
  | ProjectRollupOptions
  | RollupOptions
  | RollupOptions[]
  | string
  | undefined;

/**
 * Custom Rollup options.
 */
export class ProjectRollupOptions implements Iterable<RollupOptions> {

  /**
   * Gains specified Rollup options.
   *
   * Rollup options can be specified by one of:
   *
   * - Custom Rollup options instance, which is returned as is.
   * - Object literal containing Rollup options, or array of such objects used to create new custom options.
   * - ESM module specifier to {@link @run-z/project-config!ProjectConfig#loadConfig load} options from.
   * - Nothing to construct empty options.
   *
   * @param project - Configured project to customize.
   * @param spec - Rollup options specifier.
   *
   * @returns Promise resolved to custom Rollup options instance.
   */
  static async of(
    project: ProjectConfig,
    spec?: ProjectRollupOptionsSpec,
  ): Promise<ProjectRollupOptions> {
    if (spec instanceof ProjectRollupOptions) {
      return spec;
    }
    if (typeof spec === 'string') {
      return await this.of(project, await project.loadConfig(spec, []));
    }

    return new ProjectRollupOptions(project, spec);
  }

  readonly #project: ProjectConfig;
  readonly #list: RollupOptions[];

  /**
   * Constructs options.
   *
   * @param project - Configured project.
   * @param options - Rollup options object or array of such objects.
   */
  constructor(project: ProjectConfig, options?: RollupOptions | RollupOptions[]) {
    this.#project = project;
    this.#list = options ? (Array.isArray(options) ? options : [options]) : [];
  }

  /**
   * Configured project.
   */
  get project(): ProjectConfig {
    return this.#project;
  }

  /**
   * Array of custom Rollup options.
   */
  get list(): RollupOptions[] {
    return this.#list;
  }

  /**
   * Whether these options are empty.
   */
  get areEmpty(): boolean {
    return !this.#list.length;
  }

  /**
   * Extends Rollup options.
   *
   * If extension created by {@link ProjectRollupConfig#toRollupConfig Rollup configuration}, it will be used as is.
   * Otherwise, a new custom options instance will be created with options merged.
   *
   * @param extensions - Rollup options extending this one.
   *
   * @returns Promise resolved to merged Rollup options.
   */
  async extend(...extensions: RollupOptions[]): Promise<ProjectRollupOptions> {
    if (!extensions.length) {
      return this;
    }
    if (this.areEmpty) {
      return new ProjectRollupOptions(this.project, extensions);
    }

    const extended = await Promise.all(
      extensions.map(async extension => await this.#extend(extension)),
    );

    return new ProjectRollupOptions(this.project, extended.flat());
  }

  async #extend(extension: RollupOptions): Promise<RollupOptions[]> {
    if (await ProjectRollupPlugin$get(extension)) {
      return [extension];
    }

    return this.list.map(base => deepmerge(base, extension, {
        arrayMerge(target: unknown[], source: unknown[]): unknown[] {
          // TODO Merge Rollup plugins?
          return [...target, ...source];
        },
      }));
  }

  [Symbol.iterator](): IterableIterator<RollupOptions> {
    return this.list[Symbol.iterator]();
  }

}
