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
   * Iterates over section entries.
   *
   * @returns Iterable iterator of section entries.
   */
  abstract entries(): IterableIterator<GitIgnoreEntry>;

  /**
   * Creates `.gitignore` file entry in this section.
   *
   * If entry already exists in another section, then returns that entry.
   *
   * @param pattern - Entry pattern.
   *
   * @returns File entry.
   */
  abstract entry(pattern: string): GitIgnoreEntry;

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
