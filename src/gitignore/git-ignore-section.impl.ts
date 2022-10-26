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

  #entries = new Map<string, [GitIgnoreEntry, GitIgnoreEntryCtl]>();
  readonly #fileCtl: GitIgnoreFileCtl;
  readonly #section: GitIgnoreSection$;
  #detached?: Map<string, [GitIgnoreEntry, GitIgnoreEntryCtl]>;

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
    for (const [entry] of this.#entries.values()) {
      if (entry.currentSection !== this.section) {
        this.#entries.delete(entry.pattern);
      } else {
        yield entry;
      }
    }
  }

  entry(rawPattern: string, entryCtl?: GitIgnoreEntryCtl): GitIgnoreEntry {
    const { pattern, update } = gitIgnorePattern(rawPattern);
    const existing = this.#entries.get(pattern);

    if (existing) {
      return update(existing[0]);
    }

    entryCtl ??= new GitIgnoreEntryCtl(pattern);

    const entry = entryCtl.entryFor(this);

    return update(entry);
  }

  attachEntry(entry: GitIgnoreEntry, entryCtl: GitIgnoreEntryCtl): GitIgnoreEntryCtl {
    this.#entries.set(entry.pattern, [entry, entryCtl]);

    if (this.#detached?.delete(entry.pattern)) {
      entryCtl.reAttach();

      return entryCtl;
    }

    return this.#fileCtl.attachEntry(entryCtl);
  }

  removeEntry(entryCtl: GitIgnoreEntryCtl): void {
    this.#entries.delete(entryCtl.pattern);
    this.#fileCtl.removeEntry(entryCtl);
  }

  replaceEntries(build: () => void): void {
    if (this.#detached) {
      // Replacement already started.
      build();

      return;
    }

    // Detach all existing entries.
    this.#detached = new Map();
    for (const e of this.#entries.values()) {
      const entryCtl = e[1];

      entryCtl.detach();
      this.#detached.set(entryCtl.pattern, e);
    }

    try {
      build();
    } finally {
      // Remove still detached entries.
      for (const [replaced] of this.#detached.values()) {
        replaced.remove();
      }
      this.#detached = undefined;
    }
  }

}
