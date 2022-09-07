import { GitIgnoreFile } from './git-ignore-file.js';
import { GitIgnoreSection } from './git-ignore-section.js';

/**
 * An entry of {@link GitIgnoreFile file in .gitignore format}.
 *
 * Every entry belongs to some {@link GitIgnoreSection section} of the file.
 *
 * May be accessed or created with {@link GitIgnoreSection#entry} method.
 *
 * Note that a new entry is {@link GitIgnoreEntry#isRemoved removed} from the file. To add it to file section either
 * {@link GitIgnoreEntry#ignore ignore}, or {@link GitIgnoreEntry#unIgnore un-ignore} it.
 */
export abstract class GitIgnoreEntry {

  readonly #section: GitIgnoreSection;
  readonly #pattern: string;

  /**
   * Constructs `.gitignore` file entry.
   *
   * @param section - Parent section of the file in `.gitignore` format.
   * @param pattern - Pattern string without `!` prefix.
   */
  constructor(section: GitIgnoreSection, pattern: string) {
    this.#section = section;
    this.#pattern = pattern;
  }

  /**
   * Parent file in `.gitignore` format.
   */
  get file(): GitIgnoreFile {
    return this.section.file;
  }

  /**
   * Parent section of the file in `.gitignore` format.
   */
  get section(): GitIgnoreSection {
    return this.#section;
  }

  /**
   * Pattern string without `!` prefix.
   */
  get pattern(): string {
    return this.#pattern;
  }

  /**
   * Whether the {@link pattern} is ignored.
   *
   * This is `true`, unless this pattern un-ignored with `!` prefix.
   */
  abstract get isIgnored(): boolean;

  /**
   * Whether the {@link pattern} is removed from the file.
   *
   * New entries are always removed, until {@link ignore ignored} or {@link unIgnored un-ignored}.
   */
  abstract get isRemoved(): boolean;

  /**
   * Ignores {@link pattern}.
   *
   * @returns Parent section.
   */
  abstract ignore(): GitIgnoreSection;

  /**
   * Un-ignores {@link pattern}.
   *
   * @returns Parent section.
   */
  abstract unIgnore(): GitIgnoreSection;

  /**
   * Removes the pattern from the file.
   *
   * @returne Parent section.
   */
  abstract remove(): GitIgnoreSection;

  /**
   * Converts pattern to string representation ready to be written to the file in `.gitignore` format.
   *
   * @returns Pattern line.
   */
  toString(): string {
    let out = '';
    const { pattern } = this;

    if (!this.isIgnored) {
      out += `!${pattern}`;
    } else {
      if (pattern.startsWith('#')) {
        out += '\\'; // Leading `#` has to be escaped.
      }
      out += pattern;
    }
    if (pattern.trimEnd() !== pattern) {
      out += '\\'; // Trailing whitespace has to be ended with `\`.
    }

    return out;
  }

}
