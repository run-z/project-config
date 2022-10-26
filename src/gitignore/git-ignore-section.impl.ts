import { GitIgnoreEntryCtl, gitIgnorePattern } from './git-ignore-entry.impl.js';
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
    return this.#ctl.entry(pattern);
  }

  override replace(build: (section: this) => void): this {
    this.#ctl.replaceEntries(build.bind(this, this));

    return this;
  }

}

/**
 * @internal
 */
export class GitIgnoreSectionCtl {

  #entries = new Map<string, GitIgnoreEntry>();
  readonly #fileCtl: GitIgnoreFileCtl;
  readonly #section: GitIgnoreSection$;
  #replaced?: Map<string, GitIgnoreEntry>;

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

  *entries(): IterableIterator<GitIgnoreEntry> {
    for (const entry of this.#entries.values()) {
      if (entry.currentSection !== this.section) {
        this.#entries.delete(entry.pattern);
      } else {
        yield entry;
      }
    }
  }

  entry(rawPattern: string, ctl?: GitIgnoreEntryCtl): GitIgnoreEntry {
    const { pattern, update } = gitIgnorePattern(rawPattern);
    const entry = this.#entries.get(pattern);

    if (entry) {
      return update(entry);
    }

    return update((ctl || new GitIgnoreEntryCtl(pattern)).entryFor(this));
  }

  attachEntry(entry: GitIgnoreEntry, entryCtl: GitIgnoreEntryCtl): GitIgnoreEntryCtl {
    this.#entries.set(entry.pattern, entry);
    this.#replaced?.delete(entry.pattern);

    return this.#fileCtl.attachEntry(entryCtl);
  }

  removeEntry(entryCtl: GitIgnoreEntryCtl): void {
    this.#entries.delete(entryCtl.pattern);
    this.#fileCtl.removeEntry(entryCtl);
  }

  replaceEntries(build: () => void): void {
    if (this.#replaced) {
      build();

      return;
    }

    this.#replaced = this.#entries;
    this.#entries = new Map();

    try {
      build();
    } finally {
      for (const replaced of this.#replaced.values()) {
        replaced.remove();
      }
      this.#replaced = undefined;
    }
  }

}
