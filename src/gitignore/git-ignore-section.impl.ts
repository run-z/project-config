import { GitIgnoreEntry$ } from './git-ignore-entry.impl.js';
import { GitIgnoreEntry } from './git-ignore-entry.js';
import { GitIgnoreFileCtl } from './git-ignore-file.impl.js';
import { GitIgnoreSection } from './git-ignore-section.js';

class GitIgnoreSection$ extends GitIgnoreSection {

  readonly #ctl: GitIgnoreSectionCtl;

  constructor(ctl: GitIgnoreSectionCtl, title: string) {
    super(ctl.fileCtl.file, title);
    this.#ctl = ctl;
  }

  override entries(): IterableIterator<GitIgnoreEntry> {
    return this.#ctl.entries();
  }

  override entry(pattern: string): GitIgnoreEntry {
    const sectionCtl = this.#ctl.fileCtl.sectionOfEntry(pattern) || this.#ctl;

    return sectionCtl.entry(pattern);
  }

}

/**
 * @internal
 */
export class GitIgnoreSectionCtl {

  readonly #entries = new Map<string, { isIgnored: boolean }>();
  readonly #fileCtl: GitIgnoreFileCtl;
  readonly #section: GitIgnoreSection$;

  constructor(fileCtl: GitIgnoreFileCtl, title: string) {
    this.#fileCtl = fileCtl;
    this.#section = new GitIgnoreSection$(this, title);
  }

  get fileCtl(): GitIgnoreFileCtl {
    return this.#fileCtl;
  }

  get section(): GitIgnoreSection$ {
    return this.#section;
  }

  *entries(): IterableIterator<GitIgnoreEntry$> {
    for (const pattern of this.#entries.keys()) {
      if (this.#fileCtl.sectionOfEntry(pattern) !== this) {
        this.#entries.delete(pattern);
      } else {
        yield this.entry(pattern);
      }
    }
  }

  entry(pattern: string): GitIgnoreEntry$ {
    return new GitIgnoreEntry$(this, pattern);
  }

  isIgnored(entry: GitIgnoreEntry$): boolean {
    return this.#entries.get(entry.pattern)?.isIgnored ?? false;
  }

  isRemoved(entry: GitIgnoreEntry$): boolean {
    return !this.#entries.has(entry.pattern);
  }

  add(pattern: string, isIgnored: boolean): void {
    this.#entries.set(pattern, { isIgnored });
    this.#fileCtl.addEntryToSection(pattern, this);
  }

  ignore(entry: GitIgnoreEntry$): void {
    this.#entries.set(entry.pattern, { isIgnored: true });
    this.#fileCtl.addEntryToSection(entry.pattern, this);
  }

  unIgnore(entry: GitIgnoreEntry$): void {
    this.#entries.set(entry.pattern, { isIgnored: false });
    this.#fileCtl.addEntryToSection(entry.pattern, this);
  }

  remove(entry: GitIgnoreEntry$): void {
    this.#entries.delete(entry.pattern);
    this.#fileCtl.removeEntryFromSection(entry.pattern, this);
  }

}
