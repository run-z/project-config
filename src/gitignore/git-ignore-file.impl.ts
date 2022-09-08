import { GitIgnoreEntryCtl } from './git-ignore-entry.impl.js';
import { GitIgnoreFile } from './git-ignore-file.js';

/**
 * @internal
 */
export class GitIgnoreFileCtl {

  readonly #file: GitIgnoreFile;
  readonly #entryCtls = new Map<string, GitIgnoreEntryCtl>();
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

  entryCtl(pattern: string): GitIgnoreEntryCtl | undefined {
    return this.#entryCtls.get(pattern);
  }

  attachEntry(entryCtl: GitIgnoreEntryCtl): GitIgnoreEntryCtl {
    const { pattern } = entryCtl;
    const existingCtl = this.#entryCtls.get(pattern);

    if (existingCtl) {
      if (existingCtl.updateBy(entryCtl)) {
        this.modify();
      } else {
        console.debug('!!!');
      }

      return existingCtl;
    }

    this.#entryCtls.set(pattern, entryCtl);
    this.modify();

    return entryCtl;
  }

  removeEntry(entryCtl: GitIgnoreEntryCtl): void {
    if (this.#entryCtls.delete(entryCtl.pattern)) {
      this.modify();
    }
  }

  modify(modified = true): this {
    this.#isModified = modified;

    return this;
  }

}
