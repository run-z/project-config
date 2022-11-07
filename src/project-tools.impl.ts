import { ProjectConfig } from './project-config.js';
import { ProjectToolsBase, ProjectToolsInit } from './project-tools.js';

/**
 * @internal
 */
export class ProjectTools$Proxy implements ProxyHandler<ProjectToolsBase> {

  readonly #project: ProjectConfig;
  readonly #init: ProjectToolsInit;
  readonly #tools = new Map<string | symbol, unknown>();

  constructor(project: ProjectConfig, init: ProjectToolsInit = {}) {
    this.#project = project;
    this.#init = init;
  }

  get<TKey extends keyof ProjectToolsInit>(
    _target: ProjectToolsBase,
    key: TKey,
    _receiver: ProjectToolsBase,
  ): ProjectToolsBase[TKey] {
    if (this.#tools.has(key)) {
      return this.#tools.get(key) as ProjectToolsBase[TKey];
    }

    const init = this.#init[key];
    let tool: ProjectToolsBase[TKey];

    if (typeof init !== 'function') {
      tool = init as ProjectToolsBase[TKey];
    } else {
      this.#tools.set(key, undefined); // In case of recursive request while creating the tool.

      try {
        tool = init(this.#project) as ProjectToolsBase[TKey];
      } catch (error) {
        this.#tools.delete(key);
        throw error;
      }
    }

    this.#tools.set(key, tool);

    return tool;
  }

  has(_target: ProjectToolsBase, key: string | symbol): boolean {
    return key in this.#init;
  }

  ownKeys(_target: ProjectToolsBase): Array<string | symbol> {
    return Reflect.ownKeys(this.#init);
  }

  getOwnPropertyDescriptor<TKey extends keyof ProjectToolsInit>(
    target: ProjectToolsBase,
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

  isExtensible(_target: ProjectToolsBase): boolean {
    return false;
  }

}
