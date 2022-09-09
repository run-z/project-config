import { GitIgnoreFile } from './git-ignore-file.js';
import { GitIgnoreSection } from './git-ignore-section.js';

/**
 * An entry of {@link GitIgnoreFile file in .gitignore format}.
 *
 * Every entry belongs to some {@link GitIgnoreSection section} of the file.
 *
 * May be accessed or created with {@link GitIgnoreSection#entry} method.
 *
 * Note that new entry is {@link GitIgnoreEntry#isDetached detached} initially. To attach it to the file section
 * call the {@link GitIgnoreEntry.ignore} method.
 */
export abstract class GitIgnoreEntry {

  readonly #pattern: string;

  /**
   * Constructs `.gitignore` file entry.
   *
   * @param pattern - Pattern string without `!` prefix and `/` suffix.
   */
  constructor(pattern: string) {
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
  abstract get section(): GitIgnoreSection;

  /**
   * The section the entry with the same {@link pattern} currently belongs to.
   */
  abstract get currentSection(): GitIgnoreSection | undefined;

  /**
   * Pattern string without `!` prefix and `/` suffix.
   */
  get pattern(): string {
    return this.#pattern;
  }

  /**
   * Whether this entry is detached from file.
   *
   * Detached entry is not part of {@link GitIgnoreFile file} or its {@link section}.
   *
   * The entry is detached initially. It can be attached by calling {@link ignore} method. Calling {@link remove}
   * detaches it again.
   */
  abstract get isDetached(): boolean;

  /**
   * An effect this entry applies to matching files or directories.
   *
   * I.e. whether the matching files or directories ignored or not.
   */
  abstract get effect(): GitIgnoreEntry.Effect;

  /**
   * Overrides the {@link effect} of this entry.
   *
   * If this entry {@link isDetached attached} to the {@link section}, then {@link GitIgnoreFile#isModified modifies}
   * the file immediately. Otherwise, the file will be modified only after the entry {@link ignore attachment}.
   *
   * Note that this will be overridden by {@link ignore} method call. USe {@link attach} one to preserve it.
   *
   * @param effect - New effect of the pattern.
   *
   * @returns `this` instance.
   */
  abstract setEffect(effect: GitIgnoreEntry.Effect): this;

  /**
   * What this entry matches.
   *
   * I.e. either only directories or both files and directories.
   */
  abstract get match(): GitIgnoreEntry.Match;

  /**
   * Overrides the pattern {@link match}.
   *
   * If this entry {@link isDetached attached} to the {@link section}, then {@link GitIgnoreFile#isModified modifies}
   * the file immediately. Otherwise, the file will be modified only after the entry {@link ignore attachment}.
   *
   * @param match - New match of the pattern.
   *
   * @returns `this` instance.
   */
  abstract setMatch(match: GitIgnoreEntry.Match): this;

  /**
   * Ignores files matching the {@link pattern} or re-includes them.
   *
   * @param ignore - `true` (the default) to ignore files matching the pattern, or `false` to re-include them.
   *
   * @returns Parent section.
   */
  ignore(ignore = true): GitIgnoreSection {
    this.setEffect(ignore ? 'ignore' : 'include');

    return this.attach();
  }

  /**
   * Attaches this entry to the file.
   *
   * In contrast to {@link ignore}, this method does not alter the {@link effect} of this entry.
   *
   * @returns Parent section.
   */
  abstract attach(): GitIgnoreSection;

  /**
   * Removes the {@link pattern} from the file.
   *
   * The entry becomes {@link isDetached} after this method call.
   *
   * Does nothing if the entry is already {@link isDetached detached}.
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

    if (this.effect === 'include') {
      out += `!${pattern}`;
    } else {
      if (pattern.startsWith('#')) {
        out += '\\'; // Leading `#` has to be escaped.
      }
      out += pattern;
    }
    if (this.match === 'dirs') {
      out += '/';
    } else if (pattern.trimEnd() !== pattern) {
      out += '\\'; // Trailing whitespace has to be ended with `\`.
    }

    return out;
  }

}

export namespace GitIgnoreEntry {
  /**
   * An effect the `.gitignore` entry applies to matching files or directories.
   *
   * One of:
   *
   * - `ignore` - Ignore matching files. This corresponds to patterns not starting with `!`.
   * - `include` - Re-include matching files. This corresponds to negated patterns starting with `!`.
   */
  export type Effect = 'ignore' | 'include';

  /**
   * What matches the `.gitignore` pattern.
   *
   * One of:
   *
   * - `all` - The pattern matches both files and directories.
   * - `dirs` - The pattern matches only directories. This corresponds to patterns with trailing `/`.
   */
  export type Match = 'all' | 'dirs';
}
