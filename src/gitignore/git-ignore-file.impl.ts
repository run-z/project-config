import { GitIgnoreFile } from './git-ignore-file.js';
import { GitIgnoreSectionCtl } from './git-ignore-section.impl.js';

/**
 * @internal
 */
export class GitIgnoreFileCtl {

  readonly #file: GitIgnoreFile;
  readonly #entrySections = new Map<string, GitIgnoreSectionCtl>();
  #isModified = false;

  constructor(file: GitIgnoreFile) {
    this.#file = file;
  }

  get file(): GitIgnoreFile {
    return this.#file;
  }

  get isModified(): boolean {
    return this.#isModified;
  }

  sectionOfEntry(pattern: string): GitIgnoreSectionCtl | undefined {
    return this.#entrySections.get(pattern);
  }

  addEntryToSection(pattern: string, sectionCtl: GitIgnoreSectionCtl): void {
    this.#entrySections.set(pattern, sectionCtl);
    this.modify();
  }

  removeEntryFromSection(pattern: string, sectionCtl: GitIgnoreSectionCtl): void {
    if (this.#entrySections.get(pattern) === sectionCtl) {
      this.#entrySections.delete(pattern);
      this.modify();
    }
  }

  modify(modified = true): this {
    this.#isModified = modified;

    return this;
  }

}
