import { ProjectConfig } from './project-config.js';
import { ProjectToolDefaults, ProjectToolsInit } from './project-tools.js';

/**
 * @internal
 */
export class ProjectTools$Proxy implements ProxyHandler<ProjectToolDefaults> {
  readonly #project: ProjectConfig;
  readonly #init: ProjectToolsInit;
  readonly #tools = new Map<string | symbol, unknown>();

  constructor(project: ProjectConfig, init: ProjectToolsInit = {}) {
    this.#project = project;
    this.#init = init;
  }

  get<TKey extends keyof ProjectToolsInit>(
    _target: ProjectToolDefaults,
    key: TKey,
    _receiver: ProjectToolDefaults,
  ): ProjectToolDefaults[TKey] {
    if (this.#tools.has(key)) {
      return this.#tools.get(key) as ProjectToolDefaults[TKey];
    }

    const init = this.#init[key];
    let tool: ProjectToolDefaults[TKey];

    if (typeof init !== 'function') {
      tool = init as ProjectToolDefaults[TKey];
    } else {
      this.#tools.set(key, undefined); // In case of recursive request while creating the tool.

      try {
        tool = init(this.#project) as ProjectToolDefaults[TKey];
      } catch (error) {
        this.#tools.delete(key);
        throw error;
      }
    }

    this.#tools.set(key, tool);

    return tool;
  }

  has(_target: ProjectToolDefaults, key: string | symbol): boolean {
    return key in this.#init;
  }

  ownKeys(_target: ProjectToolDefaults): Array<string | symbol> {
    return Reflect.ownKeys(this.#init);
  }

  getOwnPropertyDescriptor<TKey extends keyof ProjectToolsInit>(
    target: ProjectToolDefaults,
    key: TKey,
  ): PropertyDescriptor | undefined {
    if (!(key in this.#init)) {
      return;
    }

    return {
      get: () => this.get(target, key, target),
      enumerable: true,
      configurable: true,
    };
  }
}
