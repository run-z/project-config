import { ProjectEntry } from './project-entry.js';

export class ProjectEntry$ extends ProjectEntry {

  protected override detectDistFiles(): Promise<ProjectEntry.DistFiles | null> {
    return Promise.resolve(null);
  }

}

export class ProjectEntry$Main extends ProjectEntry {

  protected override async detectDistFiles(): Promise<ProjectEntry.DistFiles | null> {
    const { type } = await this.host().packageJson;

    return type === 'module' ? { esm: 'main.js' } : { commonJS: 'main.js' };
  }

}
