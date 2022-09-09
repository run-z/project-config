import fs from 'node:fs/promises';
import os from 'node:os';
import { GitIgnoreEntryCtl, gitIgnorePattern } from './git-ignore-entry.impl.js';
import { GitIgnoreEntry } from './git-ignore-entry.js';
import { GitIgnoreFileCtl } from './git-ignore-file.impl.js';
import { GitIgnoreSectionCtl } from './git-ignore-section.impl.js';
import { GitIgnoreSection } from './git-ignore-section.js';

/**
 * Representation of file in `.gitignore` format.
 *
 * The file consists of {@link GitIgnoreSection sections} separated by comments.
 */
export class GitIgnoreFile {

  readonly #ctl: GitIgnoreFileCtl;
  readonly #sectionCtls = new Map<string, GitIgnoreSectionCtl>();

  /**
   * Constructs empty `.gitignore`-like file representation.
   */
  constructor() {
    this.#ctl = new GitIgnoreFileCtl(this);
  }

  /**
   * Whether the file has been {@link modify modified}.
   */
  get isModified(): boolean {
    return this.#ctl.isModified;
  }

  /**
   * Iterates over file sections.
   *
   * @returns Iterable iterator of file sections.
   */
  *sections(): IterableIterator<GitIgnoreSection> {
    for (const { section } of this.#sectionCtls.values()) {
      yield section;
    }
  }

  /**
   * Accesses or creates new section with the given `title`.
   *
   * @param title - Target section title.
   *
   * @returns Target file section.
   */
  section(title: string): GitIgnoreSection {
    return this.#sectionCtl(title).section;
  }

  /**
   * Iterates over all file entries.
   *
   * @returns Iterable iterator of file entries.
   */
  *entries(): IterableIterator<GitIgnoreEntry> {
    for (const sectionCtl of this.#sectionCtls.values()) {
      yield* sectionCtl.entries();
    }
  }

  /**
   * Finds existing `.gitignore` file entry or creates new one.
   *
   * First, finds an entry attached to any section. If no such entry found, then creates new one in default section.
   *
   * @param pattern - Entry pattern.
   *
   * @returns File entry.
   */
  entry(pattern: string): GitIgnoreEntry;
  entry(rawPattern: string): GitIgnoreEntry {
    const { pattern } = gitIgnorePattern(rawPattern);
    const entryCtl = this.#ctl.entryCtl(pattern);

    if (entryCtl && entryCtl.attachedTo) {
      return entryCtl.attachedTo.entry(rawPattern, entryCtl);
    }

    return this.section('').entry(rawPattern);
  }

  #sectionCtl(title: string): GitIgnoreSectionCtl {
    let sectionCtl = this.#sectionCtls.get(title);

    if (!sectionCtl) {
      sectionCtl = new GitIgnoreSectionCtl(this.#ctl, title);
      this.#sectionCtls.set(title, sectionCtl);
    }

    return sectionCtl;
  }

  /**
   * Loads contents of the file in `.gitignore` format.
   *
   * @param path - Path to source file.
   *
   * @returns Promise resolved to `this` instance when file is loaded.
   */
  async load(path: string): Promise<this> {
    return this.parse(await fs.readFile(path, 'utf-8'));
  }

  /**
   * Parses contents of the file in `.gitignore` format.
   *
   * @param content - File content to parse.
   *
   * @returns `this` instance.
   */
  parse(content: string): this {
    const { isModified } = this;
    const lines = content.split(/\r?\n/);
    let prevComment: string | null = null;
    let sectionCtl: GitIgnoreSectionCtl | null = null;

    for (let line of lines) {
      line = line.trimEnd();
      if (line.startsWith('#')) {
        sectionCtl = null;

        const comment = line.slice(1).trim();

        if (comment) {
          prevComment = prevComment != null ? prevComment + '\n' + comment : comment;
        }

        continue;
      }

      const entryCtl = GitIgnoreEntryCtl.parse(line);

      if (prevComment) {
        sectionCtl = this.#sectionCtl(prevComment);
        prevComment = null;
      } else if (!sectionCtl) {
        if (!entryCtl) {
          continue; // Empty line before section start
        }
        sectionCtl = this.#sectionCtl(''); // Default section.
      }

      entryCtl?.attachTo(sectionCtl);
    }

    if (prevComment != null) {
      this.section(prevComment);
    }
    this.#ctl.modify(isModified);

    return this;
  }

  /**
   * Overwrites `.gitignore` file contents, unless the file is not {@link isModified modified}.
   *
   * Once file saved, it is marked as {@link isModified not modified}.
   *
   * @param path - Path to target file.
   *
   * @returns Promise resolved to `this` instance when file is written.
   */
  async save(path: string): Promise<this> {
    if (!this.isModified) {
      return this;
    }

    await fs.writeFile(path, this.toString());
    this.#ctl.modify(false);

    return this;
  }

  /**
   * Builds content of file in `.gitignore` format.
   *
   * @param eol - End of line symbol. Defaults to `os.EOL`.
   */
  toString(eol = os.EOL): string {
    let out = '';

    for (const section of this.sections()) {
      if (out) {
        out += eol; // New line after previous section.
        if (!section.title) {
          out += `#${eol}`;
        }
      }
      out += section.toString();
    }

    return out;
  }

}
