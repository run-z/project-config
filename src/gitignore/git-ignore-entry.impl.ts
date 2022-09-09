import { GitIgnoreEntry } from './git-ignore-entry.js';
import { GitIgnoreSectionCtl } from './git-ignore-section.impl.js';
import { GitIgnoreSection } from './git-ignore-section.js';

class GitIgnoreEntry$ extends GitIgnoreEntry {

  readonly #sectionCtl: GitIgnoreSectionCtl;
  #ctl: GitIgnoreEntryCtl;

  constructor(sectionCtl: GitIgnoreSectionCtl, ctl: GitIgnoreEntryCtl) {
    super(ctl.pattern);
    this.#sectionCtl = sectionCtl;
    this.#ctl = ctl;
  }

  override get section(): GitIgnoreSection {
    return this.#sectionCtl.section;
  }

  override get currentSection(): GitIgnoreSection | undefined {
    return this.#currentCtl?.attachedTo?.section;
  }

  override get isDetached(): boolean {
    return this.#ctl.attachedTo !== this.#sectionCtl;
  }

  override get effect(): GitIgnoreEntry.Effect {
    return this.#ctl.effect ?? this.#currentCtl?.effect ?? 'ignore';
  }

  override get match(): GitIgnoreEntry.Match {
    return this.#ctl.match ?? this.#currentCtl?.match ?? 'all';
  }

  override setMatch(match: GitIgnoreEntry.Match): this {
    this.#ctl.setMatch(this.#sectionCtl, match);

    return this;
  }

  override ignore(ignore = true): GitIgnoreSection {
    this.#ctl = this.#ctl
      .setEffect(this.#sectionCtl, ignore ? 'ignore' : 'include')
      .attachTo(this.#sectionCtl, this);

    return this.section;
  }

  override remove(): GitIgnoreSection {
    this.#ctl.remove(this.#sectionCtl);

    return this.section;
  }

  get #currentCtl(): GitIgnoreEntryCtl | undefined {
    return this.#sectionCtl.fileCtl.entryCtl(this.pattern);
  }

}

/**
 * @internal
 */
export class GitIgnoreEntryCtl {

  static parse(line: string): GitIgnoreEntryCtl | undefined {
    if (line.startsWith('\\#')) {
      // Pattern starting with `#` has to be escaped.
      line = line.slice(1);
    }
    if (line.endsWith('\\')) {
      // Spaces preceding the trailing `\` character should be preserved.
      line = line.slice(0, -1);
    }
    if (!line) {
      return;
    }

    let effect: GitIgnoreEntry.Effect;
    let match: GitIgnoreEntry.Match;

    if (line.startsWith('!')) {
      line = line.slice(1);
      effect = 'include';
    } else {
      effect = 'ignore';
    }
    if (line.endsWith('/')) {
      line = line.slice(0, -1);
      match = 'dirs';
    } else {
      match = 'all';
    }

    return new GitIgnoreEntryCtl(line, match, effect);
  }

  readonly #pattern: string;
  #match?: GitIgnoreEntry.Match;
  #effect?: GitIgnoreEntry.Effect;
  #attachedTo?: GitIgnoreSectionCtl;

  constructor(pattern: string, match?: GitIgnoreEntry.Match, effect?: GitIgnoreEntry.Effect) {
    this.#pattern = pattern;
    this.#match = match;
    this.#effect = effect;
  }

  entryFor(sectionCtl: GitIgnoreSectionCtl): GitIgnoreEntry {
    return new GitIgnoreEntry$(sectionCtl, this);
  }

  get pattern(): string {
    return this.#pattern;
  }

  get effect(): GitIgnoreEntry.Effect | undefined {
    return this.#effect;
  }

  setEffect(sectionCtl: GitIgnoreSectionCtl, effect: GitIgnoreEntry.Effect): this {
    if (this.#effect !== effect) {
      this.#effect = effect;
      this.#modify(sectionCtl);
    }

    return this;
  }

  get match(): GitIgnoreEntry.Match | undefined {
    return this.#match;
  }

  setMatch(sectionCtl: GitIgnoreSectionCtl, match: GitIgnoreEntry.Match): this {
    if (this.#match !== match) {
      this.#match = match;
      this.#modify(sectionCtl);
    }

    return this;
  }

  get attachedTo(): GitIgnoreSectionCtl | undefined {
    return this.#attachedTo;
  }

  attachTo(
    sectionCtl: GitIgnoreSectionCtl,
    entry: GitIgnoreEntry = this.entryFor(sectionCtl),
  ): GitIgnoreEntryCtl {
    if (this.#attachedTo === sectionCtl) {
      return this;
    }

    this.#attachedTo = sectionCtl;

    return sectionCtl.attachEntry(entry, this);
  }

  remove(sectionCtl: GitIgnoreSectionCtl): void {
    if (this.#attachedTo === sectionCtl) {
      this.#attachedTo.removeEntry(this);
      this.#attachedTo = undefined;
    }
  }

  updateBy(other: GitIgnoreEntryCtl): boolean {
    let modified = false;

    if (this.#attachedTo !== other.#attachedTo) {
      this.#attachedTo = other.#attachedTo;
      modified = true;
    }
    if (other.#effect && other.#effect !== this.#effect) {
      this.#effect = other.#effect;
      modified = true;
    }
    if (other.#match && other.#match !== this.#match) {
      this.#match = other.#match;
      modified = true;
    }

    return modified;
  }

  #modify(sectionCtl: GitIgnoreSectionCtl): void {
    if (this.#attachedTo === sectionCtl) {
      sectionCtl.fileCtl.modify();
    }
  }

}
