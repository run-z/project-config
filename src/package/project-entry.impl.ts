import { ProjectEntry } from './project-entry.js';
import { ProjectPackage } from './project-package.js';

export class ProjectEntry$ extends ProjectEntry {
  protected override detectDistFiles(): Promise<ProjectEntry.DistFiles | null> {
    return Promise.resolve(null);
  }
}

export class ProjectEntry$Main extends ProjectEntry {
  constructor(host: ProjectPackage) {
    super(host, '.');
  }

  protected override async detectDistFiles(): Promise<ProjectEntry.DistFiles | null> {
    const { type } = await this.host().packageJson;

    return type === 'module' ? { esm: 'main.js' } : { commonJS: 'main.js' };
  }
}
