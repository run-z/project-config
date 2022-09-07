import { GitIgnoreEntry } from './git-ignore-entry.js';
import { GitIgnoreSectionCtl } from './git-ignore-section.impl.js';
import { GitIgnoreSection } from './git-ignore-section.js';

export class GitIgnoreEntry$ extends GitIgnoreEntry {

  readonly #sectionCtl: GitIgnoreSectionCtl;

  constructor(sectionCtl: GitIgnoreSectionCtl, pattern: string) {
    super(sectionCtl.section, pattern);
    this.#sectionCtl = sectionCtl;
  }

  override get isIgnored(): boolean {
    return this.#sectionCtl.isIgnored(this);
  }

  override get isRemoved(): boolean {
    return this.#sectionCtl.isRemoved(this);
  }

  override ignore(): GitIgnoreSection {
    if (this.isRemoved || !this.isIgnored) {
      this.#sectionCtl.ignore(this);
    }

    return this.section;
  }

  override unIgnore(): GitIgnoreSection {
    if (this.isRemoved || this.isIgnored) {
      this.#sectionCtl.unIgnore(this);
    }

    return this.section;
  }

  override remove(): GitIgnoreSection {
    if (!this.isRemoved) {
      this.#sectionCtl.remove(this);
    }

    return this.section;
  }

}
