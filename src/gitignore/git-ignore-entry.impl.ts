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
    return !this.#ctl.attachedTo;
  }

  override get effect(): GitIgnoreEntry.Effect {
    return this.#ctl.effect ?? this.#currentCtl?.effect ?? 'ignore';
  }

  override get target(): GitIgnoreEntry.Target {
    return this.#ctl.target ?? this.#currentCtl?.target ?? 'all';
  }

  override ignore(ignore = true): GitIgnoreSection {
    this.#ctl = this.#ctl.setEffect(ignore ? 'ignore' : 'include').attachTo(this.#sectionCtl, this);

    return this.section;
  }

  override remove(): GitIgnoreSection {
    this.#ctl.remove();

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
    let target: GitIgnoreEntry.Target;

    if (line.startsWith('!')) {
      line = line.slice(1);
      effect = 'include';
    } else {
      effect = 'ignore';
    }
    if (line.endsWith('/')) {
      line = line.slice(0, -1);
      target = 'dir';
    } else {
      target = 'all';
    }

    return new GitIgnoreEntryCtl(line).setEffect(effect).setTarget(target);
  }

  readonly #pattern: string;
  #effect?: GitIgnoreEntry.Effect;
  #target?: GitIgnoreEntry.Target;
  #attachedTo?: GitIgnoreSectionCtl;

  constructor(pattern: string) {
    this.#pattern = pattern;
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

  setEffect(effect: GitIgnoreEntry.Effect): this {
    if (this.#effect !== effect) {
      this.#effect = effect;
      this.#modify();
    }

    return this;
  }

  get target(): GitIgnoreEntry.Target | undefined {
    return this.#target;
  }

  setTarget(target: GitIgnoreEntry.Target): this {
    if (this.#target !== target) {
      this.#target = target;
      this.#modify();
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

  remove(): void {
    if (this.#attachedTo) {
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
    if (other.#target && other.#target !== this.#target) {
      this.#target = other.#target;
      modified = true;
    }

    return modified;
  }

  #modify(): void {
    this.#attachedTo?.fileCtl.modify();
  }

}
