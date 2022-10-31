import os from 'node:os';
import { GitIgnoreEntry } from './git-ignore-entry.js';
import { GitIgnoreFile } from './git-ignore-file.js';

/**
 * A section of {@link GitIgnoreFile file in .gitignore format}.
 *
 * Each section starts with a {@link GitIgnoreSection#title title} comment, except possibly for the very first one.
 * The title of such section is empty string.
 *
 * The section consists of rules following the title comment.
 */
export abstract class GitIgnoreSection {

  readonly #file: GitIgnoreFile;
  readonly #title: string;

  /**
   * Constructs `.gitignore` file section.
   *
   * @param file - Parent file in `.gitignore` format.
   * @param title - Section title. I.e. comment preceding it.
   */
  constructor(file: GitIgnoreFile, title: string) {
    this.#file = file;
    this.#title = title;
  }

  /**
   * Parent file in `.gitignore` format.
   */
  get file(): GitIgnoreFile {
    return this.#file;
  }

  /**
   * Section title. I.e. comment preceding it.
   */
  get title(): string {
    return this.#title;
  }

  /**
   * Iterates over entry patterns.
   *
   * @returns Iterable iterator of section entry patterns.
   */
  *patterns(): IterableIterator<string> {
    for (const { pattern } of this.entries()) {
      yield pattern;
    }
  }

  /**
   * Iterates over section entries.
   *
   * @returns Iterable iterator of section entries.
   */
  abstract entries(): IterableIterator<GitIgnoreEntry>;

  /**
   * Finds existing `.gitignore` file entry or creates new one.
   *
   * If entry already attached to another section, then the returned entry would reflect existing one, while its
   * {@link GitIgnoreEntry#currentSection current section} would point to another section. The returned entry will be
   * {@link GitIgnoreEntry#isDetached detached} in this case.
   *
   * The {@link GitIgnoreEntry#section section} of returned entry always returns to `this` section. The returned entry
   * will be {@link GitIgnoreEntry#isDetached detached}, unless it already attached to this section.
   *
   * @param pattern - Entry pattern.
   *
   * @returns File entry.
   */
  abstract entry(pattern: string): GitIgnoreEntry;

  /**
   * Replaces entries of this section.
   *
   * Retains only entries added by the `build` function and removes the rest of them.
   *
   * @param build - Builds section entries.
   *
   * @returns `this` instance.
   */
  abstract replace(build: (section: this) => void): this;

  /**
   * Builds content of the section of file in `.gitignore` format.
   *
   * @param eol - End of line symbol. Defaults to `os.EOL`.
   *
   * @returns String representation of section title and entries.
   */
  toString(eol = os.EOL): string {
    let out = '';

    if (this.title) {
      out += '# ' + this.title.replaceAll('\n', eol + '# ') + eol;
    }
    for (const entry of this.entries()) {
      out += `${entry}${eol}`;
    }

    return out;
  }

}
