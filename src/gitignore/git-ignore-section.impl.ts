import { GitIgnoreEntryCtl } from './git-ignore-entry.impl.js';
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

}

/**
 * @internal
 */
export class GitIgnoreSectionCtl {

  readonly #entries = new Map<string, GitIgnoreEntry>();
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

  *entries(): IterableIterator<GitIgnoreEntry> {
    for (const entry of this.#entries.values()) {
      if (entry.currentSection !== this.section) {
        this.#entries.delete(entry.pattern);
      } else {
        yield entry;
      }
    }
  }

  entry(pattern: string): GitIgnoreEntry {
    const entry = this.#entries.get(pattern);

    return entry ?? new GitIgnoreEntryCtl(pattern).entryFor(this);
  }

  attachEntry(entry: GitIgnoreEntry, entryCtl: GitIgnoreEntryCtl): GitIgnoreEntryCtl {
    this.#entries.set(entry.pattern, entry);

    return this.#fileCtl.attachEntry(entryCtl);
  }

  removeEntry(entryCtl: GitIgnoreEntryCtl): void {
    this.#entries.delete(entryCtl.pattern);
    this.#fileCtl.removeEntry(entryCtl);
  }

}
